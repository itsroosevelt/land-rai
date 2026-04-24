import { NextResponse } from 'next/server';
import { db, admin } from '@/lib/firebase-admin';
import { sendMetaMessage } from '@/lib/sendProviders';
import { processChatbotFlow } from '@/lib/chatbotEngine';

const DEBUG_FILE = '/tmp/meta_webhook.log';

function debugLog(msg: string) {
    console.log(`[Meta Webhook Debug] ${msg}`);
}

function isGenericProfileName(value: any) {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return true;
    return normalized.includes('usuario meta') || normalized.includes('usuario') || normalized.includes('meta') || normalized === 'instagram user';
}

function buildMetaFallbackName(provider: 'messenger' | 'instagram', senderId: string) {
    const suffix = String(senderId || '').slice(-6) || 'contacto';
    return provider === 'instagram' ? `Instagram ${suffix}` : `Messenger ${suffix}`;
}

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    const expectedToken = process.env.kamban_VERIFY_TOKEN || 'vg37e';

    if (mode === 'subscribe' && token === expectedToken) {
        console.log('[Meta Webhook] Verification successful');
        return new Response(challenge, { status: 200 });
    }
    console.error('[Meta Webhook] Verification failed. Check your token.');
    return new Response('Forbidden', { status: 403 });
}

export async function POST(req: Request) {
    console.log('[Meta Webhook] INCOMING HIT');

    try {
        const rawBody = await req.text();
        let body;
        try {
            body = JSON.parse(rawBody);
            
            // DIAGNOSTIC PROBE: Save EVERY hit to a global collection for 5 minutes
            try {
                await db.collection('_webhook_diagnostics').add({
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    body: body,
                    object: body.object || 'unknown'
                });
            } catch (e) {
                console.error('[Diagnostic] Failed to log:', e);
            }
        } catch (e) {
            return NextResponse.json({ success: false, error: 'Invalid JSON' });
        }

        const entry = body.entry?.[0];
        if (!entry) return NextResponse.json({ success: true, ignored: 'no_entry' });

        const objectType = body.object; // 'page' or 'instagram'
        const targetId = entry.id; // Page ID or Instagram Account ID
        const messaging = entry.messaging?.[0];
        const changes = entry.changes?.[0];

        if (!messaging && !changes) {
            return NextResponse.json({ success: true, ignored: 'no_data' });
        }

        const senderId = messaging?.sender?.id || changes?.value?.from?.id;
        if (!senderId) {
             return NextResponse.json({ success: true, ignored: 'no_sender' });
        }

        const rawAttachments = messaging?.message?.attachments || [];
        const firstAttachment = rawAttachments[0];
        const quickReplyPayload = messaging?.message?.quick_reply?.payload || '';
        const visibleMessageText = messaging?.message?.text || messaging?.postback?.title || changes?.value?.text || changes?.value?.message || '';
        const botInputText = quickReplyPayload || messaging?.postback?.payload || visibleMessageText;
        let text = '';
        if (messaging) {
            if (messaging.message?.is_echo) return NextResponse.json({ success: true, ignored: 'echo' });
            text = visibleMessageText || quickReplyPayload || messaging.postback?.payload || '';
            if (!text && rawAttachments.length > 0) {
                text = firstAttachment?.type === 'image' ? '[Imagen]' : '[Multimedia/Adjunto]';
            }
        } else if (changes) {
            text = visibleMessageText || '[Interacción]';
        }

        if (!text) return NextResponse.json({ success: true, ignored: 'empty_text' });

        const senderNameFromPayload = messaging?.sender?.name || changes?.value?.from?.username || changes?.value?.from?.name || null;

        debugLog(`[POST] Searching tenant for Object: ${objectType} | Target ID: ${targetId}`);

        let tenantRef: admin.firestore.DocumentReference | null = null;
        let provider: 'messenger' | 'instagram' = objectType === 'instagram' ? 'instagram' : 'messenger';
        let tenantData: any = null;
        const numericId = parseInt(targetId);

        // 1. GLOBAL SEARCH (Try both fields for maximum compatibility)
        const integrationSnap = await db.collectionGroup('integrations').get();
        
        for (const doc of integrationSnap.docs) {
            const data = doc.data();
            const matchesPage = data.pageId === targetId || String(data.pageId) === String(targetId) || data.pageId === numericId;
            const matchesInsta = data.instagramId === targetId || String(data.instagramId) === String(targetId) || data.instagramId === numericId;

            if (matchesPage || matchesInsta) {
                tenantRef = doc.ref;
                tenantData = data;
                // Override provider based on what matched or what Meta says
                if (matchesInsta) provider = 'instagram';
                else if (matchesPage) provider = 'messenger';
                break;
            }
        }

        if (!tenantRef) {
            debugLog(`[POST] ❌ Critical: No match found for targetId ${targetId}. Ingesting to first active integration as emergency.`);
            const activeIntegrations = integrationSnap.docs.filter(d => d.data().isActive !== false);
            if (activeIntegrations.length > 0) {
                tenantRef = activeIntegrations[0].ref;
                tenantData = activeIntegrations[0].data();
                provider = objectType === 'instagram' ? 'instagram' : 'messenger';
            } else {
                return NextResponse.json({ success: false, error: 'Tenant not mapped' });
            }
        }

        const pathParts = tenantRef.path.split('/');
        const uIdx = pathParts.indexOf('users');
        const eIdx = pathParts.indexOf('entities');

        if (uIdx === -1 || eIdx === -1) return NextResponse.json({ success: false });

        const userId = pathParts[uIdx + 1];
        const entityId = pathParts[eIdx + 1];
        const entityPath = `users/${userId}/entities/${entityId}`;

        debugLog(`[POST] Tenant Discovery Success: User=${userId}, Entity=${entityId}, Provider=${provider}`);

        // ENTERPRISE LOGGING (Status visibility in CRM)
        try {
            await db.collection(`${entityPath}/system_logs`).add({
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                type: `${provider}_webhook_nextjs`,
                senderId: senderId,
                payload_type: messaging.message ? 'message' : 'postback',
                raw: JSON.stringify(body).substring(0, 1500)
            });
        } catch (e) { }

        // OMNICHANNEL INGESTION TO KANBAN
        let targetCardDoc: any = null;
        let targetGroupId: string | null = null;
        let existingContactId: string | null = null;
        let existingContactName: string | null = null;

        // 3. PRIMARY SEARCH: Try to find if user exists by meta sender ID in Contacts
        const contactSnap = await db.collection(`${entityPath}/contacts`)
            .where('metaSenderId', '==', senderId)
            .get();

        if (!contactSnap.empty) {
            const rankedContacts = contactSnap.docs.sort((a, b) => {
                const aData = a.data();
                const bData = b.data();
                const aScore =
                    ((aData.source || '').toLowerCase().includes(provider) ? 10 : 0) +
                    (aData.name && !String(aData.name).toLowerCase().includes('usuario meta') ? 3 : 0) +
                    (aData.kanbanCardId ? 2 : 0);
                const bScore =
                    ((bData.source || '').toLowerCase().includes(provider) ? 10 : 0) +
                    (bData.name && !String(bData.name).toLowerCase().includes('usuario meta') ? 3 : 0) +
                    (bData.kanbanCardId ? 2 : 0);
                if (bScore !== aScore) return bScore - aScore;
                const aTime = aData.updatedAt?.toMillis?.() || aData.updatedAt?.seconds * 1000 || 0;
                const bTime = bData.updatedAt?.toMillis?.() || bData.updatedAt?.seconds * 1000 || 0;
                return bTime - aTime;
            });
            const contactDoc = rankedContacts[0];
            const contactData = contactDoc.data();
            existingContactId = contactDoc.id;
            existingContactName = contactData.name || null;
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

        // 4. CAPTURE REAL PROFILE NAME FROM META (Critical for identity & fusion)
        // Priority: payload name > existing stored name > Graph API call > fallback
        let resolvedName = senderNameFromPayload || existingContactName;
        const isGenericName = isGenericProfileName(resolvedName) || resolvedName === senderId;

        if (isGenericName) {
            try {
                // Try multiple token fields — integrations may save under different keys
                const token = tenantData?.accessToken || tenantData?.pageAccessToken || tenantData?.token;
                if (token) {
                    // Request broad fields and fall back gracefully
                    const fields = provider === 'instagram'
                        ? 'name,username,biography'
                        : 'name,first_name,last_name';

                    const profileUrl = `https://graph.facebook.com/v21.0/${senderId}?fields=${fields}&access_token=${token}`;
                    const profileRes = await fetch(profileUrl);
                    const profileData = await profileRes.json();

                    if (profileData?.error) {
                        // Log the full error so we can diagnose permission issues
                        debugLog(`[Profile Fetch] Meta API Error: ${JSON.stringify(profileData.error)}`);
                    } else if (profileData) {
                        if (provider === 'instagram') {
                            resolvedName = profileData.username || profileData.name || resolvedName;
                        } else {
                            // Prefer full 'name' field; fallback to first+last
                            const fullName = profileData.name ||
                                `${profileData.first_name || ''} ${profileData.last_name || ''}`.trim();
                            if (fullName) resolvedName = fullName;
                        }
                        debugLog(`[Profile Fetch] Resolved name: "${resolvedName}" for senderId: ${senderId}`);
                    }
                } else {
                    debugLog(`[Profile Fetch] No access token available in tenantData. Keys: ${Object.keys(tenantData || {}).join(', ')}`);
                }
            } catch (err) {
                debugLog(`[Profile Fetch] Exception: ${err}`);
            }
        }


        // 5. SAFE FUSION: If no contact found by metaSenderId, try searching by name
        if (!existingContactId && resolvedName) {
            const nameMatchSnap = await db.collection(`${entityPath}/contacts`)
                .where('name', '==', resolvedName)
                .get();
            
            // ARCHITECT RULE: Only merge if exactly ONE found and it doesn't have a conflicting platform ID
            if (nameMatchSnap.size === 1) {
                const potentialContact = nameMatchSnap.docs[0];
                const pData = potentialContact.data();
                if (!pData.metaSenderId || pData.metaSenderId === senderId) {
                    existingContactId = potentialContact.id;
                    existingContactName = resolvedName;
                    targetGroupId = pData.kanbanGroupId;
                    const contactCardId = pData.kanbanCardId;

                    if (targetGroupId && contactCardId) {
                        const cardRef = db.doc(`${entityPath}/kanban-groups/${targetGroupId}/cards/${contactCardId}`);
                        const cardGet = await cardRef.get();
                        if (cardGet.exists) {
                            targetCardDoc = cardGet;
                            debugLog(`[Safe Fusion] Link successful with contact ${existingContactId} (${resolvedName})`);
                        }
                    }
                }
            }
        }

        // 6. FALLBACK SEARCH: collectionGroup query (COLLECTION_GROUP index, avoids per-group loop)
        if (!targetCardDoc) {
            debugLog(`[POST] No card found via contact. Searching collectionGroup for platform_ids.${provider} == ${senderId}...`);
            const allCardsSnap = await db.collectionGroup('cards')
                .where(`platform_ids.${provider}`, '==', senderId)
                .get();

            const tenantCards = allCardsSnap.docs
                .filter(d => d.ref.path.startsWith(entityPath + '/'))
                .sort((a, b) => {
                    const tA = (a.data().updatedAt?.toDate?.() || new Date(0)).getTime();
                    const tB = (b.data().updatedAt?.toDate?.() || new Date(0)).getTime();
                    return tB - tA;
                });

            if (tenantCards.length > 0) {
                targetCardDoc = tenantCards[0];
                const pathParts = tenantCards[0].ref.path.split('/');
                const gIdx = pathParts.indexOf('kanban-groups');
                targetGroupId = gIdx !== -1 ? pathParts[gIdx + 1] : null;
                debugLog(`[POST] Found existing card via collectionGroup: ${targetCardDoc.id} in group ${targetGroupId}`);
            }
        }

        if (targetCardDoc && isGenericProfileName(resolvedName)) {
            const cardData = targetCardDoc.data();
            if (!isGenericProfileName(cardData?.contactName)) {
                resolvedName = cardData.contactName;
            }
        }

        if (!targetCardDoc && existingContactId) {
            debugLog(`[POST] No card found yet. Searching collectionGroup for contactId/crmId == ${existingContactId}...`);
            const [byContactIdSnap, byCrmIdSnap] = await Promise.all([
                db.collectionGroup('cards').where('contactId', '==', existingContactId).get(),
                db.collectionGroup('cards').where('crmId', '==', existingContactId).get()
            ]);

            const tenantCards = [...byContactIdSnap.docs, ...byCrmIdSnap.docs]
                .filter((doc, idx, arr) => arr.findIndex(d => d.ref.path === doc.ref.path) === idx)
                .filter(d => d.ref.path.startsWith(entityPath + '/'))
                .sort((a, b) => {
                    const tA = (a.data().updatedAt?.toDate?.() || new Date(0)).getTime();
                    const tB = (b.data().updatedAt?.toDate?.() || new Date(0)).getTime();
                    return tB - tA;
                });

            if (tenantCards.length > 0) {
                targetCardDoc = tenantCards[0];
                const pathParts = tenantCards[0].ref.path.split('/');
                const gIdx = pathParts.indexOf('kanban-groups');
                targetGroupId = gIdx !== -1 ? pathParts[gIdx + 1] : null;
                debugLog(`[POST] Found existing card via contactId/crmId: ${targetCardDoc.id} in group ${targetGroupId}`);
            }
        }

        if (targetCardDoc && !existingContactId) {
            const cardData = targetCardDoc.data();
            const linkedContactId = cardData?.contactId || cardData?.crmId || null;
            if (linkedContactId) {
                const linkedContactRef = db.collection(`${entityPath}/contacts`).doc(linkedContactId);
                const linkedContactSnap = await linkedContactRef.get();
                if (linkedContactSnap.exists) {
                    const linkedContactData = linkedContactSnap.data() || {};
                    existingContactId = linkedContactSnap.id;
                    existingContactName = linkedContactData.name || existingContactName;
                    if (isGenericProfileName(resolvedName) && !isGenericProfileName(existingContactName)) {
                        resolvedName = existingContactName;
                    }
                }
            }
        }

        const groupsRef = db.collection(`${entityPath}/kanban-groups`);
        const groupsSnapshot = await groupsRef.get();
        const finalResolvedName = !isGenericProfileName(resolvedName)
            ? resolvedName
            : !isGenericProfileName(existingContactName)
                ? existingContactName
                : buildMetaFallbackName(provider, senderId);

        const newMessage = {
            sender: 'user',
            text: text,
            timestamp: admin.firestore.Timestamp.now(),
            messageId: messaging.message?.mid || `mid_${Date.now()}`,
            platform: provider,
            ...(firstAttachment ? {
                fileUrl: firstAttachment?.payload?.url || null,
                fileType: firstAttachment?.type === 'image' ? 'image/*' :
                    firstAttachment?.type === 'video' ? 'video/*' :
                    firstAttachment?.type === 'audio' ? 'audio/*' :
                    'application/octet-stream',
                fileName: firstAttachment?.name || null,
                type: 'media',
                metadata: {
                    attachments: rawAttachments.map((attachment: any) => ({
                        type: attachment?.type || null,
                        url: attachment?.payload?.url || null,
                        name: attachment?.name || null
                    }))
                }
            } : {})
        };

        let cardId = targetCardDoc?.id;
        let groupId = targetGroupId;

        if (targetCardDoc && targetGroupId) {
            const queueItem = {
                text: botInputText || text || '',
                messageId: messaging.message?.mid || `mid_${Date.now()}`,
                platform: provider,
                from: senderId,
                timestamp: Date.now()
            };

            // UPDATING EXISTING CARD
            await targetCardDoc.ref.update({
                contactName: finalResolvedName,
                lastMessage: text.length > 40 ? text.substring(0, 37) + '...' : text,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                unreadCount: admin.firestore.FieldValue.increment(1),
                messages: admin.firestore.FieldValue.arrayUnion(newMessage),
                'botState.messageQueue': admin.firestore.FieldValue.arrayUnion(queueItem),
                status: 'open',
                source: provider.toUpperCase(),
                primary_channel: provider.toLowerCase(),
                contactId: existingContactId || targetCardDoc.data()?.contactId || null,
                crmId: existingContactId || targetCardDoc.data()?.crmId || null,
                [`platform_ids.${provider.toLowerCase()}`]: senderId
            });

            // Sincronizar metaSenderId, source y nombre con el contacto existente
            if (existingContactId) {
                await db.collection(`${entityPath}/contacts`).doc(existingContactId).update({
                    name: finalResolvedName,
                    metaSenderId: senderId,
                    kanbanGroupId: targetGroupId,
                    kanbanCardId: targetCardDoc.id,
                    source: provider.toUpperCase(),
                    updatedAt: admin.firestore.Timestamp.now()
                });
            }
        } else {
            // Create NEW card in Inbox
            let destinationGroupId = targetGroupId;
            if (!destinationGroupId) {
                const fallbackGroup = groupsSnapshot.docs.find(g => (g.data().name || '').toLowerCase().includes('inbox')) || groupsSnapshot.docs[0];
                destinationGroupId = fallbackGroup ? fallbackGroup.id : 'default_inbox';

                if (destinationGroupId === 'default_inbox') {
                    await db.collection(`${entityPath}/kanban-groups`).doc('default_inbox').set({
                        name: 'Inbox', order: 0, color: '#3B82F6', createdAt: admin.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });
                }
            }

            const newCardRef = db.collection(`${entityPath}/kanban-groups/${destinationGroupId}/cards`).doc();
            const contactIdToUse = existingContactId || String(Date.now()).slice(-10);

            const queueItem = {
                text: botInputText || text || '',
                messageId: messaging.message?.mid || `mid_${Date.now()}`,
                platform: provider,
                from: senderId,
                timestamp: Date.now()
            };

            await newCardRef.set({
                crmId: contactIdToUse,
                contactId: contactIdToUse,
                contactName: finalResolvedName,
                contactNumber: senderId,
                metaSenderId: senderId,
                lastMessage: text.length > 1024 ? text.substring(0, 1021) + '...' : text,
                updatedAt: admin.firestore.Timestamp.now(),
                createdAt: admin.firestore.Timestamp.now(),
                messages: [newMessage],
                'botState.messageQueue': [queueItem],
                unreadCount: 1,
                status: 'open',
                source: provider.toUpperCase(),
                primary_channel: provider.toLowerCase(),
                platform_ids: { [provider.toLowerCase()]: senderId }
            });

            const contactPayload: any = {
                crmId: contactIdToUse,
                name: finalResolvedName,
                metaSenderId: senderId,
                kanbanGroupId: destinationGroupId,
                kanbanCardId: newCardRef.id,
                source: provider.toUpperCase(),
                updatedAt: admin.firestore.Timestamp.now(),
            };

            if (!existingContactId) {
                contactPayload.createdAt = admin.firestore.Timestamp.now();
            }

            await db.collection(`${entityPath}/contacts`).doc(contactIdToUse).set(contactPayload, { merge: true });

            cardId = newCardRef.id;
            groupId = destinationGroupId;
        }

        // 4. TRIGGER UNIVERSAL CHATBOT
        if (groupId && cardId) {
            console.log(`[Meta Webhook] 🤖 Triggering chatbot for ${provider} | User: ${userId} | Entity: ${entityId}`);
            
            // TELEMETRY: Mark ingestion as successful in system logs
            try {
                await db.collection(`${entityPath}/system_logs`).add({
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    type: `webhook_ingested_${provider}`,
                    text: text.substring(0, 50),
                    cardId: cardId
                });
            } catch (e) {}

            try {
                await processChatbotFlow({
                    userId, entityId, groupId, cardId, platform: provider, from: senderId, text: botInputText || text,
                    messageId: messaging.message?.mid || `mid_${Date.now()}`
                });
                console.log(`[Meta Webhook] ✅ Chatbot process completed for ${senderId}`);
            } catch (botError: any) {
                console.error(`[Meta Webhook] ❌ Chatbot Error for ${senderId}:`, botError.message);
                debugLog(`[Universal Engine Error] ${botError}`);
            }
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: 'Webhook Crash: ' + (error.message || 'Unknown'),
            details: error.stack?.split('\n').slice(0, 2)
        }, { status: 500 });
    }
}

// Triggering deployment with verified identity
