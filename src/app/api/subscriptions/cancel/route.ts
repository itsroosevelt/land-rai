import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { getSubscriptionCurrentDocPath } from '@/lib/subscriptions/payment-config';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const ref = db.doc(getSubscriptionCurrentDocPath(userId));
    const snap = await ref.get();

    if (!snap.exists) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 404 });
    }

    const data = snap.data();
    if (data?.status !== 'active') {
      return NextResponse.json({ error: 'Subscription is not active' }, { status: 400 });
    }

    const expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
    if (expiresAt && expiresAt.getTime() <= Date.now()) {
      return NextResponse.json({ error: 'Subscription already expired' }, { status: 400 });
    }

    if (data.cancelAtPeriodEnd === true) {
      return NextResponse.json({
        success: true,
        alreadyCancelled: true,
        expiresAt: data.expiresAt,
        message: 'Renewal was already cancelled for this period.',
      });
    }

    const now = new Date().toISOString();
    await ref.set(
      {
        cancelAtPeriodEnd: true,
        cancelledAt: now,
        updatedAt: now,
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      expiresAt: data.expiresAt,
      message:
        'Renewal cancelled. You keep access until the end of the paid period. Blockchain payments are not refunded.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to cancel subscription';
    console.error('[API] subscriptions/cancel error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
