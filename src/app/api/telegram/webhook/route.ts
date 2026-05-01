import { NextResponse } from 'next/server';
import { db, admin } from '@/lib/firebase-admin';
import { processChatbotFlow } from '@/lib/chatbotEngine';

export async function POST(req: Request) {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('u');
    const entityId = searchParams.get('e');

    try {
        const body = await req.json();
        const isCallback = !!body.callback_query;
        const msg = isCallback ? body.callback_query.message : body.message;
        
        if (!msg && !isCallback) return NextResponse.json({ ok: true });

        const { chat, from, message_id } = msg || {};
        const chatId = String(body.callback_query?.from?.id || chat?.id);
        const text = isCallback ? body.callback_query.data : body.message.text;
        const messageId = String(isCallback ? `cb_${body.callback_query.id}` : (message_id || Date.now()));

        if (!userId || !entityId) {
            console.error('[Telegram] Webhook received without u/e context');
            return NextResponse.json({ ok: true });
        }

        const entityPath = `users/${userId}/entities/${entityId}`;
        
        // 1. Validate Integration (Isolated)
        const integrationRef = db.doc(`${entityPath}/integrations/telegram`);
        const integrationSnap = await integrationRef.get();

        if (!integrationSnap.exists) {
            return NextResponse.json({ ok: true });
        }

        const integrationData = integrationSnap.data();
        if (integrationData?.status !== 'Connected') {
            return NextResponse.json({ ok: true });
        }

        // 2. Find or Create Contact/Card
        const contactSnap = await db.collection(`${entityPath}/contacts`)
            .where('telegramChatId', '==', chatId)
            .get();

        let cardId = '';
        let groupId = '';
        const user = body.callback_query?.from || body.message?.from || {};
        const contactName = user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : `Telegram User ${chatId.slice(-4)}`;

        if (!contactSnap.empty) {
            const contactData = contactSnap.docs[0].data();
            cardId = contactData.kanbanCardId;
            groupId = contactData.kanbanGroupId;
        }

        const newMessage = {
            sender: 'user',
            text: text || (isCallback ? '[Botón]' : '[Mensaje de Telegram]'),
            timestamp: new Date(),
            platform: 'telegram',
            messageId: messageId
        };

        const queueItem = {
            text: text || '',
            from: chatId,
            platform: 'telegram',
            timestamp: Date.now(),
            messageId: messageId
        };

        if (cardId && groupId) {
            // Update existing card
            await db.doc(`${entityPath}/kanban-groups/${groupId}/cards/${cardId}`).update({
                messages: admin.firestore.FieldValue.arrayUnion(newMessage),
                updatedAt: new Date(),
                lastMessage: text || '[Telegram]',
                unreadCount: admin.firestore.FieldValue.increment(1),
                'botState.messageQueue': admin.firestore.FieldValue.arrayUnion(queueItem)
            });
        } else {
            // Create new Lead Capture
            const groupsRef = db.collection(`${entityPath}/kanban-groups`);
            const groupsSnap = await groupsRef.get();
            const inboxGroup = groupsSnap.docs.find(g => 
                (g.data().name || '').toLowerCase().includes('inbox') || 
                (g.data().name || '').toLowerCase().includes('entrada')
            );

            groupId = inboxGroup ? inboxGroup.id : (groupsSnap.empty ? 'incoming' : groupsSnap.docs[0].id);
            
            if (groupsSnap.empty) {
                await groupsRef.doc(groupId).set({ name: 'Inbox', order: 0, createdAt: admin.firestore.FieldValue.serverTimestamp() });
            }

            const cardRef = db.collection(`${entityPath}/kanban-groups/${groupId}/cards`).doc();
            cardId = cardRef.id;

            await cardRef.set({
                id: cardId,
                contactName,
                lastMessage: text || '[Telegram]',
                updatedAt: new Date(),
                createdAt: new Date(),
                messages: [newMessage],
                unreadCount: 1,
                status: 'open',
                source: 'TELEGRAM',
                channel: 'telegram',
                'botState': {
                    status: 'active',
                    messageQueue: [queueItem],
                    waitingForInput: false,
                    currentNodeId: null
                },
                platform_ids: { telegram: chatId }
            });

            // Sync with Contacts
            await db.collection(`${entityPath}/contacts`).add({
                name: contactName,
                telegramChatId: chatId,
                kanbanCardId: cardId,
                kanbanGroupId: groupId,
                createdAt: new Date()
            });
        }

        // 3. Trigger Chatbot
        if (cardId && groupId) {
            await processChatbotFlow({
                userId, entityId, groupId, cardId, 
                platform: 'telegram', from: chatId, text: text || '',
                messageId: messageId
            }).catch(console.error);
        }

        // 4. Acknowledge Callback (Crucial for Telegram UX)
        if (isCallback && integrationData.botToken) {
            fetch(`https://api.telegram.org/bot${integrationData.botToken}/answerCallbackQuery?callback_query_id=${body.callback_query.id}`).catch(() => {});
        }

        return NextResponse.json({ ok: true });
    } catch (error: any) {
        console.error('[Telegram Webhook Error]', error);
        return NextResponse.json({ ok: true });
    }
}
