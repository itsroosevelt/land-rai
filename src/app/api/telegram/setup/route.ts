import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { botToken, userId, entityId, domain } = body;

        if (!userId || !entityId || !botToken) {
            return NextResponse.json({ success: false, error: `Missing context: u=${userId}, e=${entityId}, t=${!!botToken}` }, { status: 400 });
        }

        // Construct and ENCODE the webhook URL (Crucial for multi-tenant params)
        const webhookUrl = `https://${domain}/api/telegram/webhook?u=${userId}&e=${entityId}`;

        console.log(`[Telegram Setup] Registering webhook: ${webhookUrl}`);

        const response = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
        const data = await response.json();

        if (data.ok) {
            // Fetch Bot Info to get the username (Rule: Agnostic Brand)
            const meRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
            const meData = await meRes.json();
            const botName = meData.ok ? `@${meData.result.username}` : 'Telegram Bot';

            return NextResponse.json({ 
                success: true, 
                message: 'Webhook registered successfully', 
                botName,
                telegram: data 
            });
        } else {
            return NextResponse.json({ success: false, error: data.description || 'Failed to register webhook' }, { status: 400 });
        }
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
