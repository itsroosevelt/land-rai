import { NextResponse } from 'next/server';

export async function GET(req: Request) {
    return new Response('Telegram Webhook Placeholder Active', { status: 200 });
}

export async function POST(req: Request) {
    // Telegram implementation coming soon
    return NextResponse.json({ success: true, status: 'coming_soon' });
}
