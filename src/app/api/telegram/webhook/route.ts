import { NextResponse } from 'next/server';
import { db, admin } from '@/lib/firebase-admin';
import { processChatbotFlow } from '@/lib/chatbotEngine';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        if (!body.message) return NextResponse.json({ ok: true });

        const { chat, text, from, message_id } = body.message;
        const chatId = String(chat.id);

        // REVERSIÓN: Volver a buscar en la colección raíz 'telegram-integrations'
        const integrationSnap = await db.collectionGroup('telegram-integrations')
            .where('chatId', '==', chatId)
            .get();

        if (integrationSnap.empty) {
            console.log(`[Telegram] No integration found for chatId: ${chatId}`);
            return NextResponse.json({ ok: true });
        }

        const integrationDoc = integrationSnap.docs[0];
        const integrationData = integrationDoc.data();
        
        // Resolver userId y entityId del path de la integración
        const pathParts = integrationDoc.ref.path.split('/');
        const uIdx = pathParts.indexOf('users');
        const eIdx = pathParts.indexOf('entities');
        
        const userId = uIdx !== -1 ? pathParts[uIdx + 1] : integrationData.userId;
        const entityId = eIdx !== -1 ? pathParts[eIdx + 1] : integrationData.entityId;

        if (!userId || !entityId) {
             return NextResponse.json({ ok: true });
        }

        const entityPath = `users/${userId}/entities/${entityId}`;

        // 1. Guardar mensaje en la tarjeta correspondiente
        const contactSnap = await db.collection(`${entityPath}/contacts`)
            .where('telegramChatId', '==', chatId)
            .get();

        let cardId = '';
        let groupId = '';

        if (!contactSnap.empty) {
            const contactData = contactSnap.docs[0].data();
            cardId = contactData.kanbanCardId;
            groupId = contactData.kanbanGroupId;

            if (cardId && groupId) {
                const newMessage = {
                    sender: 'user',
                    text: text || '[Mensaje de Telegram]',
                    timestamp: new Date(),
                    platform: 'telegram',
                    messageId: String(message_id)
                };

                await db.doc(`${entityPath}/kanban-groups/${groupId}/cards/${cardId}`).update({
                    messages: admin.firestore.FieldValue.arrayUnion(newMessage),
                    updatedAt: new Date(),
                    lastMessage: text || '[Telegram]',
                    unreadCount: admin.firestore.FieldValue.increment(1),
                    'botState.messageQueue': admin.firestore.FieldValue.arrayUnion({
                        text: text || '',
                        from: chatId,
                        platform: 'telegram',
                        timestamp: Date.now()
                    })
                });
            }
        }

        // 2. Disparar Chatbot
        if (cardId && groupId) {
            processChatbotFlow({
                userId, entityId, groupId, cardId, platform: 'telegram', from: chatId, text: text || ''
            }).catch(console.error);
        }

        return NextResponse.json({ ok: true });
    } catch (error: any) {
        console.error('[Telegram Webhook Error]', error);
        return NextResponse.json({ ok: true });
    }
}
