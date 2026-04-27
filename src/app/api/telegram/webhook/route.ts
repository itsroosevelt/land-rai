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
             try {
                 const allMatches: any[] = [];
                 const groupsRef = db.collection(`${entityPath}/kanban-groups`);
                 const groupsSnapshot = await groupsRef.get();

                 for (const groupDoc of groupsSnapshot.docs) {
                     // Use only single-field equality filter to avoid composite index requirement
                     const cardsSnapshot = await groupDoc.ref.collection('cards')
                         .where('telegramChatId', '==', telegramChatId)
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
             } catch (fallbackError: any) {
                 console.error(`[Telegram] Fallback search failed, will create new card:`, fallbackError.message);
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

        let finalEntityPath = entityPath;

        // AUTO-RECOVERY: Find the entity that actually has the user's groups
        const initialGroupsCheck = await db.collection(`${entityPath}/kanban-groups`).limit(1).get();
        if (initialGroupsCheck.empty) {
            console.log(`[Telegram] Default path ${entityPath} is empty. Searching for the 'real' active entity...`);
            const allEntities = await db.collection(`users/${userId}/entities`).get();
            for (const entDoc of allEntities.docs) {
                const groupsSnap = await db.collection(`users/${userId}/entities/${entDoc.id}/kanban-groups`).get();
                // If this entity has "WhatsApp" or "Messenger" groups, it's probably the one in the user's screenshot
                const hasActiveGroups = groupsSnap.docs.some(g => {
                    const name = (g.data().name || '').toLowerCase();
                    return name.includes('whatsapp') || name.includes('messenger') || name.includes('instagram');
                });
                
                if (hasActiveGroups) {
                    finalEntityPath = `users/${userId}/entities/${entDoc.id}`;
                    console.log(`[Telegram] FOUND ACTIVE ENTITY: ${finalEntityPath}`);
                    break;
                }
            }
        }

        if (targetCardDoc && groupId) {
            console.log(`[Telegram] Updating existing card: ${cardId} in group: ${groupId}`);
            const cardRef = targetCardDoc.ref;
            await cardRef.update({
                lastMessage: text.length > 50 ? text.substring(0, 47) + '...' : text,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                unreadCount: admin.firestore.FieldValue.increment(1),
                messages: admin.firestore.FieldValue.arrayUnion(newMessage),
                'botState.messageQueue': admin.firestore.FieldValue.arrayUnion(queueItem),
                status: 'open',
                source: 'TELEGRAM',
                channel: 'telegram',
                [`platform_ids.telegram`]: telegramChatId
            });

            if (contactId) {
                await db.collection(`${finalEntityPath}/contacts`).doc(contactId).update({
                    source: 'TELEGRAM',
                    telegramChatId: telegramChatId,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }
        } else {
            // ENSURE TELEGRAM GROUP (Strict Isolation)
            const groupsSnapshot = await db.collection(`${finalEntityPath}/kanban-groups`).get();
            const telegramGroup = groupsSnapshot.docs.find(g => (g.data().name || '').toLowerCase().includes('telegram'));
            
            let destinationGroupId = '';
            if (telegramGroup) {
                destinationGroupId = telegramGroup.id;
            } else {
                destinationGroupId = 'inbox_telegram';
                await db.collection(`${finalEntityPath}/kanban-groups`).doc(destinationGroupId).set({
                    name: 'Telegram Inbox',
                    order: 5, // After WhatsApp
                    color: '#26A5E4',
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            }

            // Create/Update Contact
            const finalContactId = contactId || `tg_${telegramChatId}`;
            console.log(`[Telegram] Creating isolated card for contact: ${finalContactId}`);

            await db.collection(`${finalEntityPath}/contacts`).doc(finalContactId).set({
                name: contactName,
                telegramChatId,
                source: 'TELEGRAM',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                kanbanGroupId: destinationGroupId,
                kanbanCardId: finalContactId
            }, { merge: true });

            // Create the Card (Strictly in Telegram Group)
            await db.collection(`${finalEntityPath}/kanban-groups/${destinationGroupId}/cards`).doc(finalContactId).set({
                contactId: finalContactId,
                contactName: contactName,
                telegramChatId: telegramChatId,
                lastMessage: text.length > 50 ? text.substring(0, 47) + '...' : text,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                messages: [newMessage],
                'botState.messageQueue': [queueItem],
                unreadCount: 1,
                status: 'open',
                source: 'TELEGRAM',
                channel: 'telegram',
                platform_ids: { telegram: telegramChatId }
            }, { merge: true });

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
