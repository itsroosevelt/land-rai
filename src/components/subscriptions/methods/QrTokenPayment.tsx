'use client';

import { useEffect, useMemo, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { QRCodeSVG } from 'qrcode.react';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { Connection, PublicKey } from '@solana/web3.js';
import { AlertCircle, CheckCircle2, Clock, Loader2, RefreshCw, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { usePriceFromJupiter } from '@/hooks/usePriceFromJupiter';
import { db } from '@/lib/firebase';
import { BillingData } from '../BillingForm';
import {
  getSubscriptionPaymentConfig,
  getSubscriptionCurrentDocPath,
  getSubscriptionPaymentRequestsCollectionPath,
  SUBSCRIPTION_RPC_URL,
  SUBSCRIPTION_TREASURY_WALLET,
  type SubscriptionPaymentMethod,
} from '@/lib/subscriptions/payment-config';

interface QrTokenPaymentProps {
  plan: string;
  priceUSD: number;
  catalogPriceUSD?: number;
  paymentMethod: SubscriptionPaymentMethod;
  isProcessing: boolean;
  setIsProcessing: (value: boolean) => void;
  onSuccess: () => void;
  userId: string;
  entityId: string;
  billingData: BillingData | null;
  isBillingValid: boolean;
  discountLabel?: string;
  isUpgrade?: boolean;
}

interface PaymentRequestState {
  requestId: string;
  qrUrl: string;
  expiresAt: string;
  reference: string;
  status: 'pending' | 'paid' | 'expired';
  paymentSignature?: string | null;
}

const connection = new Connection(SUBSCRIPTION_RPC_URL, 'confirmed');

function toUiAndRawAmount(value: number, decimals: number) {
  const fixed = value.toFixed(decimals);
  const [integerPart, decimalPart = ''] = fixed.split('.');
  const uiAmount = fixed.replace(/\.?0+$/, '');
  const rawAmount = `${integerPart}${decimalPart}`.replace(/^0+/, '') || '0';

  return { uiAmount, rawAmount };
}

export default function QrTokenPayment({
  plan,
  priceUSD,
  catalogPriceUSD,
  paymentMethod,
  isProcessing,
  setIsProcessing,
  onSuccess,
  userId,
  entityId,
  billingData,
  isBillingValid,
  discountLabel,
  isUpgrade = false,
}: QrTokenPaymentProps) {
  const config = useMemo(() => getSubscriptionPaymentConfig(paymentMethod), [paymentMethod]);
  const needsPriceFeed = paymentMethod !== 'usdc' && paymentMethod !== 'usdt';
  const priceMint = paymentMethod === 'sol' ? 'So11111111111111111111111111111111111111112' : config.mint;
  const { prices, loading: loadingPrice, secondsRemaining } = usePriceFromJupiter(
    needsPriceFeed && priceMint ? [priceMint] : [],
    60000 // Cache price for 60 seconds (1 minute) to reduce volatility and rate limits
  );
  const quotedTokenPrice = priceMint ? prices[priceMint] : 1;
  const isStable = paymentMethod === 'usdc' || paymentMethod === 'usdt';
  const paymentAmount = isStable ? priceUSD : quotedTokenPrice ? priceUSD / quotedTokenPrice : null;
  const preciseAmount = paymentAmount ? toUiAndRawAmount(paymentAmount, config.decimals) : null;

  const [paymentRequest, setPaymentRequest] = useState<PaymentRequestState | null>(null);
  const [secondsUntilExpiry, setSecondsUntilExpiry] = useState(0);
  const [lastGenerationKey, setLastGenerationKey] = useState<string | null>(null);

  useEffect(() => {
    if (!paymentRequest?.expiresAt) {
      setSecondsUntilExpiry(0);
      return;
    }

    const updateCountdown = () => {
      const remaining = Math.max(
        0,
        Math.ceil((new Date(paymentRequest.expiresAt).getTime() - Date.now()) / 1000)
      );
      setSecondsUntilExpiry(remaining);
    };

    updateCountdown();
    const intervalId = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(intervalId);
  }, [paymentRequest?.expiresAt]);

  const getPaymentRequestDocRef = (requestId: string) =>
    doc(db, `${getSubscriptionPaymentRequestsCollectionPath(userId, entityId)}/${requestId}`);

  const catalogUsd = catalogPriceUSD ?? priceUSD;

  const activateSubscription = async (signature: string, paidAtIso: string) => {
    const subRef = doc(db, getSubscriptionCurrentDocPath(userId, entityId));
    const existingSnap = isUpgrade ? await getDoc(subRef) : null;
    const existing = existingSnap?.exists() ? existingSnap.data() : null;

    let expiresAtIso: string;
    let activatedAtIso: string;

    if (isUpgrade && existing?.expiresAt) {
      expiresAtIso = String(existing.expiresAt);
      activatedAtIso = String(existing.activatedAt || paidAtIso);
    } else {
      const expiresAt = new Date(new Date(paidAtIso).getTime());
      expiresAt.setDate(expiresAt.getDate() + 30);
      expiresAtIso = expiresAt.toISOString();
      activatedAtIso = paidAtIso;
    }

    await setDoc(
      subRef,
      {
        status: 'active',
        plan,
        priceUSD: catalogUsd,
        paymentMethod,
        paymentSignature: signature,
        activatedAt: activatedAtIso,
        expiresAt: expiresAtIso,
        updatedAt: paidAtIso,
        cancelAtPeriodEnd: false,
        cancelledAt: null,
        billing: billingData || null,
      },
      { merge: true }
    );
  };

  const getAllInstructions = (transaction: any) => {
    const list: any[] = [];
    if (!transaction) return list;
    
    // Add outer instructions
    const outer = transaction?.transaction?.message?.instructions || [];
    outer.forEach((inst: any) => {
      list.push(inst);
    });

    // Add inner instructions
    const innerGroups = transaction?.meta?.innerInstructions || [];
    innerGroups.forEach((group: any) => {
      (group.instructions || []).forEach((inst: any) => {
        list.push(inst);
      });
    });

    return list;
  };

  const verifySolTransfer = (transaction: any) => {
    const instructions = getAllInstructions(transaction);

    return instructions.some((instruction: any) => {
      if (instruction.program !== 'system') {
        return false;
      }

      const parsed = instruction.parsed;
      return (
        parsed?.type === 'transfer' &&
        String(parsed?.info?.destination || '') === SUBSCRIPTION_TREASURY_WALLET &&
        String(parsed?.info?.lamports || '') === preciseAmount?.rawAmount
      );
    });
  };

  const verifySplTransfer = (transaction: any) => {
    if (!config.mint || !preciseAmount) {
      return false;
    }

    const recipientAta = getAssociatedTokenAddressSync(
      new PublicKey(config.mint),
      new PublicKey(SUBSCRIPTION_TREASURY_WALLET),
      true
    ).toBase58();

    const instructions = getAllInstructions(transaction);

    return instructions.some((instruction: any) => {
      if (instruction.program !== 'spl-token' && instruction.program !== 'spl-token-2022') {
        return false;
      }

      const parsed = instruction.parsed;
      if (!parsed || (parsed.type !== 'transfer' && parsed.type !== 'transferChecked')) {
        return false;
      }

      const rawAmount =
        parsed.info?.tokenAmount?.amount ||
        parsed.info?.amount ||
        parsed.info?.tokenAmount?.uiAmountString;

      const mint = parsed.info?.mint ? String(parsed.info.mint) : config.mint;

      return (
        String(parsed.info?.destination || '') === recipientAta &&
        mint === config.mint &&
        String(rawAmount || '') === preciseAmount.rawAmount
      );
    });
  };

  useEffect(() => {
    if (!paymentRequest?.requestId || paymentRequest.status !== 'pending') {
      return;
    }

    let cancelled = false;

    const pollServerStatus = async () => {
      const params = new URLSearchParams({
        userId,
        entityId,
        requestId: paymentRequest.requestId,
      });
      const response = await fetch(`/api/subscriptions/qr/status?${params.toString()}`);
      if (!response.ok) return null;
      return response.json() as Promise<{ status: string; paymentSignature?: string | null }>;
    };

    const pollStatus = async () => {
      try {
        const serverStatus = await pollServerStatus();
        if (serverStatus?.status === 'paid') {
          if (!cancelled) {
            setPaymentRequest((current) =>
              current ? { ...current, status: 'paid', paymentSignature: serverStatus.paymentSignature } : current
            );
            toast.success('Payment confirmed on Solana. Activating subscription...');
            onSuccess();
          }
          return;
        }

        if (Date.now() > new Date(paymentRequest.expiresAt).getTime()) {
          const recoverResponse = await fetch('/api/subscriptions/recover', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId,
              entityId,
              requestId: paymentRequest.requestId,
            }),
          });

          if (recoverResponse.ok) {
            const recoverData = await recoverResponse.json();
            if (recoverData.success) {
              if (!cancelled) {
                toast.success('Payment found and subscription activated.');
                onSuccess();
              }
              return;
            }
          }

          await setDoc(
            getPaymentRequestDocRef(paymentRequest.requestId),
            {
              status: 'expired',
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );

          if (!cancelled) {
            setPaymentRequest((current) =>
              current
                ? {
                    ...current,
                    status: 'expired',
                  }
                : current
            );
            toast.error('This QR code expired. Generate a new one to continue.');
          }
          return;
        }

        const signatures = await connection.getSignaturesForAddress(new PublicKey(paymentRequest.reference), {
          limit: 10,
        });

        for (const signatureInfo of signatures) {
          if (signatureInfo.err) {
            continue;
          }

          const transaction = await connection.getParsedTransaction(signatureInfo.signature, {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0,
          });

          if (!transaction || transaction.meta?.err) {
            continue;
          }

          const accountKeys = (transaction.transaction.message.accountKeys || []).map((entry: any) => {
            if (entry?.pubkey?.toBase58) {
              return entry.pubkey.toBase58();
            }
            if (entry?.toBase58) {
              return entry.toBase58();
            }
            return String(entry);
          });

          if (!accountKeys.includes(paymentRequest.reference)) {
            continue;
          }

          const matches =
            paymentMethod === 'sol' ? verifySolTransfer(transaction) : verifySplTransfer(transaction);

          if (!matches) {
            continue;
          }

          const paidAtIso = new Date().toISOString();
          await setDoc(
            getPaymentRequestDocRef(paymentRequest.requestId),
            {
              status: 'paid',
              paymentSignature: signatureInfo.signature,
              paidAt: paidAtIso,
              updatedAt: paidAtIso,
            },
            { merge: true }
          );

          await activateSubscription(signatureInfo.signature, paidAtIso);

          if (cancelled) {
            return;
          }

          setPaymentRequest((current) =>
            current
              ? {
                  ...current,
                  status: 'paid',
                  paymentSignature: signatureInfo.signature,
                }
              : current
          );

          toast.success('Payment confirmed on Solana. Activating subscription...');
          onSuccess();
          return;
        }
      } catch (error) {
        console.error('QR payment status polling failed:', error);
      }
    };

    pollStatus();
    const intervalId = window.setInterval(pollStatus, 10000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [entityId, onSuccess, paymentRequest?.requestId, paymentRequest?.status, userId]);

  const generationKey = useMemo(() => {
    if (!billingData || !isBillingValid || !preciseAmount) {
      return null;
    }

    return JSON.stringify({
      userId,
      entityId,
      plan,
      paymentMethod,
      amount: preciseAmount.uiAmount,
      email: billingData.email,
      fullName: billingData.fullName,
      zipCode: billingData.zipCode,
    });
  }, [billingData, entityId, isBillingValid, paymentMethod, plan, preciseAmount, userId]);

  const handleGenerateQr = async (auto = false) => {
    if (!billingData || !isBillingValid) {
      if (!auto) {
        toast.error('Complete your billing details first');
      }
      return;
    }

    if (!userId || !entityId) {
      if (!auto) {
        toast.error('Missing active account context. Reload and try again.');
      }
      return;
    }

    if (priceUSD <= 0) {
      if (!auto) {
        toast.error('No payment required for this upgrade');
      }
      return;
    }

    if (!preciseAmount) {
      if (!auto) {
        toast.error(`Unable to calculate the ${config.label} payment amount`);
      }
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch('/api/subscriptions/qr/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          entityId,
          plan,
          paymentMethod,
          planPriceUSD: catalogUsd,
          chargeUSD: priceUSD,
          expectedAmountUi: preciseAmount.uiAmount,
          expectedAmountRaw: preciseAmount.rawAmount,
          billingData: billingData || null,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || 'Unable to create payment QR on server');
      }

      const created = await response.json();

      setPaymentRequest({
        requestId: created.requestId,
        qrUrl: created.qrUrl,
        expiresAt: created.expiresAt,
        reference: created.reference,
        status: 'pending',
        paymentSignature: null,
      });
      if (generationKey) {
        setLastGenerationKey(generationKey);
      }

      if (!auto) {
        toast.success('Unique Phantom QR generated');
      }
    } catch (error: any) {
      console.error('QR generation error:', error);
      if (!auto) {
        toast.error(error?.message || 'Unable to generate payment QR');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    if (!generationKey || isProcessing) {
      return;
    }

    if (paymentRequest && paymentRequest.status !== 'expired' && lastGenerationKey === generationKey) {
      return;
    }

    if (lastGenerationKey === generationKey && paymentRequest?.status === 'expired') {
      return;
    }

    handleGenerateQr(true);
  }, [generationKey, isProcessing, lastGenerationKey, paymentRequest]);

  const showPriceLoader = needsPriceFeed && loadingPrice;

  return (
    <div className="space-y-3">
      {discountLabel ? (
        <div className="bg-green-600/10 border border-green-600/30 rounded-lg px-3 py-2 text-xs text-green-300">
          {discountLabel}
        </div>
      ) : null}

      {showPriceLoader ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-blue-500 mr-2" />
          <span className="text-sm text-white/60">Fetching {config.label} price...</span>
        </div>
      ) : preciseAmount ? (
        <>
          <div className="bg-blue-600/10 border border-blue-600/20 rounded-lg px-3 py-2.5 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            <p className="text-xs text-blue-300">
              {paymentMethod === 'usdc'
                ? 'Fixed amount in USDC'
                : `Market quote refreshed every ${secondsRemaining}s`}
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-lg p-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-white/60">Amount in USD</span>
              <span className="text-sm font-medium text-white">${priceUSD.toFixed(2)}</span>
            </div>
            <div className="h-px bg-white/10" />
            <div className="flex justify-between items-center">
              <span className="text-xs text-white/60 font-medium">Scan and pay</span>
              <span className="text-lg font-medium text-white">
                {preciseAmount.uiAmount} {config.label}
              </span>
            </div>
          </div>

          {paymentRequest ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white">QR ready</p>
                  <p className="text-[11px] text-white/50 mt-1 leading-4">
                    This code is bound to your active entity and this exact checkout session.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleGenerateQr(false)}
                  disabled={isProcessing}
                  className="h-8 px-3 text-[11px] text-white/70 hover:text-white hover:bg-white/10"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  Refresh
                </Button>
              </div>

              <div className="bg-white rounded-2xl p-3 flex justify-center">
                <QRCodeSVG value={paymentRequest.qrUrl} size={190} bgColor="#ffffff" fgColor="#111111" />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-black/20 p-2.5">
                  <p className="text-[11px] uppercase tracking-[0.25em] text-white/35">Status</p>
                  <div className="mt-1.5 flex items-center gap-2 text-xs text-white">
                    {paymentRequest.status === 'paid' ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                        Payment confirmed
                      </>
                    ) : paymentRequest.status === 'expired' ? (
                      <>
                        <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                        QR expired
                      </>
                    ) : (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                        Waiting for Phantom payment
                      </>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/20 p-2.5">
                  <p className="text-[11px] uppercase tracking-[0.25em] text-white/35">Expires</p>
                  <p className="mt-1.5 text-xs text-white">
                    {secondsUntilExpiry > 0 ? `${secondsUntilExpiry}s remaining` : 'Expired'}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-blue-600/20 bg-blue-600/10 p-3 space-y-1.5">
                <div className="flex items-center gap-2 text-blue-200">
                  <Smartphone className="w-3.5 h-3.5" />
                  <span className="text-xs font-semibold uppercase tracking-[0.18em]">Use Phantom mobile</span>
                </div>
                <p className="text-[11px] leading-4 text-blue-100/80">
                  Scan the QR from Phantom on your phone, approve the transaction, and we will verify it automatically.
                </p>
                <a
                  href={paymentRequest.qrUrl}
                  className="inline-flex text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-200 hover:text-white"
                >
                  Open payment link
                </a>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-4 space-y-3">
              <div className="bg-white rounded-2xl p-3 flex items-center justify-center min-h-[216px]">
                {isProcessing ? (
                  <div className="flex flex-col items-center gap-2 text-center">
                    <Loader2 className="w-5 h-5 animate-spin text-black" />
                    <p className="text-xs text-black/70">Generating your unique Phantom QR...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-center">
                    <Smartphone className="w-6 h-6 text-black/60" />
                    <p className="text-xs text-black/70">
                      {isBillingValid
                        ? 'Preparing your QR automatically...'
                        : 'Complete billing details to generate the QR'}
                    </p>
                  </div>
                )}
              </div>
              {!isBillingValid ? (
                <p className="text-[11px] text-white/55 leading-4">
                  The payment QR is created as soon as your billing details are complete.
                </p>
              ) : null}
            </div>
          )}

          {!isBillingValid && (
            <div className="flex items-center gap-2 p-2.5 bg-yellow-600/10 border border-yellow-600/30 rounded-lg">
              <AlertCircle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
              <p className="text-xs text-yellow-300">Complete billing details to continue</p>
            </div>
          )}
        </>
      ) : (
        <p className="text-center text-red-400 py-4">Error loading {config.label} price</p>
      )}
    </div>
  );
}
