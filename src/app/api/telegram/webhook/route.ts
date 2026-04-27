import { NextResponse } from 'next/server';
import { db, admin } from '@/lib/firebase-admin';
import { processChatbotFlow } from '@/lib/chatbotEngine';

export async function GET(req: Request) {
    return new Response('Telegram Webhook Active', { status: 200 });
}

export async function POST(req: Request) {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('u');
    const entityId = searchParams.get('e');

    if (!userId || !entityId) {
        return NextResponse.json({ success: false, error: 'Missing tenant context' }, { status: 400 });
    }

    try {
        const body = await req.json();
        
        // DEBUG: Save raw body for inspection (Rule: Agnostic Search)
        await db.collection('system_logs').add({
            type: 'telegram_webhook_raw',
            body,
            userId,
            entityId,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        // 1. Extract message or callback
        const message = body.message;
        const callbackQuery = body.callback_query;
        
        if (!message && !callbackQuery) {
            return NextResponse.json({ success: true, message: 'Not a message or callback' });
        }

        const telegramChatId = String(message?.chat?.id || callbackQuery?.message?.chat?.id);
        const text = callbackQuery?.data || message?.text || '';
        const firstName = message?.from?.first_name || callbackQuery?.from?.first_name || 'Usuario';
        const lastName = message?.from?.last_name || callbackQuery?.from?.last_name || 'Telegram';
        const contactName = `${firstName} ${lastName}`.trim();

        console.log(`[Telegram] Processing message from ${contactName} (${telegramChatId})`);

        if (!text && !message?.attachments) {
             return NextResponse.json({ success: true, ignored: 'empty_content' });
        }

        const entityPath = `users/${userId}/entities/${entityId}`;

        // OMNICHANNEL INGESTION
        let targetCardDoc: any = null;
        let targetGroupId: string | null = null;
        let existingContactId: string | null = null;

        // Try to find if user exists by telegramChatId in Contacts
        const contactSnap = await db.collection(`${entityPath}/contacts`)
            .where('telegramChatId', '==', telegramChatId)
            .limit(1)
            .get();

        if (!contactSnap.empty) {
            const contactDoc = contactSnap.docs[0];
            const contactData = contactDoc.data();
            existingContactId = contactDoc.id;
            targetGroupId = contactData.kanbanGroupId;
            const contactCardId = contactData.kanbanCardId;

            if (targetGroupId && contactCardId) {
                const cardRef = db.doc(`${entityPath}/kanban-groups/${targetGroupId}/cards/${contactCardId}`);
                const cardGet = await cardRef.get();
                if (cardGet.exists) {
                    targetCardDoc = cardGet;
                }
            }
        }

        // FALLBACK SEARCH: Scan all groups like WhatsApp/Meta do
        if (!targetCardDoc) {
             console.log(`[Telegram] No card found via contact. Deep searching all groups...`);
             const allMatches: any[] = [];
             const groupsRef = db.collection(`${entityPath}/kanban-groups`);
             const groupsSnapshot = await groupsRef.get();

             for (const groupDoc of groupsSnapshot.docs) {
                 const cardsSnapshot = await groupDoc.ref.collection('cards')
                     .where('telegramChatId', '==', telegramChatId)
                     .orderBy('updatedAt', 'desc')
                     .limit(1)
                     .get();

                 cardsSnapshot.forEach(doc => {
                     allMatches.push({ doc, groupId: groupDoc.id });
                 });
             }

             if (allMatches.length > 0) {
                 allMatches.sort((a, b) => {
                     const tA = (a.doc.data().updatedAt?.toDate?.() || new Date(0)).getTime();
                     const tB = (b.doc.data().updatedAt?.toDate?.() || new Date(0)).getTime();
                     return tB - tA;
                 });
                 targetCardDoc = allMatches[0].doc;
                 targetGroupId = allMatches[0].groupId;
                 console.log(`[Telegram] Found existing card via Deep Search: ${targetCardDoc.id}`);
             }
        }

        let cardId: string | null = targetCardDoc?.id || null;
        let groupId: string | null = targetGroupId || null;
        let contactId: string | null = existingContactId || null;

        const newMessage = {
            sender: 'user',
            text: text,
            timestamp: admin.firestore.Timestamp.now(),
            messageId: message?.message_id ? `tg_${message.message_id}` : `tg_cb_${Date.now()}`,
            platform: 'telegram'
        };

        const queueItem = {
            text: text || '',
            messageId: message?.message_id ? `tg_${message.message_id}` : `tg_cb_${Date.now()}`,
            platform: 'telegram',
            from: telegramChatId,
            timestamp: Date.now()
        };

        if (targetCardDoc && groupId) {
            const cardRef = targetCardDoc.ref;
            await cardRef.update({
                lastMessage: text.length > 50 ? text.substring(0, 47) + '...' : text,
                updatedAt: admin.firestore.Timestamp.now(),
                unreadCount: admin.firestore.FieldValue.increment(1),
                messages: admin.firestore.FieldValue.arrayUnion(newMessage),
                'botState.messageQueue': admin.firestore.FieldValue.arrayUnion(queueItem),
                status: 'open',
                source: 'TELEGRAM',
                [`platform_ids.telegram`]: telegramChatId
            });

            // Sync contact source
            if (contactId) {
                await db.collection(`${entityPath}/contacts`).doc(contactId).update({
                    source: 'TELEGRAM',
                    telegramChatId: telegramChatId,
                    updatedAt: admin.firestore.Timestamp.now()
                });
            }
        } else {
            // Get or Create Inbox Group
            const groupsSnapshot = await db.collection(`${entityPath}/kanban-groups`).orderBy('order', 'asc').get();
            let destinationGroupId = '';
            
            const inboxGroup = groupsSnapshot.docs.find(g => (g.data().name || '').toLowerCase().includes('inbox'));
            
            if (inboxGroup) {
                destinationGroupId = inboxGroup.id;
            } else {
                // Create Default Inbox if none exists
                const newGroupRef = db.collection(`${entityPath}/kanban-groups`).doc('inbox_telegram');
                await newGroupRef.set({
                    name: 'Inbox Telegram',
                    order: 0,
                    color: '#26A5E4',
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                destinationGroupId = 'inbox_telegram';
            }

            // Create New Contact & Card
            const finalContactId = contactId || `tg_${telegramChatId}`;
            
            await db.collection(`${entityPath}/contacts`).doc(finalContactId).set({
                name: contactName,
                telegramChatId,
                source: 'TELEGRAM',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                kanbanGroupId: destinationGroupId,
                kanbanCardId: finalContactId
            }, { merge: true });

            await db.collection(`${entityPath}/kanban-groups/${destinationGroupId}/cards`).doc(finalContactId).set({
                contactId: finalContactId,
                contactName: contactName,
                contactNumber: telegramChatId,
                telegramChatId: telegramChatId,
                lastMessage: text.length > 50 ? text.substring(0, 47) + '...' : text,
                updatedAt: admin.firestore.Timestamp.now(),
                createdAt: admin.firestore.Timestamp.now(),
                messages: [newMessage],
                'botState.messageQueue': [queueItem],
                unreadCount: 1,
                status: 'open',
                source: 'TELEGRAM',
                primary_channel: 'telegram',
                platform_ids: { telegram: telegramChatId }
            });

            cardId = finalContactId;
            groupId = destinationGroupId;
        }

        // 2. TRIGGER UNIVERSAL CHATBOT
        if (groupId && cardId) {
            processChatbotFlow({
                userId, entityId, groupId, cardId, platform: 'telegram', from: telegramChatId, text: text
            }).catch(error => {
                 console.error(`[Telegram Chatbot Error] ${error}`);
            });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[Telegram Webhook Error]', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
