import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { processChatbotFlow } from '@/lib/chatbotEngine';

const db = admin.firestore();

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const updateId = String(body.update_id || '');
        
        // --- ⚡️ ULTRA-FAST RESPONSE (Stop Telegram Retries IMMEDIATELY) ---
        const response = NextResponse.json({ ok: true });
        
        if (!updateId) return response;

        // Background Processing (Don't await anything before this)
        (async () => {
            try {
                // 1. Transactional Deduplication
                const dedupRef = db.collection('telegram_webhooks').doc(updateId);
                const isNew = await db.runTransaction(async (t) => {
                    const snap = await t.get(dedupRef);
                    if (snap.exists) return false;
                    t.set(dedupRef, { processedAt: admin.firestore.FieldValue.serverTimestamp() });
                    return true;
                });

                if (!isNew) {
                    console.log(`[Telegram Webhook] 🛡️ Duplicate update ${updateId} ignored.`);
                    return;
                }

                const { message, callback_query: callbackQuery } = body;
                if (!message && !callbackQuery) return;

                const telegramChatId = String(message?.chat?.id || callbackQuery?.message?.chat?.id || '');
                const text = String(callbackQuery?.data || message?.text || message?.caption || '');
                const firstName = message?.from?.first_name || callbackQuery?.from?.first_name || 'Usuario';
                const lastName = message?.from?.last_name || callbackQuery?.from?.last_name || 'Telegram';
                const contactName = `${firstName} ${lastName}`.trim();

                // 2. Identify Entity
                const entitiesSnap = await db.collectionGroup('telegram-integrations')
                    .where('isActive', 'in', [true, 'true'])
                    .get();

                let entityId: string | null = null;
                let userId: string | null = null;

                for (const doc of entitiesSnap.docs) {
                    const pathParts = doc.ref.path.split('/');
                    if (pathParts.length >= 4) {
                        userId = pathParts[1];
                        entityId = pathParts[3];
                        break; 
                    }
                }

                if (!entityId || !userId) return;

                const entityPath = `users/${userId}/entities/${entityId}`;

                // 3. Resolve Contact & Card
                const contactsRef = db.collection(`${entityPath}/contacts`);
                const contactSnap = await contactsRef.where('telegramChatId', '==', telegramChatId).limit(1).get();
                
                let contactId: string | null = null;
                if (contactSnap.empty) {
                    const newContact = await contactsRef.add({
                        name: contactName,
                        telegramChatId,
                        platform: 'telegram',
                        createdAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                    contactId = newContact.id;
                } else {
                    contactId = contactSnap.docs[0].id;
                }

                const groupsSnap = await db.collection(`${entityPath}/kanban-groups`).get();
                let targetCard: any = null;
                let groupId: string | null = null;

                for (const groupDoc of groupsSnap.docs) {
                    const cardsSnap = await db.collection(`${entityPath}/kanban-groups/${groupDoc.id}/cards`)
                        .where('telegramChatId', '==', telegramChatId)
                        .limit(1)
                        .get();
                    
                    if (!cardsSnap.empty) {
                        targetCard = cardsSnap.docs[0];
                        groupId = groupDoc.id;
                        break;
                    }
                }

                if (!targetCard) {
                    const inboxGroup = groupsSnap.docs.find(g => g.data().name?.toLowerCase().includes('inbox')) || groupsSnap.docs[0];
                    if (inboxGroup) {
                        groupId = inboxGroup.id;
                        const newCard = await db.collection(`${entityPath}/kanban-groups/${groupId}/cards`).add({
                            title: contactName,
                            telegramChatId,
                            contactId,
                            channel: 'telegram',
                            status: 'open',
                            createdAt: admin.firestore.FieldValue.serverTimestamp(),
                            botState: { status: 'inactive', currentNodeId: '1' }
                        });
                        targetCard = await newCard.get();
                    }
                }

                if (!targetCard || !groupId) return;

                // 4. Dispatch to Engine
                const stableMsgId = message?.message_id ? `tg_${message.message_id}` : `tg_cb_${Date.now()}`;
                
                await processChatbotFlow({
                    userId,
                    entityId,
                    groupId,
                    cardId: targetCard.id,
                    platform: 'telegram',
                    from: telegramChatId,
                    text,
                    messageId: stableMsgId
                });

            } catch (bgErr: any) {
                console.error(`[Telegram Webhook BG] ❌ Error:`, bgErr);
            }
        })();

        return response;

    } catch (err: any) {
        return NextResponse.json({ ok: false }, { status: 200 }); // Always 200 to stop retries
    }
}
