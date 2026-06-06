import { NextResponse } from 'next/server';
import { db, admin } from '@/lib/firebase-admin';
import { processChatbotFlow } from '@/lib/chatbotEngine';
import { buildBotQueueItem, createQueuedBotState, isDuplicateQueueMessage } from '@/lib/botQueue';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * GET: Twitter CRC (Challenge-Response Check)
 * Required for Twitter Account Activity API validation.
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const crc_token = searchParams.get('crc_token');

    if (crc_token) {
        const consumer_secret = process.env.TWITTER_CONSUMER_SECRET || '';
        if (!consumer_secret) {
            console.warn('[Twitter Webhook] TWITTER_CONSUMER_SECRET is missing. CRC will fail.');
        }

        const hmac = crypto.createHmac('sha256', consumer_secret).update(crc_token).digest('base64');
        const response_token = `sha256=${hmac}`;

        return NextResponse.json({ response_token });
    }

    return new Response('Twitter Webhook Active', { status: 200 });
}

/**
 * POST: Ingest incoming DM events
 */
export async function POST(req: Request) {
    console.log('[Twitter Webhook] INCOMING EVENT');

    try {
        const body = await req.json();

        // 1. Validate if it's a DM event
        if (!body.direct_message_events || body.direct_message_events.length === 0) {
            return NextResponse.json({ success: true, ignored: 'no_dm_events' });
        }

        const event = body.direct_message_events[0];
        if (event.type !== 'message_create') {
            return NextResponse.json({ success: true, ignored: 'not_message_create' });
        }

        const messageData = event.message_create;
        const senderId = messageData.sender_id;
        const recipientId = messageData.target.recipient_id; // This is OUR account ID
        const text = messageData.message_data.text;

        // Skip if it's an echo (message sent by us)
        // Note: Body often contains 'for_user_id' which is our ID
        if (senderId === body.for_user_id) {
            return NextResponse.json({ success: true, ignored: 'echo' });
        }

        console.log(`[Twitter Webhook] DM from ${senderId}: ${text}`);

        // 2. Identify Tenant (Multi-Tenant Logic)
        let tenantRef: admin.firestore.DocumentReference | null = null;
        let tenantData: any = null;

        const integrationSnap = await db.collectionGroup('integrations')
            .where('provider', '==', 'x_twitter')
            .get();

        // Search for the integration that matches the 'for_user_id' (our account)
        for (const doc of integrationSnap.docs) {
            const data = doc.data();
            if (data.twitterUserId === body.for_user_id || data.twitterHandle === body.user?.screen_name) {
                tenantRef = doc.ref;
                tenantData = data;
                break;
            }
        }

        // Fallback: If no match found, use the first active Twitter integration (emergency)
        if (!tenantRef) {
            const emergencySnap = integrationSnap.docs.find(d => d.data().status === 'Connected');
            if (emergencySnap) {
                tenantRef = emergencySnap.ref;
                tenantData = emergencySnap.data();
            }
        }

        if (!tenantRef) {
            console.error('[Twitter Webhook] No tenant found for X User ID:', body.for_user_id);
            return NextResponse.json({ success: false, error: 'Tenant not mapped' });
        }

        const pathParts = tenantRef.path.split('/');
        const userId = pathParts[pathParts.indexOf('users') + 1];
        const entityId = pathParts[pathParts.indexOf('entities') + 1];
        const entityPath = `users/${userId}/entities/${entityId}`;

        // 3. Message Deduplication
        const messageId = event.id;
        const dedupRef = db.doc(`${entityPath}/processed_messages/${messageId}`);
        const dedupSnap = await dedupRef.get();
        if (dedupSnap.exists) {
            return NextResponse.json({ success: true, duplicate: true });
        }
        await dedupRef.set({ timestamp: Date.now(), senderId, type: 'twitter_ingestion' });

        // 4. Ingest to Kanban / CRM
        let targetCardDoc: any = null;
        let targetGroupId: string | null = null;

        // Find existing card for this Twitter user
        const cardsSnap = await db.collectionGroup('cards')
            .where(`platform_ids.x_twitter`, '==', senderId)
            .get();
        
        const entityCard = cardsSnap.docs.find(d => d.ref.path.startsWith(entityPath));
        if (entityCard) {
            targetCardDoc = entityCard;
            const cardPathParts = targetCardDoc.ref.path.split('/');
            targetGroupId = cardPathParts[cardPathParts.indexOf('kanban-groups') + 1];
        }

        const resolvedName = body.users?.[senderId]?.name || `X User ${senderId.slice(-4)}`;
        const newMessage = {
            sender: 'user',
            text: text,
            timestamp: admin.firestore.Timestamp.now(),
            messageId: messageId,
            platform: 'x_twitter'
        };

        const queueItem = buildBotQueueItem({
            text: text,
            messageId: messageId || `x_${Date.now()}`,
            platform: 'x_twitter',
            from: senderId,
        });

        if (targetCardDoc && targetGroupId) {
            const alreadyQueued = isDuplicateQueueMessage(targetCardDoc.data(), messageId);
            const cardUpdate: Record<string, any> = {
                contactName: resolvedName,
                lastMessage: text.length > 50 ? text.substring(0, 47) + '...' : text,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                unreadCount: admin.firestore.FieldValue.increment(1),
                messages: admin.firestore.FieldValue.arrayUnion(newMessage),
                'botState.engine': 'queue',
                status: 'open',
                source: 'TWITTER',
                channel: 'twitter'
            };
            if (!alreadyQueued) {
                cardUpdate['botState.messageQueue'] = admin.firestore.FieldValue.arrayUnion(queueItem);
            }
            await targetCardDoc.ref.update(cardUpdate);
        } else {
            // Create New
            const groupsRef = db.collection(`${entityPath}/kanban-groups`);
            const groupsSnap = await groupsRef.get();
            const inboxGroup = groupsSnap.docs.find(g => (g.data().name || '').toLowerCase().includes('inbox') || (g.data().name || '').toLowerCase().includes('entrada'));
            const groupId = inboxGroup ? inboxGroup.id : (groupsSnap.empty ? 'default_inbox' : groupsSnap.docs[0].id);

            if (!inboxGroup && groupsSnap.empty) {
                await groupsRef.doc('default_inbox').set({ name: 'Inbox', order: 0, createdAt: admin.firestore.FieldValue.serverTimestamp() });
            }

            const newCardRef = db.collection(`${entityPath}/kanban-groups/${groupId}/cards`).doc();
            await newCardRef.set({
                id: newCardRef.id,
                contactName: resolvedName,
                contactNumber: senderId,
                lastMessage: text.length > 50 ? text.substring(0, 47) + '...' : text,
                updatedAt: admin.firestore.Timestamp.now(),
                createdAt: admin.firestore.Timestamp.now(),
                messages: [newMessage],
                botState: createQueuedBotState(queueItem),
                unreadCount: 1,
                status: 'open',
                source: 'TWITTER',
                channel: 'twitter',
                platform_ids: { x_twitter: senderId }
            });
            
            targetGroupId = groupId;
            targetCardDoc = { id: newCardRef.id, ref: newCardRef };
        }

        // 5. Trigger Chatbot
        if (targetGroupId && targetCardDoc) {
            await processChatbotFlow({
                userId, entityId, groupId: targetGroupId, cardId: targetCardDoc.id,
                platform: 'x_twitter', from: senderId, text: text, messageId: messageId
            });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[Twitter Webhook] Error:', error.message);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
