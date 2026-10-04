import { Keypair } from '@solana/web3.js';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import {
  getSubscriptionPaymentRequestsCollectionPath,
  SUBSCRIPTION_TREASURY_WALLET,
  type SubscriptionPaymentMethod,
} from '@/lib/subscriptions/payment-config';
import { encodeSolanaPayUrl } from '@/lib/subscriptions/solana-pay';
import { validatePaymentOrderPayload } from '@/lib/subscriptions/qr-payment';
import { SUBSCRIPTION_QR_EXPIRATION_MINUTES } from '@/lib/subscriptions/payment-config';
import {
  assertClientChargeMatchesServer,
  resolveUpgradeChargeForUser,
} from '@/lib/subscriptions/upgrade-pricing-server';
import { PLAN_CATALOG_USD, PLAN_CATALOG_ANNUAL_USD } from '@/lib/subscriptions/upgrade-pricing';
import { guardApi } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    const denied = await guardApi(request);
    if (denied) return denied;
  try {
    const {
      userId,
      entityId,
      plan,
      paymentMethod,
      planPriceUSD,
      chargeUSD,
      expectedAmountUi,
      expectedAmountRaw,
      billingData,
    } = await request.json();

    if (!userId || !entityId || !plan || !paymentMethod || !expectedAmountUi || !expectedAmountRaw) {
      return NextResponse.json(
        { error: 'Missing required fields (userId, entityId, plan, paymentMethod, expectedAmountUi, expectedAmountRaw)' },
        { status: 400 }
      );
    }

    const planKey = String(plan).toLowerCase();
    const catalogPlanPriceUSD = PLAN_CATALOG_USD[planKey];
    if (!catalogPlanPriceUSD) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    const useLxr = paymentMethod === 'lxr';
    const resolved = await resolveUpgradeChargeForUser({
      userId,
      targetPlanId: planKey,
      useLxr,
    });

    const resolvedPriceUSD = resolved.hasActive ? resolved.chargeUSD : catalogPlanPriceUSD;
    const clientChargeUSD =
      typeof chargeUSD === 'number' ? chargeUSD : Number(chargeUSD ?? planPriceUSD ?? resolvedPriceUSD);

    // Support both monthly and annual cycles on validation
    const serverMonthlyChargeUSD = resolvedPriceUSD;
    const serverAnnualChargeUSD = PLAN_CATALOG_ANNUAL_USD[planKey] ?? resolvedPriceUSD;

    const matchesMonthly = assertClientChargeMatchesServer(clientChargeUSD, serverMonthlyChargeUSD);
    const matchesAnnual = assertClientChargeMatchesServer(clientChargeUSD, serverAnnualChargeUSD);

    if (!matchesMonthly && !matchesAnnual) {
      return NextResponse.json(
        {
          error: 'Charge amount mismatch. Refresh checkout and try again.',
          expectedChargeUSD: serverMonthlyChargeUSD,
        },
        { status: 400 }
      );
    }

    const serverChargeUSD = matchesAnnual ? serverAnnualChargeUSD : serverMonthlyChargeUSD;

    if (serverChargeUSD <= 0) {
      return NextResponse.json(
        { error: 'No payment required. Use upgrade endpoint.', chargeUSD: 0 },
        { status: 400 }
      );
    }

    const config = validatePaymentOrderPayload({
      paymentMethod: paymentMethod as SubscriptionPaymentMethod,
      expectedAmountRaw: String(expectedAmountRaw),
      expectedAmountUi: String(expectedAmountUi),
    });

    const collectionPath = getSubscriptionPaymentRequestsCollectionPath(userId, entityId);
    const requestId = db.collection(collectionPath).doc().id;
    const reference = Keypair.generate().publicKey.toBase58();
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + SUBSCRIPTION_QR_EXPIRATION_MINUTES * 60 * 1000);

    const qrUrl = encodeSolanaPayUrl({
      recipient: SUBSCRIPTION_TREASURY_WALLET,
      amount: String(expectedAmountUi),
      splToken: config.mint,
      reference,
      label: `Roosevelt ${String(plan).toUpperCase()} Subscription`,
      message: 'Scan with Phantom to complete your subscription payment',
      memo: `subscription:${requestId}`,
    });

    await db.doc(`${collectionPath}/${requestId}`).set({
      requestId,
      userId,
      entityId,
      plan,
      paymentMethod,
      recipientWallet: SUBSCRIPTION_TREASURY_WALLET,
      reference,
      status: 'pending',
      qrUrl,
      planPriceUSD: catalogPlanPriceUSD,
      chargeUSD: serverChargeUSD,
      priorCreditUSD:
        resolved.hasActive && resolved.quote ? resolved.quote.unusedCreditUSD : 0,
      isUpgrade: resolved.hasActive,
      priorPlan: resolved.hasActive ? resolved.currentPlan : null,
      expectedAmountUi: String(expectedAmountUi),
      expectedAmountRaw: String(expectedAmountRaw),
      tokenDecimals: config.decimals,
      tokenMint: config.mint,
      billingData: billingData || null,
      createdAt: createdAt.toISOString(),
      updatedAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    });

    return NextResponse.json({
      requestId,
      reference,
      qrUrl,
      recipientWallet: SUBSCRIPTION_TREASURY_WALLET,
      expiresAt: expiresAt.toISOString(),
      status: 'pending',
    });
  } catch (error: any) {
    console.error('[API] subscriptions/qr/create error:', error);
    return NextResponse.json(
      { error: error.message || 'Unable to create subscription payment QR' },
      { status: 500 }
    );
  }
}
