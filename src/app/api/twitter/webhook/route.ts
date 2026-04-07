import { NextResponse } from 'next/server';

export async function GET(req: Request) {
    return new Response('Twitter Webhook Placeholder Active', { status: 200 });
}

export async function POST(req: Request) {
    // Twitter implementation coming soon
    return NextResponse.json({ success: true, status: 'coming_soon' });
}
