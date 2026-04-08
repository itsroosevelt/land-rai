import { NextResponse } from 'next/server';
import { db, admin } from '@/lib/firebase-admin';
import fs from 'fs';
import path from 'path';
import { sendWhatsAppMessage } from '@/lib/sendProviders';
import { processChatbotFlow } from '@/lib/chatbotEngine';

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
    let expectedToken = process.env.kamban_VERIFY_TOKEN || 'vg37e';

    // MULTI-TENANT VERIFICATION: If IDs are in URL, we check the tenant's specific token
    if (userId && entityId) {
        try {
            const [publicSnap, internalSnap] = await Promise.all([
                db.doc(`users/${userId}/entities/${entityId}/integrations/whatsapp`).get(),
                db.doc(`users/${userId}/entities/${entityId}/integrations/whatsapp_internal`).get()
            ]);

            const tenantToken = publicSnap.data()?.verifyToken || internalSnap.data()?.verifyToken;
            if (tenantToken) expectedToken = tenantToken;
        } catch (err) {
            debugLog(`[GET] Error loading tenant token: ${err}`);
        }
    }

    if (mode === 'subscribe' && token === expectedToken) {
        debugLog(`Verification successful (GET) | Tenant: ${entityId || 'Global'}`);
        return new Response(challenge, { status: 200 });
    }
    debugLog(`Verification failed (GET) | Expected: ${expectedToken}, Got: ${token}`);
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

        let userId = searchParams.get('u');
        let entityId = searchParams.get('e');

        if (!userId || !entityId) {
            // Rule 4: Isolated Data Vault - Search across all entity integrations
            const tenantSnap = await db.collectionGroup('integrations')
                .where('phoneNumberId', '==', recipientPhoneNumberId)
                .limit(1)
                .get();
            
            if (!tenantSnap.empty) {
                const pathParts = tenantSnap.docs[0].ref.path.split('/');
                // Dynamic path resolution: users/{uid}/entities/{eid}/integrations/whatsapp
                const uIdx = pathParts.indexOf('users');
                const eIdx = pathParts.indexOf('entities');
                if (uIdx !== -1 && eIdx !== -1) {
                    userId = pathParts[uIdx + 1];
                    entityId = pathParts[eIdx + 1];
                }
            }
        }

        if (userId && entityId) {
            debugLog(`[POST] Tenant Discovery Success: User=${userId}, Entity=${entityId}`);
            
            // EMERGENCY LOG TO ENTITY BÓVEDA (Rule 5 & 7)
            try {
                await db.collection(`users/${userId}/entities/${entityId}/system_logs`).add({
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    type: 'whatsapp_webhook',
                    phoneId: recipientPhoneNumberId || 'unknown',
                    payload_type: value?.messages ? 'message' : (value?.statuses ? 'status' : 'other'),
                    raw: JSON.stringify(body).substring(0, 1500)
                });
            } catch (e) {}
        } else {
            // BACKUP SEARCH: try a legacy system mapping if it exists
            const mappingRef = db.doc(`system_mappings/whatsapp_numbers/numbers/${recipientPhoneNumberId}`);
            const mappingDoc = await mappingRef.get();
            if (mappingDoc.exists) {
                const legacy = mappingDoc.data() as { userId: string, entityId: string };
                userId = legacy.userId;
                entityId = legacy.entityId;
                debugLog(`[POST] Found via legacy mapping: User=${userId}, Entity=${entityId}`);
            } else {
                debugLog(`[POST] ❌ ABORT: Could not resolve tenant for Phone ID ${recipientPhoneNumberId} (No mapping and no URL params).`);
                return NextResponse.json({ success: false, error: 'Tenant not mapped' });
            }
        }

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
            let text = message.text?.body || '';

            // Handle interactive/button responses
            if (message.type === 'interactive') {
                const interactive = message.interactive;
                text = interactive?.button_reply?.id || interactive?.list_reply?.id || interactive?.button_reply?.title || interactive?.list_reply?.title;
            } else if (message.type === 'button') {
                text = message.button?.payload || message.button?.text;
            } else if (message.type === 'image' || message.type === 'document' || message.type === 'video') {
                text = `[Archivo ${message.type}]`;
            }

            const messageId = message.id;
            debugLog(`[POST] Message from ${from}: "${text}" (Tenant: ${entityId})`);

            if (from && text) {
                const cleanFrom = from.replace(/\D/g, '');
                
                // Strict Validation: Prevent blank/ghost records if Meta API hallucinates
                if (!cleanFrom || cleanFrom.length < 5) {
                    debugLog('[POST] Ignoring message: Missing or invalid phone number from Meta.');
                    return NextResponse.json({ success: true, ignored: 'invalid_sender_format' });
                }

                // OPTIMIZED O(1) Search: Find group and card via indexed Contacts context
                let targetCardDoc: any = null;
                let targetGroupId: string | null = null;
                let existingContactId: string | null = null;
                let existingContactName: string | null = null;

                const contactSnap = await db.collection(`${entityPath}/contacts`)
                    .where('phone', '==', `+${cleanFrom}`)
                    .limit(1)
                    .get();

                if (!contactSnap.empty) {
                    const contactDoc = contactSnap.docs[0];
                    const contactData = contactDoc.data();
                    existingContactId = contactDoc.id;
                    existingContactName = contactData.name || contactData.contactName || contactData.firstName || null;
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

                // Fallback search across all groups - only if we haven't found a card yet
                if (!targetCardDoc) {
                    debugLog(`[POST] No card found via contact ${existingContactId}. Searching all groups...`);
                    const allMatches: any[] = [];
                    const groupsRef = db.collection(`${entityPath}/kanban-groups`);
                    const groupsSnapshot = await groupsRef.get();

                    for (const groupDoc of groupsSnapshot.docs) {
                        const cardsSnapshot = await groupDoc.ref.collection('cards')
                            .where('contactNumberClean', '==', cleanFrom)
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
                    }
                }

                // Reference used below for default group in card creation
                const groupsRef = db.collection(`${entityPath}/kanban-groups`);
                const groupsSnapshot = await groupsRef.get();

                const newMessage = {
                    sender: 'user' as const,
                    text: text,
                    timestamp: new Date(),
                    whatsappMessageId: messageId,
                    platform: 'whatsapp'
                };

                let cardId = targetCardDoc?.id;
                let groupId = targetGroupId;

                if (targetCardDoc && targetGroupId) {
                    await targetCardDoc.ref.update({
                        lastMessage: text.length > 50 ? text.substring(0, 47) + '...' : text,
                        updatedAt: new Date(),
                        unreadCount: admin.firestore.FieldValue.increment(1),
                        messages: admin.firestore.FieldValue.arrayUnion(newMessage),
                        status: 'open'
                    });
                } else {
                    // Create NEW card
                    let destinationGroupId = targetGroupId;
                    
                    // SAFEGUARD: Ensure a group exists to receive the card
                    if (!destinationGroupId) {
                        const fallbackGroup = groupsSnapshot.docs.find(g => (g.data().name || '').toLowerCase().includes('inbox')) || groupsSnapshot.docs[0];
                        if (fallbackGroup) {
                            destinationGroupId = fallbackGroup.id;
                        } else {
                            // Rule 5: Failsafe group creation if entity is empty
                            const newGroupRef = db.collection(`${entityPath}/kanban-groups`).doc('default_inbox');
                            await newGroupRef.set({
                                name: 'Inbox',
                                order: 0,
                                color: '#3B82F6',
                                createdAt: admin.firestore.FieldValue.serverTimestamp()
                            }, { merge: true });
                            destinationGroupId = 'default_inbox';
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
                            lastMessage: text.length > 50 ? text.substring(0, 47) + '...' : text,
                            updatedAt: new Date(),
                            createdAt: new Date(),
                            messages: [newMessage],
                            unreadCount: 1,
                            status: 'open',
                            source: 'whatsapp',
                            primary_channel: 'whatsapp'
                        });

                        // 2. Update/Create the Contact in the CRM Database
                        if (numericId && (finalContactName.trim() || cleanFrom.length >= 5)) {
                            await db.collection(`${entityPath}/contacts`).doc(numericId).set({
                                crmId: numericId,
                                name: finalContactName || cleanFrom,
                                contactName: finalContactName || cleanFrom,
                                phone: `+${cleanFrom}`,
                                contactNumber: from,
                                kanbanGroupId: destinationGroupId,
                                kanbanCardId: newCardRef.id,
                                updatedAt: new Date().toISOString(),
                                ...(existingContactId ? {} : { createdAt: new Date().toISOString() })
                            }, { merge: true });
                        }

                        cardId = newCardRef.id;
                        groupId = destinationGroupId;
                    }
                }

                // 4. TRIGGER UNIVERSAL CHATBOT
                if (groupId && cardId) {
                    debugLog(`[POST] Triggering universal chatbot for whatsapp in tenant ${entityId}...`);
                    processChatbotFlow({
                        userId, entityId, groupId, cardId, platform: 'whatsapp', from: from, text: text
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



