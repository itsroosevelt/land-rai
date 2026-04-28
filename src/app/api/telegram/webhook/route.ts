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

    const entityPath = `users/${userId}/entities/${entityId}`;

    try {
        const body = await req.json();
        
        // Save raw body for inspection (fire-and-forget to not block response)
        db.collection(`${entityPath}/internal_logs`).add({
            type: 'telegram_webhook_raw',
            body,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        }).catch(() => {});

        // 1. Extract message or callback
        const message = body.message;
        const callbackQuery = body.callback_query;
        
        if (!message && !callbackQuery) {
            return NextResponse.json({ success: true, message: 'Not a message or callback' });
        }

        const telegramChatId = String(message?.chat?.id || callbackQuery?.message?.chat?.id);
        const text = callbackQuery?.data || message?.text || message?.caption || '';
        const firstName = message?.from?.first_name || callbackQuery?.from?.first_name || 'Usuario';
        const lastName = message?.from?.last_name || callbackQuery?.from?.last_name || 'Telegram';
        const contactName = `${firstName} ${lastName}`.trim();

        console.log(`[Telegram] Processing message from ${contactName} (${telegramChatId})`);

        // ATTACHMENT PROCESSING
        let fileUrl: string | null = null;
        let fileType: string | null = null;
        let fileName: string | null = null;

        // Fetch Bot Token from integration to get file URLs
        const integrationSnap = await db.doc(`${entityPath}/integrations/telegram`).get();
        const botToken = integrationSnap.exists ? integrationSnap.data()?.botToken : null;

        if (botToken) {
            let fileId = null;
            if (message?.photo) {
                const photo = message.photo[message.photo.length - 1];
                fileId = photo.file_id;
                fileType = 'image/jpeg';
                fileName = 'photo.jpg';
            } else if (message?.document) {
                fileId = message.document.file_id;
                fileType = message.document.mime_type || 'application/octet-stream';
                fileName = message.document.file_name || 'document';
            } else if (message?.voice) {
                fileId = message.voice.file_id;
                fileType = message.voice.mime_type || 'audio/ogg';
                fileName = 'voice_note.ogg';
            } else if (message?.video) {
                fileId = message.video.file_id;
                fileType = message.video.mime_type || 'video/mp4';
                fileName = 'video.mp4';
            }

            if (fileId) {
                try {
                    const fileRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
                    const fileData = await fileRes.json();
                    if (fileData.ok) {
                        fileUrl = `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`;
                    }
                } catch (e) {
                    console.error('[Telegram] Error fetching file URL:', e);
                }
            }
        }

        if (!text && !fileUrl && !callbackQuery) {
             return NextResponse.json({ success: true, ignored: 'empty_content' });
        }

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

        // FALLBACK SEARCH: Scan all groups
        if (!targetCardDoc) {
             console.log(`[Telegram] No card found via contact. Deep searching all groups...`);
             try {
                 const allMatches: any[] = [];
                 const groupsRef = db.collection(`${entityPath}/kanban-groups`);
                 const groupsSnapshot = await groupsRef.get();

                 for (const groupDoc of groupsSnapshot.docs) {
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
                 }
             } catch (fallbackError: any) {
                 console.error(`[Telegram] Fallback search failed:`, fallbackError.message);
             }
        }

        let cardId: string | null = targetCardDoc?.id || null;
        let groupId: string | null = targetGroupId || null;
        let contactId: string | null = existingContactId || null;

        // Use Telegram's own message.date (seconds) for a stable timestamp across retries.
        // This prevents duplicate entries when Telegram retries a timed-out webhook.
        const stableTs = message?.date
            ? admin.firestore.Timestamp.fromMillis(message.date * 1000)
            : admin.firestore.Timestamp.now();
        const stableTsMs = message?.date ? message.date * 1000
            : (callbackQuery?.message?.date ? callbackQuery.message.date * 1000 : Date.now());
        const stableMsgId = message?.message_id ? `tg_${message.message_id}`
            : callbackQuery?.id ? `tg_cb_${callbackQuery.id}` : `tg_cb_${stableTsMs}`;

        const newMessage = {
            sender: 'user',
            text: text,
            timestamp: stableTs,
            messageId: stableMsgId,
            platform: 'telegram',
            fileUrl,
            fileType,
            fileName,
            metadata: {
                platform: 'telegram',
                fileUrl,
                fileType,
                fileName,
                telegramChatId
            }
        };

        const queueItem = {
            text: text || (fileUrl ? '[Archivo]' : ''),
            messageId: stableMsgId,
            platform: 'telegram',
            from: telegramChatId,
            timestamp: stableTsMs  // stable across retries so arrayUnion can dedup correctly
        };

        let finalEntityPath = entityPath;

        if (targetCardDoc && groupId) {
            console.log(`[Telegram] Updating existing card: ${cardId} in group: ${groupId}`);
            const cardRef = targetCardDoc.ref;

            // Update contact reference if it was pointing to the wrong group
            if (contactId && targetGroupId && targetGroupId !== groupId) {
                console.log(`[Telegram] Syncing contact ${contactId} to correct group ${targetGroupId}`);
                db.collection(`${finalEntityPath}/contacts`).doc(contactId).update({
                    kanbanGroupId: targetGroupId,
                    kanbanCardId: cardId,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                }).catch(() => {});
            }

            // Use a transaction so we can: (a) dedup by messageId, (b) cap messages array
            await db.runTransaction(async (transaction) => {
                const freshSnap = await transaction.get(cardRef as admin.firestore.DocumentReference);
                const freshData = (freshSnap as admin.firestore.DocumentSnapshot).data() || {};

                // --- Dedup: skip if this exact messageId is already recorded ---
                const existingMsgs: any[] = freshData.messages || [];
                const msgExists = existingMsgs.some((m: any) => m.messageId === newMessage.messageId);
                let updatedMsgs = msgExists ? existingMsgs : [...existingMsgs, newMessage];
                
                if (updatedMsgs.length > 200) updatedMsgs = updatedMsgs.slice(-200);

                // --- Dedup queue item by messageId ---
                const existingQueue: any[] = freshData.botState?.messageQueue || [];
                const queueExists = existingQueue.some((q: any) => q.messageId === queueItem.messageId);
                const queueUpdate = queueExists
                    ? {}
                    : { 'botState.messageQueue': admin.firestore.FieldValue.arrayUnion(queueItem) };

                const lastMsg = text.length > 50 ? text.substring(0, 47) + '...' : (text || (fileUrl ? 'Archivo adjunto' : 'Nuevo mensaje'));
                
                transaction.update(cardRef, {
                    lastMessage: lastMsg,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    unreadCount: admin.firestore.FieldValue.increment(1),
                    messages: updatedMsgs,
                    status: 'open',
                    source: 'TELEGRAM',
                    channel: 'telegram',
                    [`platform_ids.telegram`]: telegramChatId,
                    ...queueUpdate
                });
            });

            if (contactId) {
                db.collection(`${finalEntityPath}/contacts`).doc(contactId).update({
                    source: 'TELEGRAM',
                    telegramChatId: telegramChatId,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                }).catch(() => {});
            }
        } else {
            // ENSURE TARGET GROUP (Unified Inbox)
            const groupsSnapshot = await db.collection(`${finalEntityPath}/kanban-groups`).get();
            // Try to find a group named 'Inbox' or 'Bandeja de Entrada' (case insensitive)
            const mainGroup = groupsSnapshot.docs.find(g => {
                const name = (g.data().name || '').toLowerCase();
                return name === 'inbox' || name.includes('entrada') || name === 'nuevos' || name.includes('recepcion');
            });
            
            let destinationGroupId = '';
            if (mainGroup) {
                destinationGroupId = mainGroup.id;
            } else {
                // Fallback: use the first group that is NOT a telegram-specific group
                const fallbackGroup = groupsSnapshot.docs.find(g => {
                    const name = (g.data().name || '').toLowerCase();
                    return !name.includes('telegram');
                });
                
                if (fallbackGroup) {
                    destinationGroupId = fallbackGroup.id;
                } else {
                    destinationGroupId = 'default_inbox';
                    await db.collection(`${finalEntityPath}/kanban-groups`).doc(destinationGroupId).set({
                        name: 'Bandeja de Entrada',
                        order: 0,
                        color: '#3B82F6',
                        createdAt: admin.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });
                }
            }

            const finalContactId = contactId || `tg_${telegramChatId}`;
            console.log(`[Telegram] Creating new card ${finalContactId} in group ${destinationGroupId}`);
            
            await db.collection(`${finalEntityPath}/contacts`).doc(finalContactId).set({
                name: contactName,
                telegramChatId,
                source: 'TELEGRAM',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                kanbanGroupId: destinationGroupId,
                kanbanCardId: finalContactId
            }, { merge: true });

            await db.collection(`${finalEntityPath}/kanban-groups/${destinationGroupId}/cards`).doc(finalContactId).set({
                contactId: finalContactId,
                contactName: contactName,
                telegramChatId: telegramChatId,
                lastMessage: text.length > 50 ? text.substring(0, 47) + '...' : (text || (fileUrl ? 'Archivo adjunto' : 'Nuevo mensaje')),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                messages: [newMessage],
                botState: {
                    messageQueue: [queueItem],
                    status: 'active',
                    waitingForInput: false
                },
                unreadCount: 1,
                status: 'open',
                source: 'TELEGRAM',
                channel: 'telegram',
                platform_ids: { telegram: telegramChatId },
                groupId: destinationGroupId
            }, { merge: true });

            cardId = finalContactId;
            groupId = destinationGroupId;
        }

        if (groupId && cardId) {
            processChatbotFlow({
                userId,
                entityId,
                groupId,
                cardId,
                platform: 'telegram',
                from: telegramChatId,
                text: text || (fileUrl ? '[Archivo]' : ''),
                messageId: newMessage.messageId
            }).catch((err: any) => console.error('[Telegram Webhook] Engine error:', err?.message));
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[Telegram Webhook Error]', error);
        return NextResponse.json({ success: false, error: error.message, stack: error.stack }, { status: 500 });
    }
}
