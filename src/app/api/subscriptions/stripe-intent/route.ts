import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { guardApi } from '@/lib/apiAuth';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

export async function POST(request: NextRequest) {
    const denied = await guardApi(request);
    if (denied) return denied;
  try {
    if (!stripeSecretKey) {
      return NextResponse.json(
        { error: 'STRIPE_SECRET_KEY is not configured in .env.local' },
        { status: 500 }
      );
    }

    const stripe = new Stripe(stripeSecretKey);
    const body = await request.json();
    const { plan, userId, entityId, priceUSD, planName, email } = body;

    if (!plan || !userId || !priceUSD) {
      return NextResponse.json(
        { error: 'Missing required parameters: plan, userId, priceUSD' },
        { status: 400 }
      );
    }

    // Calcular monto total cobrado al cliente incluyendo la comisión de Stripe (2.9% + $0.30)
    // Para que la plataforma reciba exactamente priceUSD neto: gross = (net + 0.30) / (1 - 0.029)
    const netAmount = Number(priceUSD);
    const grossAmount = Math.round(((netAmount + 0.30) / (1 - 0.029)) * 100) / 100;
    const stripeFee = Math.round((grossAmount - netAmount) * 100) / 100;
    const amountInCents = Math.round(grossAmount * 100);

    // Buscar o crear cliente en Stripe
    let customerId: string | undefined;
    if (email) {
      const existingCustomers = await stripe.customers.list({ email: email.toLowerCase(), limit: 1 });
      if (existingCustomers.data.length > 0) {
        customerId = existingCustomers.data[0].id;
      } else {
        const newCustomer = await stripe.customers.create({
          email: email.toLowerCase(),
          metadata: {
            userId: String(userId),
            entityId: String(entityId || 'default'),
          },
        });
        customerId = newCustomer.id;
      }
    }

    // Crear PaymentIntent con setup_future_usage para pagos recurrentes
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      customer: customerId,
      setup_future_usage: 'off_session', // Habilita cobros recurrentes automáticos
      metadata: {
        userId: String(userId),
        entityId: String(entityId || 'default'),
        plan: String(plan),
        planName: String(planName || plan),
        netAmount: String(netAmount),
        stripeFee: String(stripeFee),
        grossAmount: String(grossAmount),
        isRecurring: 'true',
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      grossAmount,
      netAmount,
      stripeFee,
    });
  } catch (error: any) {
    console.error('[API] /subscriptions/stripe-intent error:', error);
    return NextResponse.json(
      { error: error.message || 'Error creating Stripe payment intent' },
      { status: 500 }
    );
  }
}
