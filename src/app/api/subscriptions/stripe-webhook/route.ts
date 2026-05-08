import { NextRequest, NextResponse } from 'next/server';

// TODO: Stripe webhook integration - configure after setting STRIPE_WEBHOOK_SECRET env var
export async function POST(request: NextRequest) {
  return NextResponse.json(
    { error: 'Stripe webhook not configured yet. Add STRIPE_WEBHOOK_SECRET to .env.local' },
    { status: 503 }
  );
}
