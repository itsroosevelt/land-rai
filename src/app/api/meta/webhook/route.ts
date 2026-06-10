import { NextResponse } from 'next/server';
import { db, admin } from '@/lib/firebase-admin';
import { processChatbotFlow } from '@/lib/chatbotEngine';
import { buildBotQueueItem, createQueuedBotState, isDuplicateQueueMessage } from '@/lib/botQueue';
import { resolveMetaBotRouting } from '@/lib/automation/metaBotRouting';

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
    
    const isGenericKeyword = normalized.includes('usuario meta') || 
                             normalized.includes('usuario') || 
                             normalized.includes('meta') || 
                             normalized === 'instagram user' ||
                             normalized === 'messenger user';

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
    let entityPathForError = '';
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

        const objectType = body.object;
        const targetId = entry.id; 
        const messaging = entry.messaging?.[0];
        const changes = entry.changes?.[0];

        if (!messaging && !changes) {
            return NextResponse.json({ success: true, ignored: 'no_data' });
        }

        const senderId = messaging?.sender?.id || changes?.value?.from?.id;
        if (!senderId) return NextResponse.json({ success: true, ignored: 'no_sender' });

        if (senderId === targetId || senderId === entry.id) {
             return NextResponse.json({ success: true, ignored: 'self_echo' });
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

        let tenantRef: admin.firestore.DocumentReference | null = null;
        let provider: 'messenger' | 'instagram' = objectType === 'instagram' ? 'instagram' : 'messenger';
        let tenantData: any = null;
        const numericId = parseInt(targetId);

        const integrationSnap = await db.collectionGroup('integrations').get();
        let matchedIntegrations: any[] = [];

        for (const doc of integrationSnap.docs) {
            if (!doc.ref.path.includes('users/') || !doc.ref.path.includes('/entities/')) continue;
            const data = doc.data();
            const matchesPage = data.pageId === targetId || String(data.pageId) === String(targetId) || data.pageId === numericId;
            const matchesInsta = data.instagramId === targetId || String(data.instagramId) === String(targetId) || data.instagramId === numericId;
            if (matchesPage || matchesInsta) {
                matchedIntegrations.push({ doc, data, provider: matchesInsta ? 'instagram' : 'messenger', updatedAt: data.updatedAt?.toMillis?.() || data.updatedAt?.seconds * 1000 || 0 });
            }
        }

        if (matchedIntegrations.length > 0) {
            matchedIntegrations.sort((a, b) => b.updatedAt - a.updatedAt);
            const selectedMatch = matchedIntegrations[0];
            tenantRef = selectedMatch.doc.ref;
            tenantData = selectedMatch.data;
            provider = selectedMatch.provider as 'instagram' | 'messenger';
        }

        if (!tenantRef) return NextResponse.json({ success: true, ignored: 'unmapped_tenant' });

        const pathParts = tenantRef!.path.split('/');
        const userId = pathParts[1];
        const entityId = pathParts[3];
        const entityPath = `users/${userId}/entities/${entityId}`;
        entityPathForError = entityPath;

        // INICIALIZAR LOGS DE RASTREO
        const logRef = await db.collection(`${entityPath}/internal_logs`).add({
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            type: `${provider}_webhook_hit`,
            senderId,
            step: 'init'
        });

        // DEDUPLICATION
        const messageId = messaging?.message?.mid || changes?.message_id || `temp_${Date.now()}_${senderId}`;
        const dedupRef = db.doc(`${entityPath}/processed_messages/${messageId}`);
        const isDuplicate = await db.runTransaction(async (t) => {
            const snap = await t.get(dedupRef);
            if (snap.exists) {
                const data = snap.data();
                if (data && Date.now() - data.timestamp < 300000) return true;
            }
            t.set(dedupRef, { timestamp: Date.now(), senderId: senderId, type: 'meta_ingestion' });
            return false;
        });

        if (isDuplicate) {
            await logRef.update({ step: 'duplicate_ignored' });
            return NextResponse.json({ success: true, duplicate: true });
        }

        await logRef.update({ step: 'passed_dedup' });

        // SENDER LOCK
        const lockRef = db.doc(`${entityPath}/locks_ingestion/${senderId}`);
        const lockSnap = await lockRef.get();
        if (lockSnap.exists) {
            const lockData = lockSnap.data();
            if (lockData && (Date.now() - lockData.timestamp < 3000)) {
                await new Promise(r => setTimeout(r, 1000));
            }
        }
        await lockRef.set({ timestamp: Date.now() }, { merge: true });

        await logRef.update({ step: 'passed_lock' });

        let targetCardDoc: any = null;
        let targetGroupId: string | null = null;
        let existingContactId: string | null = null;
        let existingContactName: string | null = null;

        const contactSnap = await db.collection(`${entityPath}/contacts`).where('metaSenderId', '==', senderId).get();

        if (!contactSnap.empty) {
            const rankedContacts = contactSnap.docs.sort((a, b) => (b.data().updatedAt?.toMillis?.() || 0) - (a.data().updatedAt?.toMillis?.() || 0));
            const contactDoc = rankedContacts[0];
            existingContactId = contactDoc.id;
            existingContactName = contactDoc.data().name || null;
            targetGroupId = contactDoc.data().kanbanGroupId;
            const contactCardId = contactDoc.data().kanbanCardId;

            if (targetGroupId && contactCardId) {
                const cardRef = db.doc(`${entityPath}/kanban-groups/${targetGroupId}/cards/${contactCardId}`);
                const cardGet = await cardRef.get();
                if (cardGet.exists) targetCardDoc = cardGet;
            }
        }

        await logRef.update({ step: 'search_complete', foundCard: !!targetCardDoc });

        let resolvedName = senderNameFromPayload || existingContactName;
        if (isGenericProfileName(resolvedName)) {
            try {
                const token = tenantData?.accessToken || tenantData?.pageAccessToken || tenantData?.token;
                if (token) {
                    const fields = provider === 'instagram' ? 'name,username,profile_pic' : 'name,first_name,last_name,profile_pic';
                    const profileUrl = `https://graph.facebook.com/v21.0/${senderId}?fields=${fields}&access_token=${token}`;
                    const profileRes = await fetch(profileUrl);
                    const profileData = await profileRes.json();
                    if (profileData && !profileData.error) {
                        resolvedName = profileData.name || profileData.username || `${profileData.first_name || ''} ${profileData.last_name || ''}`.trim();
                    }
                }
            } catch (err) { }
        }

        const finalResolvedName = !isGenericProfileName(resolvedName) ? resolvedName : buildMetaFallbackName(provider, senderId);

        const newMessage = {
            sender: 'user',
            text: text,
            timestamp: admin.firestore.Timestamp.now(),
            messageId: messageId,
            platform: provider,
            ...(firstAttachment ? {
                fileUrl: firstAttachment?.payload?.url || null,
                fileType: firstAttachment?.type === 'image' ? 'image/*' : firstAttachment?.type === 'video' ? 'video/*' : firstAttachment?.type === 'audio' ? 'audio/*' : 'application/octet-stream',
                fileName: firstAttachment?.name || null,
                type: 'media',
                metadata: { attachments: rawAttachments.map((a: any) => ({ type: a?.type || null, url: a?.payload?.url || null, name: a?.name || null })) }
            } : {})
        };

        let cardId: string | null = targetCardDoc?.id || null;
        let groupId: string | null = targetGroupId || null;

        if (targetCardDoc && targetGroupId) {
            const queueItem = buildBotQueueItem({
                text: botInputText || text || '',
                messageId: messageId || `meta_${Date.now()}`,
                platform: provider,
                from: senderId,
            });
            const alreadyQueued = isDuplicateQueueMessage(targetCardDoc.data(), messageId);
            const cardUpdate: any = {
                lastMessage: text.length > 40 ? text.substring(0, 37) + '...' : text,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                unreadCount: admin.firestore.FieldValue.increment(1),
                messages: admin.firestore.FieldValue.arrayUnion(newMessage),
                'botState.engine': 'queue',
                status: 'open',
                [`platform_ids.${provider.toLowerCase()}`]: senderId
            };
            if (!alreadyQueued) {
                cardUpdate['botState.messageQueue'] = admin.firestore.FieldValue.arrayUnion(queueItem);
            }
            if (!targetCardDoc.data()?.contactName || isGenericProfileName(targetCardDoc.data()?.contactName)) cardUpdate.contactName = finalResolvedName;

            await targetCardDoc.ref.update(cardUpdate);
            if (existingContactId) {
                await db.collection(`${entityPath}/contacts`).doc(existingContactId).update({ updatedAt: admin.firestore.Timestamp.now(), [`platform_ids.${provider.toLowerCase()}`]: senderId });
            }
            await logRef.update({ step: 'existing_card_updated' });
        } else {
            const groupsSnapshot = await db.collection(`${entityPath}/kanban-groups`).get();
            let destinationGroupId = groupsSnapshot.docs.find(g => (g.data().name || '').toLowerCase().includes('inbox') || (g.data().name || '').toLowerCase().includes('entrada'))?.id;
            if (!destinationGroupId) {
                destinationGroupId = groupsSnapshot.empty ? 'inbox' : groupsSnapshot.docs[0].id;
                if (groupsSnapshot.empty) await db.collection(`${entityPath}/kanban-groups`).doc('inbox').set({ id: 'inbox', name: 'Bandeja de Entrada', order: 1, createdAt: admin.firestore.FieldValue.serverTimestamp() });
            }

            const newCardRef = db.collection(`${entityPath}/kanban-groups/${destinationGroupId}/cards`).doc();
            const contactIdToUse = existingContactId || `c_${Date.now().toString().slice(-8)}`;
            const queueItem = buildBotQueueItem({
                text: botInputText || text || '',
                messageId: messageId || `meta_${Date.now()}`,
                platform: provider,
                from: senderId,
            });

            await newCardRef.set({
                id: newCardRef.id,
                crmId: contactIdToUse,
                contactId: contactIdToUse,
                contactName: finalResolvedName,
                metaSenderId: senderId,
                lastMessage: text.length > 50 ? text.substring(0, 47) + '...' : text,
                updatedAt: admin.firestore.Timestamp.now(),
                createdAt: admin.firestore.Timestamp.now(),
                messages: [newMessage],
                botState: createQueuedBotState(queueItem),
                unreadCount: 1,
                status: 'open',
                source: provider.toUpperCase(),
                primary_channel: provider.toLowerCase(),
                channel: provider.toLowerCase(),
                platform_ids: { [provider.toLowerCase()]: senderId }
            });

            await db.collection(`${entityPath}/contacts`).doc(contactIdToUse).set({
                crmId: contactIdToUse,
                name: finalResolvedName,
                metaSenderId: senderId,
                kanbanGroupId: destinationGroupId,
                kanbanCardId: newCardRef.id,
                source: provider.toUpperCase(),
                updatedAt: admin.firestore.Timestamp.now(),
                [`platform_ids.${provider.toLowerCase()}`]: senderId
            }, { merge: true });

            cardId = newCardRef.id;
            groupId = destinationGroupId;
            await logRef.update({ step: 'new_card_created', cardId });
        }

        if (groupId && cardId) {
            try {
                const botRouting = resolveMetaBotRouting(objectType, provider, changes);
                await processChatbotFlow({
                    userId,
                    entityId,
                    groupId,
                    cardId,
                    platform: botRouting.platform as 'messenger' | 'instagram',
                    from: senderId,
                    text: botInputText || text,
                    messageId,
                    botsCollection: botRouting.botsCollection,
                });
                await logRef.update({ step: 'chatbot_triggered' });
            } catch (botError: any) {
                await logRef.update({ step: 'chatbot_error', error: botError.message });
            }
        }

        await logRef.update({ step: 'finished_successfully' });
        return NextResponse.json({ success: true });
    } catch (error: any) {
        debugLog(`💥 CRITICAL EXCEPTION: ${error.message}`);
        if (entityPathForError) {
            try {
                await db.collection(`${entityPathForError}/internal_logs`).add({
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    type: `webhook_crash`,
                    error: error.message,
                    stack: error.stack?.substring(0, 500)
                });
            } catch (e) {}
        }
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
