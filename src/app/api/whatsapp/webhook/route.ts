import { NextResponse } from 'next/server';
import { db, admin } from '@/lib/firebase-admin';
import fs from 'fs';
import path from 'path';
import { processChatbotFlow } from '@/lib/chatbotEngine';
import { buildBotQueueItem, createQueuedBotState, isDuplicateQueueMessage } from '@/lib/botQueue';
import { extractWhatsAppInboundPayload } from '@/lib/whatsappInbound';
import { buildInboundWhatsAppUserMessage } from '@/lib/whatsapp/inboundMessageBuilder';
import {
    cleanWhatsAppSenderId,
    phoneLookupVariants,
    resolveWhatsAppTenant,
} from '@/lib/whatsappTenant';
import { isInboxGroup, SYSTEM_INBOX_GROUP_ID, SYSTEM_INBOX_GROUP_FIELDS } from '@/lib/kanban/botNodeGroups';

const DEBUG_FILE = '/tmp/webhook.log';

function debugLog(msg: string) {
    const time = new Date().toISOString();
    const logMsg = `[${time}] [Webhook Debug] ${msg}\n`;
    console.log(logMsg.trim());
    try { fs.appendFileSync(DEBUG_FILE, logMsg); } catch (e) {
        console.error("Failed to write to debug file:", e);
    }
}

// Meta Webhook Verification (Handshake)
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    const userId = searchParams.get('u');
    const entityId = searchParams.get('e');
    const incomingToken = (token || '').trim();
    let expectedToken = (
        process.env.kamban_VERIFY_TOKEN ||
        process.env.WHATSAPP_VERIFY_TOKEN ||
        'vg37e'
    ).trim();

    const hasValidTenantParams =
        !!userId &&
        !!entityId &&
        !userId.includes('TU_UID') &&
        userId.length >= 10;

    // MULTI-TENANT VERIFICATION: If IDs are in URL, we check the tenant's specific token
    if (hasValidTenantParams) {
        try {
            const [publicSnap, internalSnap] = await Promise.all([
                db.doc(`users/${userId}/entities/${entityId}/integrations/whatsapp`).get(),
                db.doc(`users/${userId}/entities/${entityId}/integrations/whatsapp_internal`).get()
            ]);

            const tenantToken = (publicSnap.data()?.verifyToken || internalSnap.data()?.verifyToken || '').trim();
            if (tenantToken) expectedToken = tenantToken;
        } catch (err) {
            debugLog(`[GET] Error loading tenant token: ${err}`);
        }
    }

    if (mode === 'subscribe' && incomingToken === expectedToken) {
        debugLog(`Verification successful (GET) | Tenant: ${entityId || 'Global'}`);
        return new Response(challenge, { status: 200 });
    }
    debugLog(`Verification failed (GET) | Expected: ${expectedToken}, Got: ${incomingToken} | TenantParams: ${hasValidTenantParams}`);
    return new Response('Forbidden', { status: 403 });
}

// POST: Handle incoming messages
export async function POST(req: Request) {
    debugLog('--- [Master Webhook] INCOMING HIT ---');

    try {
        const { searchParams } = new URL(req.url);
        let body;
        try {
            const rawBody = await req.text();
            debugLog(`[POST] Raw Body Length: ${rawBody.length}`);
            body = JSON.parse(rawBody);
        } catch (parseError: any) {
            debugLog(`[POST] ❌ JSON Parse Error: ${parseError.message}`);
            return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
        }

        const entry = body.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;
        const metadata = value?.metadata;
        const recipientPhoneNumberId = metadata?.phone_number_id;

        // 1. TENANT IDENTIFICATION (Optimized O(1) Indexed Lookup)
        debugLog(`[POST] Searching tenant for Phone ID: ${recipientPhoneNumberId}`);

        const tenant = await resolveWhatsAppTenant(
            recipientPhoneNumberId,
            searchParams.get('u'),
            searchParams.get('e')
        );

        if (!tenant) {
            debugLog(`[POST] ❌ ABORT: Could not resolve tenant for Phone ID ${recipientPhoneNumberId}`);
            return NextResponse.json({ success: true, ignored: 'tenant_not_mapped' });
        }

        const userId = tenant.userId;
        const entityId = tenant.entityId;
        debugLog(`[POST] Tenant Discovery Success: User=${userId}, Entity=${entityId}`);

        try {
            await db.collection(`users/${userId}/entities/${entityId}/system_logs`).add({
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                type: 'whatsapp_webhook',
                phoneId: recipientPhoneNumberId || 'unknown',
                payload_type: value?.messages ? 'message' : (value?.statuses ? 'status' : 'other'),
                raw: JSON.stringify(body).substring(0, 1500)
            });
        } catch (e) {}

        // Base path for this specific tenant's entity
        const entityPath = `users/${userId}/entities/${entityId}`;

        // 2. STATUS UPDATES (Read receipts, delivery, etc.)
        if (value?.statuses && value.statuses.length > 0) {
            const statusUpdate = value.statuses[0];
            const status = statusUpdate.status;
            const messageId = statusUpdate.id;
            const recipientId = statusUpdate.recipient_id;

            debugLog(`[POST] Status Update [${status}] for message ${messageId} in tenant ${entityId}`);

            // Find card containing this message in the tenant's context
            const cardsRef = db.collection(`${entityPath}/kanban-groups`);
            const groupsSnapshot = await cardsRef.get();

            // OPTIMIZED: Search in parallel instead of sequentially blocking
            const updatePromises = groupsSnapshot.docs.map(async (group) => {
                const cardSnapshot = await group.ref.collection('cards')
                    .where('platform_ids.whatsapp', '==', recipientId)
                    .get();

                if (!cardSnapshot.empty) {
                    const cardDoc = cardSnapshot.docs[0];
                    const messages = cardDoc.data().messages || [];
                    let changed = false;

                    const updatedMessages = messages.map((m: any) => {
                        if (m.whatsappMessageId === messageId || m.kambanMessageId === messageId) {
                            changed = true;
                            return { ...m, status: status };
                        }
                        return m;
                    });

                    if (changed) {
                        await cardDoc.ref.update({ messages: updatedMessages });
                        debugLog(`[POST] Status synced to card ${cardDoc.id}`);
                    }
                }
            });

            await Promise.all(updatePromises);

            // --- Broadcast delivery/read tracking (best-effort, fully isolated) ---
            try {
                if (messageId && (status === 'delivered' || status === 'read')) {
                    const idxSnap = await db.doc(`${entityPath}/broadcast_msg_index/${messageId}`).get();
                    if (idxSnap.exists) {
                        const { broadcastId, recipientId } = idxSnap.data() as any;
                        const recRef = db.doc(`${entityPath}/broadcasts/${broadcastId}/recipients/${recipientId}`);
                        const recSnap = await recRef.get();
                        if (recSnap.exists) {
                            const cur = recSnap.data() as any;
                            const rank: Record<string, number> = { sent: 1, delivered: 2, read: 3 };
                            if (cur.status !== 'replied' && (rank[status] || 0) > (rank[cur.status] || 0)) {
                                await recRef.update({ status });
                                const field = status === 'delivered' ? 'stats.delivered' : 'stats.read';
                                await db.doc(`${entityPath}/broadcasts/${broadcastId}`).update({
                                    [field]: admin.firestore.FieldValue.increment(1),
                                });
                            }
                        }
                    }
                }
            } catch (e) {
                debugLog('[POST] Broadcast status tracking skipped (non-fatal).');
            }

            return NextResponse.json({ success: true });
        }

        // 3. INCOMING MESSAGE HANDLING
        const message = value?.messages?.[0];
        if (message) {
            // Drop bot echoes and invalid messages entirely to prevent empty duplicate cards
            if (message.from === recipientPhoneNumberId || message.is_echo || value?.statuses) {
                return NextResponse.json({ success: true, ignored: 'echo_or_status' });
            }

            const from = message.from;
            const { text, shouldProcess } = extractWhatsAppInboundPayload(message);
            let displayPrefText = text;
            if (message.type === 'interactive') {
                displayPrefText = message.interactive?.button_reply?.title || message.interactive?.list_reply?.title || text;
            } else if (message.type === 'button') {
                displayPrefText = message.button?.text || text;
            }

            const messageId = message.id;
            debugLog(`[POST] Message from ${from}: "${text}" (Tenant: ${entityId})`);

            if (from && shouldProcess) {
                const cleanFrom = cleanWhatsAppSenderId(from);
                
                // Strict Validation: Prevent blank/ghost records if Meta API hallucinates
                if (!cleanFrom || cleanFrom.length < 5) {
                    debugLog('[POST] Ignoring message: Missing or invalid phone number from Meta.');
                    return NextResponse.json({ success: true, ignored: 'invalid_sender_format' });
                }

                // --- Broadcast reply tracking (best-effort, fully isolated) ---
                try {
                    const replyKey = cleanFrom.replace(/\D/g, '');
                    if (replyKey) {
                        const replyIdxRef = db.doc(`${entityPath}/broadcast_reply_index/${replyKey}`);
                        const replyIdxSnap = await replyIdxRef.get();
                        if (replyIdxSnap.exists) {
                            const { broadcastId, recipientId } = replyIdxSnap.data() as any;
                            const recRef = db.doc(`${entityPath}/broadcasts/${broadcastId}/recipients/${recipientId}`);
                            const recSnap = await recRef.get();
                            if (recSnap.exists && (recSnap.data() as any).status !== 'replied') {
                                await recRef.update({
                                    status: 'replied',
                                    repliedAt: admin.firestore.FieldValue.serverTimestamp(),
                                });
                                await db.doc(`${entityPath}/broadcasts/${broadcastId}`).update({
                                    'stats.replied': admin.firestore.FieldValue.increment(1),
                                });
                            }
                            // Consume the index so subsequent messages aren't recounted.
                            await replyIdxRef.delete().catch(() => {});
                        }
                    }
                } catch (e) {
                    debugLog('[POST] Broadcast reply tracking skipped (non-fatal).');
                }

                // OPTIMIZED O(1) Search: Find group and card via indexed Contacts context
                let targetCardDoc: any = null;
                let targetGroupId: string | null = null;
                let existingContactId: string | null = null;
                let existingContactName: string | null = null;

                let contactDoc: { id: string; data: () => Record<string, any> } | null = null;
                for (const phoneVariant of phoneLookupVariants(cleanFrom)) {
                    const snap = await db.collection(`${entityPath}/contacts`)
                        .where('phone', '==', phoneVariant)
                        .limit(1)
                        .get();
                    if (!snap.empty) {
                        contactDoc = snap.docs[0];
                        break;
                    }
                }

                if (contactDoc) {
                    const contactData = contactDoc.data() || {};
                    existingContactId = contactDoc.id;
                    existingContactName = contactData.name || contactData.contactName || contactData.firstName || null;
                    targetGroupId = contactData.kanbanGroupId;
                    const contactCardId = contactData.kanbanCardId;

                    if (targetGroupId && contactCardId) {
                        const cardRef = db.doc(`${entityPath}/kanban-groups/${targetGroupId}/cards/${contactCardId}`);
                        const cardGet = await cardRef.get();
                        if (cardGet.exists) {
                            targetCardDoc = cardGet;
                        } else {
                            // 👻 TARJETA FANTASMA: Borrar referencia para permitir re-creación
                            console.log(`[Webhook] 👻 Ghost card detected (${contactCardId}). Clearing reference.`);
                            await db.doc(`${entityPath}/contacts/${existingContactId}`).update({
                                kanbanCardId: admin.firestore.FieldValue.delete(),
                                kanbanGroupId: admin.firestore.FieldValue.delete()
                            }).catch(() => {});
                            targetGroupId = null;
                        }
                    }
                }

                // Fallback search across all groups - only if we haven't found a card yet
                if (!targetCardDoc) {
                    debugLog(`[POST] No card found via contact ${existingContactId}. Searching all groups...`);
                    const allMatches: any[] = [];
                    const groupsRef = db.collection(`${entityPath}/kanban-groups`);
                    const groupsSnapshot = await groupsRef.get();

                    for (const groupDoc of groupsSnapshot.docs) {
                        try {
                            const cardsSnapshot = await groupDoc.ref.collection('cards')
                                .where('contactNumberClean', '==', cleanFrom)
                                .limit(5)
                                .get();

                            cardsSnapshot.forEach(doc => {
                                allMatches.push({ doc, groupId: groupDoc.id });
                            });
                        } catch (searchErr: any) {
                            debugLog(`[POST] Card search skipped in group ${groupDoc.id}: ${searchErr.message}`);
                        }
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
                }

                // Reference used below for default group in card creation
                const groupsRef = db.collection(`${entityPath}/kanban-groups`);
                const groupsSnapshot = await groupsRef.get();

                const newMessage = await buildInboundWhatsAppUserMessage({
                    message,
                    userId,
                    entityId,
                    displayText: displayPrefText,
                    messageId,
                });

                let cardId = targetCardDoc?.id;
                let groupId = targetGroupId;

                const queueItem = buildBotQueueItem({
                    text: text || '',
                    messageId: messageId || `wa_${Date.now()}`,
                    platform: 'whatsapp',
                    from: from,
                });

                if (targetCardDoc && targetGroupId) {
                    cardId = targetCardDoc.id;
                    groupId = targetGroupId;

                    const existingCardData = targetCardDoc.data() || {};
                    const alreadyQueued = isDuplicateQueueMessage(existingCardData, messageId);

                    const cardUpdate: Record<string, any> = {
                        lastMessage: displayPrefText.length > 50 ? displayPrefText.substring(0, 47) + '...' : displayPrefText,
                        updatedAt: new Date(),
                        unreadCount: admin.firestore.FieldValue.increment(1),
                        messages: admin.firestore.FieldValue.arrayUnion(newMessage),
                        'botState.engine': 'queue',
                        status: 'open'
                    };

                    // Remember which business number this conversation belongs to (multi-number).
                    if (recipientPhoneNumberId) {
                        cardUpdate.whatsappPhoneNumberId = String(recipientPhoneNumberId);
                    }

                    if (!alreadyQueued) {
                        cardUpdate['botState.messageQueue'] = admin.firestore.FieldValue.arrayUnion(queueItem);
                    } else {
                        debugLog(`[POST] Duplicate WhatsApp message ${messageId} ignored for queue on card ${cardId}`);
                    }

                    await targetCardDoc.ref.update(cardUpdate);
                } else {
                    // Create NEW card
                    let destinationGroupId = targetGroupId;
                    
                    // SAFEGUARD: Always drop new conversations into the permanent reception
                    // column so messages arrive even when no bot is active.
                    if (!destinationGroupId) {
                        const inboxDoc =
                            groupsSnapshot.docs.find(g => g.id === SYSTEM_INBOX_GROUP_ID) ||
                            groupsSnapshot.docs.find(g => isInboxGroup({ id: g.id, ...g.data() })) ||
                            groupsSnapshot.docs[0];
                        if (inboxDoc) {
                            destinationGroupId = inboxDoc.id;
                        } else {
                            // Failsafe: create the reception column if the entity is empty.
                            const newGroupRef = db.collection(`${entityPath}/kanban-groups`).doc(SYSTEM_INBOX_GROUP_ID);
                            await newGroupRef.set({
                                ...SYSTEM_INBOX_GROUP_FIELDS,
                                createdAt: admin.firestore.FieldValue.serverTimestamp()
                            }, { merge: true });
                            destinationGroupId = SYSTEM_INBOX_GROUP_ID;
                        }
                    }

                    const targetGroupRef = db.collection(`${entityPath}/kanban-groups`).doc(destinationGroupId);

                    if (targetGroupRef) {
                        const newCardRef = targetGroupRef.collection('cards').doc();

                        // 1. Resolve CRM ID: Use existing or generate new one
                        let numericId = existingContactId;
                        
                        if (!numericId) {
                            numericId = String(Date.now()).slice(-10);
                            try {
                                const counterRef = db.collection(`${entityPath}/system_metadata`).doc('counters');
                                await db.runTransaction(async (tx) => {
                                    const snap = await tx.get(counterRef);
                                    const next = (snap.exists ? (snap.data()?.crmIdCount || 0) : 0) + 1;
                                    tx.set(counterRef, { crmIdCount: next }, { merge: true });
                                    numericId = String(next).padStart(10, '0');
                                });
                            } catch (err) {
                                debugLog(`[POST] Error generating CRM ID: ${err}`);
                            }
                        }

                        const finalContactName = value.contacts?.[0]?.profile?.name || existingContactName || from;

                        await newCardRef.set({
                            crmId: numericId,
                            contactName: finalContactName,
                            contactNumber: from,
                            contactNumberClean: cleanFrom,
                            lastMessage: displayPrefText.length > 50 ? displayPrefText.substring(0, 47) + '...' : displayPrefText,
                            updatedAt: new Date(),
                            createdAt: new Date(),
                            messages: [newMessage],
                            botState: createQueuedBotState(queueItem),
                            unreadCount: 1,
                            status: 'open',
                            source: 'WHATSAPP',
                            primary_channel: 'whatsapp',
                            platform_ids: { whatsapp: from },
                            ...(recipientPhoneNumberId ? { whatsappPhoneNumberId: String(recipientPhoneNumberId) } : {})
                        });

                        // 3. Update or Create Contact Reference
                        if (existingContactId) {
                            await db.collection(`${entityPath}/contacts`).doc(existingContactId).update({
                                kanbanGroupId: destinationGroupId,
                                kanbanCardId: newCardRef.id,
                                updatedAt: new Date().toISOString()
                            });
                        } else {
                            const numericId = Date.now().toString() + Math.floor(Math.random() * 1000).toString();
                            await db.collection(`${entityPath}/contacts`).doc(numericId).set({
                                crmId: numericId,
                                name: finalContactName || cleanFrom,
                                contactName: finalContactName || cleanFrom,
                                phone: `+${cleanFrom}`,
                                contactNumber: from,
                                kanbanGroupId: destinationGroupId,
                                kanbanCardId: newCardRef.id,
                                updatedAt: new Date().toISOString(),
                                createdAt: new Date().toISOString()
                            });
                        }

                        cardId = newCardRef.id;
                        groupId = destinationGroupId;
                    }
                }

                // 4. TRIGGER UNIVERSAL CHATBOT
                if (groupId && cardId) {
                    debugLog(`[POST] Triggering universal chatbot for whatsapp in tenant ${entityId}...`);
                    await processChatbotFlow({
                        userId, entityId, groupId, cardId, platform: 'whatsapp', from: from, text: text,
                        messageId: messageId,
                        channelAccountId: recipientPhoneNumberId
                    }).catch(botError => {
                        debugLog(`[POST] Chatbot Async Error: ${botError?.message || String(botError)}`);
                    });
                }

            }
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        debugLog(`[POST CRASH] ${error.stack || error.message}`);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}



