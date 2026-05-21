import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { getSubscriptionCurrentDocPath } from '@/lib/subscriptions/payment-config';
import { verifySubscriptionTransaction } from '@/lib/subscriptions/verify-payment';
import type { SubscriptionPaymentMethod } from '@/lib/subscriptions/payment-config';

export async function POST(request: NextRequest) {
  try {
    const { signature, plan, paymentMethod, userId, entityId, planPrice, billingData } = await request.json();

    if (!signature || !plan || !paymentMethod || !userId || !entityId || !planPrice) {
      return NextResponse.json(
        { error: 'Missing required fields (signature, plan, paymentMethod, userId, entityId, planPrice)' },
        { status: 400 }
      );
    }

    const verification = await verifySubscriptionTransaction(
      signature,
      paymentMethod as SubscriptionPaymentMethod
    );

    if (!verification.ok) {
      return NextResponse.json({ error: verification.error }, { status: 400 });
    }

    // Calculate expiration date (30 days from now)
    const activatedAt = new Date().toISOString();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Save subscription to Firestore (respecting global user-level structure)
    await db.doc(getSubscriptionCurrentDocPath(userId, entityId)).set(
      {
        status: 'active',
        plan: plan,
        priceUSD: planPrice,
        paymentMethod: paymentMethod,
        paymentSignature: signature,
        activatedAt: activatedAt,
        expiresAt: expiresAt.toISOString(),
        updatedAt: activatedAt,
        cancelAtPeriodEnd: false,
        cancelledAt: null,
        ...(billingData && { billing: billingData }),
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      message: 'Subscription activated successfully',
      subscription: {
        status: 'active',
        plan: plan,
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[API] subscriptions/verify error:', error);
    return NextResponse.json(
      { error: error.message || 'Error verifying subscription' },
      { status: 500 }
    );
  }
}
