import { NextRequest, NextResponse } from 'next/server';

// TODO: Stripe integration - configure after setting STRIPE_SECRET_KEY env var
export async function POST(request: NextRequest) {
  return NextResponse.json(
    { error: 'Stripe integration not configured yet. Add STRIPE_SECRET_KEY to .env.local' },
    { status: 503 }
  );
}
