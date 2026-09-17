'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc, setDoc, collection, query, where, getDocs, type DocumentData, type DocumentReference } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { SUBSCRIPTION_RPC_URL, SUBSCRIPTION_TREASURY_WALLET } from '@/lib/subscriptions/payment-config';

const normalizePlanId = (plan?: string | null, priceUSD?: number | null) => {
  if (!plan && priceUSD == null) return null;
  const normalized = plan ? plan.toLowerCase() : '';

  if (normalized.includes('pro')) return 'pro';
  if (normalized.includes('starter')) return 'starter';
  if (normalized.includes('enterprise')) return 'enterprise';

  if (priceUSD === 19.99) return 'starter';
  if (priceUSD === 99.99) return 'pro';

  return normalized || null;
};

const getSubscriptionSnapshot = async (userId: string, entityId: string | null) => {
  if (entityId && entityId !== 'default') {
    const entitySubRef = doc(db, `users/${userId}/entities/${entityId}/subscriptions/current`);
    const snap = await getDoc(entitySubRef);
    if (snap.exists()) return snap;
    return null;
  }
  const globalRef = doc(db, `users/${userId}/subscriptions/current`);
  const snap = await getDoc(globalRef);
  return snap.exists() ? snap : null;
};

interface SubscriptionData {
  status: 'active' | 'pending' | 'expired' | null;
  plan: string | null;
  expiresAt: string | null;
  priceUSD: number | null;
  activatedAt: string | null;
  isExpired: boolean;
  cancelAtPeriodEnd: boolean;
}

export function useSubscriptionStatus(customEntityId?: string | null): SubscriptionData & { loading: boolean } {
  const { currentUser, activeEntity } = useAuth();
  const entity = customEntityId !== undefined ? customEntityId : activeEntity;
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData>({
    status: null,
    plan: null,
    expiresAt: null,
    priceUSD: null,
    activatedAt: null,
    isExpired: false,
    cancelAtPeriodEnd: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSubscription = async () => {
      if (!currentUser) {
        setLoading(false);
        return;
      }

      const targetEntity = entity && entity !== 'default' ? entity : null;
      const subscriptionRef = doc(
        db,
        targetEntity
          ? `users/${currentUser.uid}/entities/${targetEntity}/subscriptions/current`
          : `users/${currentUser.uid}/subscriptions/current`
      );

      try {
        // 1. Check subscription state for the specific entity
        const snapshot = await getSubscriptionSnapshot(currentUser.uid, targetEntity);
        let data = snapshot?.exists() ? (snapshot.data() as Record<string, any>) : null;
        let isExpired = false;
        let normalizedPlan: string | null = null;

        if (data) {
          const expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
          isExpired = expiresAt ? expiresAt < new Date() : false;
          normalizedPlan = normalizePlanId(data.plan, data.priceUSD || null);
        }

        const isActive = data && data.status === 'active' && !isExpired;

        // 2. If NOT active, run server recovery then check payment requests on-chain
        if (!isActive) {
          try {
            await fetch('/api/subscriptions/recover', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: currentUser.uid,
                entityId: targetEntity,
              }),
            });
            const recoveredSnap = await getDoc(subscriptionRef);
            if (recoveredSnap.exists() && recoveredSnap.data()?.status === 'active') {
              const recovered = recoveredSnap.data() as Record<string, any>;
              const expiresAt = recovered.expiresAt ? new Date(recovered.expiresAt) : null;
              const recoveredExpired = expiresAt ? expiresAt < new Date() : false;
              if (!recoveredExpired) {
                setSubscriptionData({
                  status: 'active',
                  plan: normalizePlanId(recovered.plan, recovered.priceUSD || null),
                  expiresAt: recovered.expiresAt || null,
                  priceUSD: typeof recovered.priceUSD === 'number' ? recovered.priceUSD : null,
                  activatedAt: recovered.activatedAt || null,
                  isExpired: false,
                  cancelAtPeriodEnd: !!recovered.cancelAtPeriodEnd,
                });
                setLoading(false);
                return;
              }
            }
          } catch (recoverErr) {
            console.error('Subscription recover API failed:', recoverErr);
          }

          const requestsRef = collection(db, `users/${currentUser.uid}/paymentRequests`);
          const q = query(requestsRef, where('status', 'in', ['pending', 'expired']));
          const requestsSnap = await getDocs(q);

          if (!requestsSnap.empty) {
            const conn = new Connection(SUBSCRIPTION_RPC_URL, 'confirmed');

            for (const reqDoc of requestsSnap.docs) {
              const req = reqDoc.data();
              if (!req.reference) continue;

              try {
                // Fetch signatures for this single-use reference key on the blockchain
                const signatures = await conn.getSignaturesForAddress(new PublicKey(req.reference), { limit: 5 });

                for (const sigInfo of signatures) {
                  if (sigInfo.err) continue;

                  // Fetch parsed transaction details
                  const tx = await conn.getParsedTransaction(sigInfo.signature, {
                    commitment: 'confirmed',
                    maxSupportedTransactionVersion: 0,
                  });

                  if (tx && !tx.meta?.err) {
                    const outerInstructions = tx.transaction.message.instructions || [];
                    const innerInstructions = (tx.meta?.innerInstructions || []).flatMap((group: any) => group.instructions || []);
                    const instructions = [...outerInstructions, ...innerInstructions];

                    const expectedRaw = String(req.expectedAmountRaw);
                    const treasury = SUBSCRIPTION_TREASURY_WALLET;
                    let matches = false;

                    if (req.paymentMethod === 'sol') {
                      matches = instructions.some((inst: any) => {
                        if (inst.program === 'system') {
                          const parsed = inst.parsed;
                          return (
                            parsed?.type === 'transfer' &&
                            String(parsed?.info?.destination) === treasury &&
                            String(parsed?.info?.lamports) === expectedRaw
                          );
                        }
                        return false;
                      });
                    } else {
                      // SPL Tokens (USDC, USDT, LXR)
                      const tokenMint = req.tokenMint;
                      let recipientAta: string | null = null;
                      if (tokenMint) {
                        try {
                          recipientAta = getAssociatedTokenAddressSync(
                            new PublicKey(tokenMint),
                            new PublicKey(treasury),
                            true
                          ).toBase58();
                        } catch (e) {
                          console.error('Error calculating recipient ATA in background listener:', e);
                        }
                      }

                      matches = instructions.some((inst: any) => {
                        if (inst.program === 'spl-token' || inst.program === 'spl-token-2022') {
                          const parsed = inst.parsed;
                          if (parsed && (parsed.type === 'transfer' || parsed.type === 'transferChecked')) {
                            const rawAmount =
                              parsed.info?.tokenAmount?.amount ||
                              parsed.info?.amount ||
                              parsed.info?.tokenAmount?.uiAmountString;
                            
                            const destinationMatches = !recipientAta || String(parsed.info?.destination) === recipientAta;
                            const mintMatches = !tokenMint || !parsed.info?.mint || String(parsed.info.mint) === tokenMint;

                            return String(rawAmount) === expectedRaw && destinationMatches && mintMatches;
                          }
                        }
                        return false;
                      });
                    }

                    if (matches) {
                      const paidAtIso = new Date().toISOString();
                      const expiresAt = new Date();
                      expiresAt.setDate(expiresAt.getDate() + 30);

                      // Update payment request to paid
                      await setDoc(reqDoc.ref, {
                        status: 'paid',
                        paymentSignature: sigInfo.signature,
                        paidAt: paidAtIso,
                        updatedAt: paidAtIso,
                      }, { merge: true });

                      // Save subscription!
                      const newSubscriptionData = {
                        status: 'active',
                        plan: req.plan,
                        priceUSD: req.planPriceUSD,
                        paymentMethod: req.paymentMethod,
                        paymentSignature: sigInfo.signature,
                        activatedAt: paidAtIso,
                        expiresAt: expiresAt.toISOString(),
                        updatedAt: paidAtIso,
                        billing: req.billingData || null,
                      };

                      await setDoc(subscriptionRef, newSubscriptionData, { merge: true });

                      // Update state immediately
                      setSubscriptionData({
                        status: 'active',
                        plan: normalizePlanId(req.plan, req.planPriceUSD),
                        expiresAt: expiresAt.toISOString(),
                        priceUSD: typeof req.planPriceUSD === 'number' ? req.planPriceUSD : null,
                        activatedAt: paidAtIso,
                        isExpired: false,
                        cancelAtPeriodEnd: false,
                      });
                      setLoading(false);
                      return; // Exit immediately since subscription is verified and active!
                    }
                  }
                }
              } catch (err) {
                console.error(`Error verifying payment request ${reqDoc.id}:`, err);
              }
            }
          }
        }

        // 3. Fallback to reading the subscription directly if no background updates occurred
        if (isActive) {
          setSubscriptionData({
            status: data.status || null,
            plan: normalizedPlan,
            expiresAt: data.expiresAt || null,
            priceUSD: typeof data.priceUSD === 'number' ? data.priceUSD : null,
            activatedAt: data.activatedAt || null,
            isExpired,
            cancelAtPeriodEnd: !!data.cancelAtPeriodEnd,
          });
        } else {
          setSubscriptionData({
            status: null,
            plan: null,
            expiresAt: null,
            priceUSD: null,
            activatedAt: null,
            isExpired: false,
            cancelAtPeriodEnd: false,
          });
        }
      } catch (error) {
        console.error('Error checking subscription:', error);
        setSubscriptionData({
          status: null,
          plan: null,
          expiresAt: null,
          priceUSD: null,
          activatedAt: null,
          isExpired: false,
          cancelAtPeriodEnd: false,
        });
      } finally {
        setLoading(false);
      }
    };

    checkSubscription();
  }, [currentUser, entity]);

  return { ...subscriptionData, loading };
}
