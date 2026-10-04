import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '@/lib/firebase-admin';
import { getSubscriptionCurrentDocPath } from '@/lib/subscriptions/payment-config';
import { PLAN_CATALOG_USD } from '@/lib/subscriptions/upgrade-pricing';

// Ruta pública por diseño: la autenticidad se valida con la firma de Stripe.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

async function activateFromPaymentIntent(pi: Stripe.PaymentIntent) {
  const { userId, entityId, plan, netAmount } = pi.metadata || {};
  // Solo procesamos los cobros creados por /subscriptions/stripe-intent
  if (!userId || !plan) return;
  // Solo planes con precio de catálogo (un plan arbitrario en la metadata no activa nada).
  if (!PLAN_CATALOG_USD[String(plan).toLowerCase()]) return;

  const ref = db.doc(getSubscriptionCurrentDocPath(userId, entityId || 'default'));
  const snap = await ref.get();
  // Idempotencia: si /activate (o un reintento del webhook) ya lo registró, no duplicar.
  if (snap.exists && snap.data()?.stripePaymentIntentId === pi.id && snap.data()?.status === 'active') return;

  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + 30);

  await ref.set(
    {
      status: 'active',
      plan,
      priceUSD: Number(netAmount) || pi.amount / 100,
      paymentMethod: 'card_stripe',
      stripePaymentIntentId: pi.id,
      stripeCustomerId: typeof pi.customer === 'string' ? pi.customer : pi.customer?.id ?? null,
      stripePaymentMethodId: typeof pi.payment_method === 'string' ? pi.payment_method : pi.payment_method?.id ?? null,
      recurring: true,
      activatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      updatedAt: now.toISOString(),
      cancelAtPeriodEnd: false,
      cancelledAt: null,
    },
    { merge: true }
  );
}

async function markPaymentIssue(pi: Stripe.PaymentIntent, status: 'past_due' | 'refunded') {
  const { userId, entityId } = pi.metadata || {};
  if (!userId) return;
  const ref = db.doc(getSubscriptionCurrentDocPath(userId, entityId || 'default'));
  const snap = await ref.get();
  // Solo tocar la suscripción si corresponde a este mismo cobro
  if (!snap.exists || snap.data()?.stripePaymentIntentId !== pi.id) return;
  await ref.set({ status, updatedAt: new Date().toISOString() }, { merge: true });
}

export async function POST(request: NextRequest) {
  if (!stripeSecretKey || !webhookSecret) {
    return NextResponse.json({ error: 'Stripe webhook no configurado' }, { status: 503 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Falta la firma' }, { status: 400 });
  }

  const stripe = new Stripe(stripeSecretKey);
  let event: Stripe.Event;
  try {
    // Se necesita el cuerpo crudo para verificar la firma
    const rawBody = await request.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err: any) {
    console.warn('[stripe-webhook] firma inválida:', err.message);
    return NextResponse.json({ error: 'Firma inválida' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await activateFromPaymentIntent(event.data.object as Stripe.PaymentIntent);
        break;
      case 'payment_intent.payment_failed':
        await markPaymentIssue(event.data.object as Stripe.PaymentIntent, 'past_due');
        break;
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        if (charge.payment_intent) {
          const pi = await stripe.paymentIntents.retrieve(
            typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent.id
          );
          await markPaymentIssue(pi, 'refunded');
        }
        break;
      }
      default:
        break; // eventos no suscritos: ack
    }
    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('[stripe-webhook] error procesando', event.type, err);
    // 500 para que Stripe reintente
    return NextResponse.json({ error: 'Error procesando evento' }, { status: 500 });
  }
}
