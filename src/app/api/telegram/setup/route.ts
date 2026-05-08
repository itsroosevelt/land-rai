import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { botToken, userId, entityId, domain } = await req.json();

        if (!botToken || !userId || !entityId || !domain) {
            return NextResponse.json({ success: false, error: 'Missing parameters' }, { status: 400 });
        }

        // Construct the webhook URL with multi-tenant context (Agnostic Rule 4)
        const webhookUrl = `https://${domain}/api/telegram/webhook?u=${userId}&e=${entityId}`;

        console.log(`[Telegram Setup] Registering webhook: ${webhookUrl}`);

        const response = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook?url=${webhookUrl}`);
        const data = await response.json();

        if (data.ok) {
            return NextResponse.json({ success: true, message: 'Webhook registered successfully', telegram: data });
        } else {
            return NextResponse.json({ success: false, error: data.description || 'Failed to register webhook' }, { status: 400 });
        }
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
