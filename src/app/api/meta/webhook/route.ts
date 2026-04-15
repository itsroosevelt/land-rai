import { NextResponse } from 'next/server';
import { db, admin } from '@/lib/firebase-admin';
import { sendMetaMessage } from '@/lib/sendProviders';
import { processChatbotFlow } from '@/lib/chatbotEngine';

const DEBUG_FILE = '/tmp/meta_webhook.log';

function debugLog(msg: string) {
    console.log(`[Meta Webhook Debug] ${msg}`);
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
        } catch (e) {
            return NextResponse.json({ success: false, error: 'Invalid JSON' });
        }

        const entry = body.entry?.[0];
        if (!entry) return NextResponse.json({ success: true, ignored: 'no_entry' });

        const targetId = entry.id; // Page ID or Instagram Account ID
        const messaging = entry.messaging?.[0];
        const changes = entry.changes?.[0]; // Support for Instagram comments/mentions

        if (!messaging && !changes) {
            return NextResponse.json({ success: true, ignored: 'no_data' });
        }

        const senderId = messaging?.sender?.id || changes?.value?.from?.id;
        if (!senderId) {
             return NextResponse.json({ success: true, ignored: 'no_sender' });
        }

        let text = '';

        if (messaging) {
            if (messaging.message?.is_echo) {
                return NextResponse.json({ success: true, ignored: 'echo' });
            }
            // Prioritize Quick Reply payload, then text
            text = messaging.message?.quick_reply?.payload || messaging.message?.text || messaging.postback?.payload || messaging.postback?.title || '';
            
            if (!text && messaging.message?.attachments) {
                text = '[Multimedia/Adjunto]';
            }
        } else if (changes) {
            text = changes.value?.text || changes.value?.message || '[Interacción]';
        }

        if (!text) {
            return NextResponse.json({ success: true, ignored: 'empty_text' });
        }

        // Try to extract name directly from payload (fastest, no API needed)
        const senderNameFromPayload =
            messaging?.sender?.name ||
            changes?.value?.from?.username ||
            null;

        debugLog(`[POST] Searching tenant for Target ID: ${targetId} | From: ${senderId}`);


        // Search for the Tenant globally
        let tenantRef: admin.firestore.DocumentReference | null = null;
        let provider: 'messenger' | 'instagram' = 'messenger';

        // SUPPORT BOTH STRING AND NUMBER IDS (Agnostic normalization)
        const numericId = parseInt(targetId);

        let tenantData: any = null;

        // 1. GLOBAL MULTI-PLATFORM SEARCH (Cross-Mapping Rule)
        const crossSnap = await db.collectionGroup('integrations')
            .where('pageId', 'in', [targetId, String(targetId), numericId])
            .get();

        const crossSnapInsta = await db.collectionGroup('integrations')
            .where('instagramId', 'in', [targetId, String(targetId), numericId])
            .get();

        if (!crossSnap.empty) {
            tenantRef = crossSnap.docs[0].ref;
            tenantData = crossSnap.docs[0].data();
            provider = 'messenger';
            debugLog(`[POST] Resolved Messenger tenant via CrossMapping: ${tenantRef.path}`);
        } else if (!crossSnapInsta.empty) {
            tenantRef = crossSnapInsta.docs[0].ref;
            tenantData = crossSnapInsta.docs[0].data();
            provider = 'instagram';
            debugLog(`[POST] Resolved Instagram tenant via CrossMapping: ${tenantRef.path}`);
        } else {
            // EMERGENCY BYPASS: If still not found but only one integration exists globally, use it.
            const allIntegrations = await db.collectionGroup('integrations')
                .where('isActive', 'in', [true, 'true', undefined])
                .get();

            if (allIntegrations.size >= 1) {
                // We pick the first matching provider if possible, otherwise fallback
                const doc = allIntegrations.docs[0];
                tenantRef = doc.ref;
                tenantData = doc.data();
                
                // If we know it was a Messenger entry but we found generic integrations, 
                // prioritize the one that actually matches the expected provider.
                const possibleProvider = tenantData.instagramId ? 'instagram' : 'messenger';
                console.warn(`[Meta Webhook] ⚠️ Exact pageId match failed for ${targetId}. Falling back to first found integration: ${possibleProvider}`);
                provider = possibleProvider;
                debugLog(`[POST] ⚠️ Fallback Resolve: Using first found integration: ${tenantRef.path}`);
            } else {
                debugLog(`[POST] ❌ Critical: No match found for targetId ${targetId}`);
            }
        }

        if (!tenantRef) {
            debugLog(`[POST] ❌ ALERTA: No se pudo resolver el tenant para Target ID: ${targetId}.`);
            
            // EMERGENCY BYPASS: If only one integration exists globally, use it (robustness for single-tenant users)
            const allIntegrations = await db.collectionGroup('integrations').get();
            if (allIntegrations.size === 1) {
                const doc = allIntegrations.docs[0];
                tenantRef = doc.ref;
                tenantData = doc.data();
                provider = tenantData.instagramId ? 'instagram' : 'messenger';
                debugLog(`[POST] ⚠️ Emergency Bypass: Only one integration found, defaulting to ${tenantRef.path}`);
            } else {
                return NextResponse.json({
                    success: false,
                    error: 'Tenant not mapped',
                    incomingId: targetId,
                    note: 'Ensure this ID is correctly stored in your integrations collection'
                });
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
            .limit(1)
            .get();

        if (!contactSnap.empty) {
            const contactDoc = contactSnap.docs[0];
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
        const isGenericName = !resolvedName ||
            resolvedName.toLowerCase().includes('usuario') ||
            resolvedName.toLowerCase().includes('meta') ||
            resolvedName === senderId;

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
                            resolvedName = profileData.username
                                ? `@${profileData.username}`
                                : (profileData.name || resolvedName);
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

        // 6. FALLBACK SEARCH: If still no card, scan groups (like WhatsApp does)
        if (!targetCardDoc) {
            debugLog(`[POST] No card found via contact. Searching all groups for platform_ids.${provider} == ${senderId}...`);
            const allMatches: any[] = [];
            const groupsRef = db.collection(`${entityPath}/kanban-groups`);
            const groupsSnapshot = await groupsRef.get();

            for (const groupDoc of groupsSnapshot.docs) {
                const cardsSnapshot = await groupDoc.ref.collection('cards')
                    .where(`platform_ids.${provider}`, '==', senderId)
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
                debugLog(`[POST] Found existing card via Deep Search: ${targetCardDoc.id} in group ${targetGroupId}`);
            }
        }

        const groupsRef = db.collection(`${entityPath}/kanban-groups`);
        const groupsSnapshot = await groupsRef.get();

        const newMessage = {
            sender: 'user',
            text: text,
            timestamp: admin.firestore.Timestamp.now(),
            messageId: messaging.message?.mid || `mid_${Date.now()}`,
            platform: provider
        };

        let cardId = targetCardDoc?.id;
        let groupId = targetGroupId;

        if (targetCardDoc && targetGroupId) {
            const queueItem = {
                text: text || '',
                messageId: messaging.message?.mid || `mid_${Date.now()}`,
                platform: provider,
                from: senderId,
                timestamp: Date.now()
            };

            // UPDATING EXISTING CARD
            await targetCardDoc.ref.update({
                contactName: resolvedName || existingContactName,
                lastMessage: text.length > 40 ? text.substring(0, 37) + '...' : text,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                unreadCount: admin.firestore.FieldValue.increment(1),
                messages: admin.firestore.FieldValue.arrayUnion(newMessage),
                'botState.messageQueue': admin.firestore.FieldValue.arrayUnion(queueItem),
                status: 'open',
                source: provider.toUpperCase(),
                primary_channel: provider.toLowerCase(),
                [`platform_ids.${provider.toLowerCase()}`]: senderId
            });

            // Sincronizar metaSenderId, source y nombre con el contacto existente
            if (existingContactId) {
                await db.collection(`${entityPath}/contacts`).doc(existingContactId).update({
                    name: resolvedName || existingContactName,
                    metaSenderId: senderId,
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
                text: text || '',
                messageId: messaging.message?.mid || `mid_${Date.now()}`,
                platform: provider,
                from: senderId,
                timestamp: Date.now()
            };

            await newCardRef.set({
                crmId: contactIdToUse,
                contactName: resolvedName || 'Usuario Meta',
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
                name: resolvedName || 'Usuario Meta',
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
                    userId, entityId, groupId, cardId, platform: provider, from: senderId, text: text,
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
