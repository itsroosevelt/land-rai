import { NextResponse } from 'next/server';
import { db, admin } from '@/lib/firebase-admin';
import axios from 'axios';
import { getGmailAccessToken } from '@/lib/googleAuth';
import { processChatbotFlow } from '@/lib/chatbotEngine';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const message = body.message;

        if (!message || !message.data) {
            return NextResponse.json({ success: true, ignored: 'no_data' });
        }

        // 1. Decode Pub/Sub Data
        const decodedData = JSON.parse(Buffer.from(message.data, 'base64').toString());
        const emailAddress = decodedData.emailAddress;
        
        console.log(`[Gmail Webhook] Notification for ${emailAddress}`);

        // 2. Identify Tenant
        const tenantSnap = await db.collectionGroup('integrations')
            .where('gmailAddress', '==', emailAddress)
            .limit(1)
            .get();

        if (tenantSnap.empty) return NextResponse.json({ success: false, error: 'Tenant not found' });

        const pathParts = tenantSnap.docs[0].ref.path.split('/');
        const userId = pathParts[1];
        const entityId = pathParts[3];
        const entityPath = `users/${userId}/entities/${entityId}`;

        // 3. Fetch Latest Email
        const accessToken = await getGmailAccessToken(userId, entityId);
        const listRes = await axios.get(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=1&q=is:unread`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        if (!listRes.data.messages || listRes.data.messages.length === 0) {
            return NextResponse.json({ success: true });
        }

        const msgId = listRes.data.messages[0].id;
        const msgRes = await axios.get(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        const msgData = msgRes.data;
        const fromHeader = msgData.payload.headers.find((h: any) => h.name === 'From')?.value || '';
        const subject = msgData.payload.headers.find((h: any) => h.name === 'Subject')?.value || '';
        const bodySnippet = msgData.snippet || '';

        // Extract clean email from "Name <email@gmail.com>"
        const fromEmail = fromHeader.includes('<') ? fromHeader.match(/<(.*)>/)?.[1] : fromHeader;

        if (!fromEmail) return NextResponse.json({ success: true });

        // 4. CRM Integration (Find or Create Card)
        // Similar logic to WhatsApp/Meta webhooks
        // (Simplified for this boilerplate)
        
        // Trigger Chatbot
        // Here we would find/create the card and then:
        /*
        processChatbotFlow({
            userId, entityId, groupId, cardId, platform: 'gmail', from: fromEmail, text: bodySnippet
        });
        */

        return NextResponse.json({ success: true });

    } catch (err: any) {
        console.error('[Gmail Webhook Error]', err.message);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
