import { NextResponse } from 'next/server';
import { db, admin } from '@/lib/firebase-admin';
import { sendMetaMessage } from '@/lib/sendProviders';
import { processChatbotFlow } from '@/lib/chatbotEngine';

const DEBUG_FILE = '/tmp/meta_webhook.log';

import fs from 'fs';

function debugLog(msg: string) {
    const logStr = `\n[${new Date().toISOString()}] [Meta Webhook Debug] ${msg}`;
    console.log(logStr);
    try {
        fs.appendFileSync('/tmp/meta_webhook_debug.log', logStr);
    } catch (e) {}
}

function isGenericProfileName(value: any) {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized || normalized === 'undefined' || normalized === 'null') return true;
    
    // Check for common generic keywords
    const isGenericKeyword = normalized.includes('usuario meta') || 
                             normalized.includes('usuario') || 
                             normalized.includes('meta') || 
                             normalized === 'instagram user' ||
                             normalized === 'messenger user';

    // Check for system fallbacks like "Instagram 123456" or "Messenger 123456"
    const isSystemFallback = /^instagram [a-f0-9]{6}$/i.test(normalized) || 
                             /^messenger [a-f0-9]{6}$/i.test(normalized) ||
                             /^[a-z]+ [0-9]+$/i.test(normalized);

    return isGenericKeyword || isSystemFallback;
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
            
        // Diagnostic logging to root collection removed per Master Mold rules
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
            // Ensure we are in a valid entity path before even checking IDs (Rule 7)
            if (!doc.ref.path.includes('users/') || !doc.ref.path.includes('/entities/')) continue;

            const data = doc.data();
            const matchesPage = data.pageId === targetId || String(data.pageId) === String(targetId) || data.pageId === numericId;
            const matchesInsta = data.instagramId === targetId || String(data.instagramId) === String(targetId) || data.instagramId === numericId;

            if (matchesPage || matchesInsta) {
                tenantRef = doc.ref;
                tenantData = data;
                if (matchesInsta) provider = 'instagram';
                else if (matchesPage) provider = 'messenger';
                
                // DIAGNOSTIC LOG (Rule 5 & 7 compliant)
                const pParts = doc.ref.path.split('/');
                const uId = pParts[1];
                const eId = pParts[3];
                debugLog(`[Meta Webhook] ✅ MATCH FOUND: Message for ${targetId} routed to User: ${uId}, Entity: ${eId}`);
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
        debugLog(`[POST] Identified EntityPath: ${entityPath}`);

        debugLog(`[POST] Tenant Discovery Success: User=${userId}, Entity=${entityId}, Provider=${provider}`);

        // ENTERPRISE LOGGING (Status visibility in CRM)
        try {
            await db.collection(`${entityPath}/internal_logs`).add({
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                type: `${provider}_webhook_nextjs`,
                senderId: senderId,
                payload_type: messaging.message ? 'message' : 'postback',
                raw: JSON.stringify(body).substring(0, 1500)
            });
        } catch (e) { }

        // 0. MESSAGE DEDUPLICATION (Antispam)
        const messageId = messaging?.message?.mid || changes?.message_id || `temp_${Date.now()}_${senderId}`;
        const dedupRef = db.doc(`${entityPath}/processed_messages/${messageId}`);
        try {
            const dedupSnap = await dedupRef.get();
            if (dedupSnap.exists) {
                const data = dedupSnap.data();
                if (data && Date.now() - data.timestamp < 300000) {
                    debugLog(`[POST] 🛡️ Duplicate message detected (${messageId}). Skipping.`);
                    return NextResponse.json({ success: true, duplicate: true });
                }
            }
            await dedupRef.set({ timestamp: Date.now(), senderId: senderId, type: 'meta_ingestion' });
        } catch (e) { console.error("[Dedup] Error:", e); }

        // 0.B GLOBAL SENDER LOCK (Strict prevention of double card creation)
        const lockRef = db.doc(`${entityPath}/locks_ingestion/${senderId}`);
        try {
            const lockSnap = await lockRef.get();
            if (lockSnap.exists) {
                const lockData = lockSnap.data();
                if (lockData && (Date.now() - lockData.timestamp < 3000)) {
                    // If locked less than 3s ago, wait a bit and check for card again
                    debugLog(`[Webhook] 🛡️ Race-Condition Lock active for ${senderId}. Waiting 1s...`);
                    await new Promise(r => setTimeout(r, 1000));
                    // Re-run contact search later
                }
            }
            await lockRef.set({ timestamp: Date.now() }, { merge: true });
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
                    (aData.name && !isGenericProfileName(aData.name) ? 3 : 0) +
                    (aData.kanbanCardId ? 2 : 0);
                const bScore =
                    ((bData.source || '').toLowerCase().includes(provider) ? 10 : 0) +
                    (bData.name && !isGenericProfileName(bData.name) ? 3 : 0) +
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
                } else {
                    // CRITICAL: Cleanup ghost reference in contact to allow re-creation
                    debugLog(`[Webhook] 👻 GHOST CARD DETECTED: ${contactCardId}. Clearing reference from contact ${existingContactId}`);
                    await contactDoc.ref.update({
                        kanbanCardId: admin.firestore.FieldValue.delete(),
                        kanbanGroupId: admin.firestore.FieldValue.delete()
                    }).catch(() => {});
                    targetGroupId = null;
                }
            }
        }

        // 4. CAPTURE REAL PROFILE NAME FROM META (Critical for identity & fusion)
        let resolvedName = senderNameFromPayload || existingContactName;
        const isGenericName = isGenericProfileName(resolvedName) || resolvedName === senderId;

        if (isGenericName) {
            try {
                const token = tenantData?.accessToken || tenantData?.pageAccessToken || tenantData?.token;
                if (token) {
                    // Try multiple fields to bypass permission gaps
                    const fields = provider === 'instagram'
                        ? 'name,username,profile_pic,first_name,last_name'
                        : 'name,first_name,last_name,profile_pic';

                    const profileUrl = `https://graph.facebook.com/v21.0/${senderId}?fields=${fields}&access_token=${token}`;
                    const profileRes = await fetch(profileUrl);
                    const profileData = await profileRes.json();

                    if (profileData && !profileData.error) {
                        const fullName = profileData.name || 
                                       `${profileData.first_name || ''} ${profileData.last_name || ''}`.trim() ||
                                       profileData.username;
                        
                        if (fullName && !isGenericProfileName(fullName)) {
                            resolvedName = fullName;
                            debugLog(`[Profile Fetch] ✅ Resolved: "${resolvedName}"`);
                        }
                    }
                }
            } catch (err) { }
        }

        // 5. SAFETY CHECK: Re-verify card existence JUST before creation (Universal Deduplication)
        debugLog(`[POST] Phase 5: Anti-Duplicate DB Checks...`);
        if (!targetCardDoc) {
             const finalSafetySnap = await db.collectionGroup('cards')
                .where('metaSenderId', '==', senderId)
                .get();
             const entityCards = finalSafetySnap.docs.filter(d => d.ref.path.startsWith(entityPath + '/'));
             if (entityCards.length > 0) {
                 targetCardDoc = entityCards.sort((a,b) => (b.data().updatedAt?.seconds || 0) - (a.data().updatedAt?.seconds || 0))[0];
                 const pathParts = targetCardDoc.ref.path.split('/');
                 const gIdx = pathParts.indexOf('kanban-groups');
                 targetGroupId = gIdx !== -1 ? pathParts[gIdx + 1] : null;
                 debugLog(`[Webhook] 🛡️ Final Safety: Blocked double creation for ${senderId}`);
             }
        }

        const groupsRef = db.collection(`${entityPath}/kanban-groups`);
        const groupsSnapshot = await groupsRef.get();
        const finalResolvedName = !isGenericProfileName(resolvedName)
            ? resolvedName
            : !isGenericProfileName(senderNameFromPayload)
                ? senderNameFromPayload
                : !isGenericProfileName(existingContactName)
                    ? existingContactName
                    : buildMetaFallbackName(provider, senderId);

        const newMessage = {
            sender: 'user',
            text: text,
            timestamp: admin.firestore.Timestamp.now(),
            messageId: messaging?.message?.mid || `mid_${Date.now()}`,
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
                messageId: messaging?.message?.mid || `mid_${Date.now()}`,
                platform: provider,
                from: senderId,
                timestamp: Date.now()
            };

            // 🛡️ PROTECCIÓN DE IDENTIDAD: Solo actualizar nombre si es genérico o está vacío
            const currentName = targetCardDoc.data()?.contactName || '';
            const shouldUpdateName = !currentName || isGenericProfileName(currentName);

            const cardUpdate: any = {
                lastMessage: text.length > 40 ? text.substring(0, 37) + '...' : text,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                unreadCount: admin.firestore.FieldValue.increment(1),
                messages: admin.firestore.FieldValue.arrayUnion(newMessage),
                'botState.messageQueue': admin.firestore.FieldValue.arrayUnion(queueItem),
                status: 'open',
                source: provider.toUpperCase(),
                primary_channel: provider.toLowerCase(),
                channel: provider.toLowerCase(),
                contactId: existingContactId || targetCardDoc.data()?.contactId || null,
                crmId: existingContactId || targetCardDoc.data()?.crmId || null,
                [`platform_ids.${provider.toLowerCase()}`]: senderId
            };

            if (shouldUpdateName) {
                cardUpdate.contactName = finalResolvedName;
            }

            await targetCardDoc.ref.update(cardUpdate);

            // Sincronizar contacto solo si el nombre debe actualizarse
            if (existingContactId) {
                const contactUpdate: any = {
                    metaSenderId: senderId,
                    kanbanGroupId: targetGroupId,
                    kanbanCardId: targetCardDoc.id,
                    source: provider.toUpperCase(),
                    updatedAt: admin.firestore.Timestamp.now(),
                    [`platform_ids.${provider.toLowerCase()}`]: senderId
                };
                if (shouldUpdateName) contactUpdate.name = finalResolvedName;
                await db.collection(`${entityPath}/contacts`).doc(existingContactId).update(contactUpdate);
            }
        } else {
            // 🎯 CLASIFICACIÓN POR BANDEJAS (Rule 1 & 5)
            let destinationGroupId = '';
            const channelKey = (provider || 'messenger').toLowerCase();
            const channelLabel = channelKey === 'instagram' ? 'Instagram' : 'Messenger';
            
            destinationGroupId = `group_${channelKey}`;
            
            const groupRef = db.collection(`${entityPath}/kanban-groups`).doc(destinationGroupId);
            const groupSnap = await groupRef.get();
            
            if (!groupSnap.exists) {
                debugLog(`[Kanban] 📦 Creating dedicated tray for: ${channelLabel}`);
                await groupRef.set({
                    id: destinationGroupId,
                    name: channelLabel,
                    type: channelKey,
                    order: channelKey === 'instagram' ? 3 : 4,
                    color: channelKey === 'instagram' ? '#E1306C' : '#006AFF',
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            }

            debugLog(`[POST] Preparing to newCardRef.set() to group ${destinationGroupId}`);
            const newCardRef = db.collection(`${entityPath}/kanban-groups/${destinationGroupId}/cards`).doc();
            const contactIdToUse = existingContactId || `c_${Date.now().toString().slice(-8)}`;

            const queueItem = {
                text: botInputText || text || '',
                messageId: messaging.message?.mid || `mid_${Date.now()}`,
                platform: provider,
                from: senderId,
                timestamp: Date.now()
            };

            debugLog(`[POST] Writing payload to db! contactName: ${finalResolvedName}`);
            await newCardRef.set({
                id: newCardRef.id,
                crmId: contactIdToUse,
// ... ignoring some lines because replace multiple chunks must exactly match 
// wait, I will just match a smaller chunk.
                contactId: contactIdToUse,
                contactName: finalResolvedName,
                contactNumber: senderId,
                metaSenderId: senderId,
                lastMessage: text.length > 50 ? text.substring(0, 47) + '...' : text,
                updatedAt: admin.firestore.Timestamp.now(),
                createdAt: admin.firestore.Timestamp.now(),
                messages: [newMessage],
                'botState.messageQueue': [queueItem],
                'botState.status': 'active',
                unreadCount: 1,
                status: 'open',
                source: provider.toUpperCase(),
                primary_channel: provider.toLowerCase(),
                channel: provider.toLowerCase(),
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
                [`platform_ids.${provider.toLowerCase()}`]: senderId
            };

            if (!existingContactId) {
                contactPayload.createdAt = admin.firestore.Timestamp.now();
            }

            await db.collection(`${entityPath}/contacts`).doc(contactIdToUse).set(contactPayload, { merge: true });

            cardId = newCardRef.id;
            groupId = destinationGroupId;
            debugLog(`[Webhook] ✨ NEW CARD CREATED: ${cardId} in group ${groupId}`);
        }

        // 4. TRIGGER UNIVERSAL CHATBOT
        if (groupId && cardId) {
            console.log(`[Meta Webhook] 🤖 Triggering chatbot for ${provider} | User: ${userId} | Entity: ${entityId}`);
            
            // TELEMETRY: Mark ingestion as successful in internal logs
            try {
                await db.collection(`${entityPath}/internal_logs`).add({
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    type: `webhook_ingested_${provider}`,
                    text: text.substring(0, 50),
                    cardId: cardId
                });
            } catch (e) {}

            try {
                await processChatbotFlow({
                    userId, entityId, groupId, cardId, platform: provider, from: senderId, text: botInputText || text,
                    messageId: messaging?.message?.mid || `mid_${Date.now()}`
                });
                console.log(`[Meta Webhook] ✅ Chatbot process completed for ${senderId}`);
            } catch (botError: any) {
                console.error(`[Meta Webhook] ❌ Chatbot Error for ${senderId}:`, botError.message);
                debugLog(`[Universal Engine Error] ${botError}`);
            }
        }

        debugLog(`[POST] 🚀 Successfully finished webhook control flow!`);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        debugLog(`[POST CRITICAL EXCEPTION] 💥 ${error.message}\n${error.stack}`);
        return NextResponse.json({
            success: false,
            error: 'Webhook Crash: ' + (error.message || 'Unknown'),
            details: error.stack?.split('\n').slice(0, 2)
        }, { status: 500 });
    }
}
