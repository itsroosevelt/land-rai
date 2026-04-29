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

        // 🚨 CAJA NEGRA: Log de emergencia para rastrear el fallo
        await db.collection('DEBUG_WEBHOOK').add({
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            phoneId: recipientPhoneNumberId,
            body: JSON.stringify(body).substring(0, 500)
        }).catch(() => {});

        // 1. TENANT IDENTIFICATION (Optimized O(1) Indexed Lookup)
        debugLog(`[POST] Searching tenant for Phone ID: ${recipientPhoneNumberId}`);

        let userId = searchParams.get('u');
        let entityId = searchParams.get('e');

        if (!userId || !entityId) {
            try {
                // Rule 4: Isolated Data Vault - Search across all entity integrations
                const tenantSnap = await db.collectionGroup('integrations')
                    .where('phoneNumberId', '==', recipientPhoneNumberId)
                    .limit(1)
                    .get();
                
                if (!tenantSnap.empty) {
                    const doc = tenantSnap.docs[0];
                    const pathParts = doc.ref.path.split('/');
                    const uIdx = pathParts.indexOf('users');
                    const eIdx = pathParts.indexOf('entities');
                    
                    if (uIdx !== -1 && eIdx !== -1) {
                        // Priority: Always use the ACTUAL folder names from the path (UID/EntityID)
                        userId = pathParts[uIdx + 1];
                        entityId = pathParts[eIdx + 1];
                        console.log(`[Discovery] 🎯 Resolved Tenant from Path: ${userId}/${entityId}`);
                    }
                }
            } catch (indexError) {
                console.error(`[Discovery] ⚠️ Index Fail: ${indexError}`);
            }
        }

        if (userId && entityId) {
            // 🔍 VALIDACIÓN DE CASING: Asegurar que el userId existe con el casing correcto
            const userRef = db.collection('users').doc(userId);
            const userSnap = await userRef.get();
            
            if (!userSnap.exists) {
                console.log(`[Discovery] ⚠️ Casing Mismatch: ${userId} not found. Searching for correct casing...`);
                const allUsers = await db.collection('users').get();
                const match = allUsers.docs.find(u => u.id.toLowerCase() === userId?.toLowerCase());
                if (match) {
                    console.log(`[Discovery] ✅ Casing Corrected: ${userId} -> ${match.id}`);
                    userId = match.id;
                }
            }
            
            debugLog(`[POST] Tenant Discovery Success: User=${userId}, Entity=${entityId}`);
            
            // EMERGENCY LOG TO ENTITY BÓVEDA
            try {
                await db.collection(`users/${userId}/entities/${entityId}/internal_logs`).add({
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    type: 'whatsapp_webhook',
                    phoneId: recipientPhoneNumberId || 'unknown',
                    payload_type: value?.messages ? 'message' : (value?.statuses ? 'status' : 'other'),
                    raw: JSON.stringify(body).substring(0, 1500)
                });
            } catch (e) {}
        }

        if (!userId || !entityId) {
            debugLog(`[POST] ❌ ABORT: Could not resolve tenant for Phone ID ${recipientPhoneNumberId}.`);
            return NextResponse.json({ success: false, error: 'Tenant not mapped' });
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
                let cardId: string | null = null;
                let groupId: string | null = null;

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
                            cardId = contactCardId; // 🎯 FIX: Asignar ID para el Chatbot
                            groupId = targetGroupId; // 🎯 FIX: Asignar ID para el Chatbot
                        } else {
                            // 👻 LIMPIEZA DE FANTASMAS: Si la tarjeta fue borrada, permitimos crear una nueva
                            console.log(`[WhatsApp Webhook] 👻 Ghost card ${contactCardId} detected. Clearing reference to allow re-creation.`);
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
                        cardId = targetCardDoc.id;
                        groupId = targetGroupId;
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

                const queueItem = {
                    text: text || '',
                    messageId: messageId || `wa_${Date.now()}`,
                    platform: 'whatsapp',
                    from: from,
                    timestamp: Date.now()
                };

                if (targetCardDoc && targetGroupId) {
                    // 🛡️ PROTECCIÓN DE IDENTIDAD: No sobrescribir nombres manuales
                    const isGenericName = (val: string) => {
                        const n = (val || '').toLowerCase().trim();
                        return !n || n === 'undefined' || n === 'whatsapp user' || n.includes('ec +') || n.includes('user');
                    };

                    const currentName = targetCardDoc.data()?.contactName || '';
                    const shouldUpdateName = !currentName || isGenericName(currentName);

                    const cardUpdate: any = {
                        lastMessage: text.length > 40 ? text.substring(0, 37) + '...' : text,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        unreadCount: admin.firestore.FieldValue.increment(1),
                        messages: admin.firestore.FieldValue.arrayUnion(newMessage),
                        'botState.messageQueue': admin.firestore.FieldValue.arrayUnion(queueItem),
                        status: 'open',
                        source: 'WHATSAPP',
                        primary_channel: 'whatsapp',
                        channel: 'whatsapp'
                    };

                    if (shouldUpdateName) {
                        const profileName = value?.contacts?.[0]?.profile?.name || '';
                        cardUpdate.contactName = profileName || 'WhatsApp User';
                    }

                    await targetCardDoc.ref.update(cardUpdate);

                    // Sincronizar contacto
                    if (existingContactId) {
                        const contactUpdate: any = {
                            updatedAt: admin.firestore.Timestamp.now(),
                            kanbanGroupId: groupId,
                            kanbanCardId: cardId
                        };
                        if (shouldUpdateName) {
                            const profileName = value?.contacts?.[0]?.profile?.name || '';
                            contactUpdate.name = profileName || 'WhatsApp User';
                        }
                        await db.collection(`${entityPath}/contacts`).doc(existingContactId).update(contactUpdate);
                    }
                } else {
                    // Create NEW card
                    // 🎯 CLASIFICACIÓN POR BANDEJAS (Rule 1 & 5)
                    let destinationGroupId = targetGroupId;
                    
                    if (!destinationGroupId) {
                        const channelKey = (message.platform || 'whatsapp').toLowerCase();
                        const channelLabel = channelKey.charAt(0).toUpperCase() + channelKey.slice(1);
                        
                        // Use channel-specific group ID
                        destinationGroupId = `group_${channelKey}`;
                        
                        const groupRef = db.collection(`${entityPath}/kanban-groups`).doc(destinationGroupId);
                        const groupSnap = await groupRef.get();
                        
                        if (!groupSnap.exists) {
                            console.log(`[Kanban] 📦 Creating dedicated tray for: ${channelLabel}`);
                            await groupRef.set({
                                id: destinationGroupId,
                                name: channelLabel,
                                type: channelKey,
                                order: channelKey === 'whatsapp' ? 1 : 2,
                                color: channelKey === 'whatsapp' ? '#25D366' : '#E1306C',
                                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                                updatedAt: admin.firestore.FieldValue.serverTimestamp()
                            }, { merge: true });
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

                        const queueItem = {
                            text: text || '',
                            messageId: messageId || `wa_${Date.now()}`,
                            platform: 'whatsapp',
                            from: from,
                            timestamp: Date.now()
                        };

                        await newCardRef.set({
                            crmId: numericId,
                            contactName: finalContactName,
                            contactNumber: from,
                            contactNumberClean: cleanFrom,
                            lastMessage: text.length > 50 ? text.substring(0, 47) + '...' : text,
                            updatedAt: new Date(),
                            createdAt: new Date(),
                            messages: [newMessage],
                            'botState.messageQueue': [queueItem],
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
                const chatbotGroupId = groupId || targetGroupId || targetCardDoc?.ref.parent.parent?.id;
                const chatbotCardId = cardId || targetCardDoc?.id;

                console.log(`[Webhook] 🎯 PRE-BOT STATE: userId=${userId} entityId=${entityId} groupId=${chatbotGroupId} cardId=${chatbotCardId} text="${text}"`);

                if (chatbotGroupId && chatbotCardId) {
                    // Log diagnóstico en Firestore
                    db.collection('DEBUG_WEBHOOK').add({
                        timestamp: admin.firestore.FieldValue.serverTimestamp(),
                        type: 'chatbot_trigger',
                        cardId: chatbotCardId,
                        groupId: chatbotGroupId,
                        userId,
                        entityId,
                        text
                    }).catch(() => {});

                    processChatbotFlow({
                        userId,
                        entityId,
                        groupId: chatbotGroupId,
                        cardId: chatbotCardId,
                        platform: 'whatsapp',
                        from,
                        text
                    }).catch(botError => {
                        console.error(`[Chatbot FATAL]`, botError?.message || botError);
                        // Log error en Firestore
                        db.collection('DEBUG_WEBHOOK').add({
                            timestamp: admin.firestore.FieldValue.serverTimestamp(),
                            type: 'chatbot_error',
                            error: botError?.message || String(botError),
                            cardId: chatbotCardId,
                            userId
                        }).catch(() => {});
                    });
                } else {
                    console.error(`[Webhook] ❌ ABORT BOT: groupId=${chatbotGroupId} cardId=${chatbotCardId}`);
                    db.collection('DEBUG_WEBHOOK').add({
                        timestamp: admin.firestore.FieldValue.serverTimestamp(),
                        type: 'chatbot_abort',
                        reason: 'missing_ids',
                        chatbotGroupId,
                        chatbotCardId,
                        userId,
                        entityId
                    }).catch(() => {});
                }

            }
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        debugLog(`[POST CRASH] ${error.stack || error.message}`);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}



