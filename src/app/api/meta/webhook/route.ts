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
        if (!entry) return NextResponse.json({ success: true });

        const targetId = entry.id; // Page ID or Instagram Account ID
        const messaging = entry.messaging?.[0];

        if (!messaging || !messaging.sender || (!messaging.message && !messaging.postback)) {
            return NextResponse.json({ success: true, ignored: 'not_a_valid_event' });
        }

        const senderId = messaging.sender.id;
        let text = '';

        if (messaging.message) {
            if (messaging.message.is_echo) {
                return NextResponse.json({ success: true, ignored: 'echo' });
            }
            // Prioritize Quick Reply payload, then text
            text = messaging.message.quick_reply?.payload || messaging.message.text || '';
        } else if (messaging.postback) {
            // Prioritize Postback payload, then title
            text = messaging.postback.payload || messaging.postback.title || '';
        }

        if (!text && !messaging.message?.attachments) {
            return NextResponse.json({ success: true, ignored: 'empty_text' });
        }

        if (!text) text = '[Multimedia/Otro]';

        debugLog(`[POST] Searching tenant for Target ID: ${targetId}`);

        // Search for the Tenant globally
        let tenantRef: admin.firestore.DocumentReference | null = null;
        let provider: 'messenger' | 'instagram' = 'messenger';

        // SUPPORT BOTH STRING AND NUMBER IDS (Agnostic normalization)
        const numericId = parseInt(targetId);

        let tenantData: any = null;

        // 1. MESSENGER PAGE SEARCH
        const messengerSnap = await db.collectionGroup('integrations')
            .where('pageId', 'in', [targetId, numericId])
            .limit(1)
            .get();

        if (!messengerSnap.empty) {
            tenantRef = messengerSnap.docs[0].ref;
            tenantData = messengerSnap.docs[0].data();
        } else {
            // 2. INSTAGRAM ACCOUNT SEARCH
            const instagramSnap = await db.collectionGroup('integrations')
                .where('instagramId', 'in', [targetId, numericId])
                .limit(1)
                .get();

            if (!instagramSnap.empty) {
                tenantRef = instagramSnap.docs[0].ref;
                tenantData = instagramSnap.docs[0].data();
                provider = 'instagram';
            }
        }

        if (!tenantRef) {
            debugLog(`[POST] ❌ ALERTA: No se pudo resolver el tenant. Target ID recibido: ${targetId}.`);
            debugLog(`[POST] Sugerencia: Verifica que el Instagram ID '${targetId}' esté registrado en Firestore.`);
            return NextResponse.json({
                success: false,
                error: 'Tenant not mapped',
                incomingId: targetId,
                note: 'Ensure this ID is correctly stored in your integrations collection'
            });
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
                type: `${provider}_webhook`,
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

        // Try to find if user exists by meta sender ID in Contacts
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

        // FALLBACK SEARCH: Scane all groups like WhatsApp does to avoid duplicates
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
            timestamp: new Date(),
            messageId: messaging.message.mid || `mid_${Date.now()}`,
            platform: provider
        };

        let cardId = targetCardDoc?.id;
        let groupId = targetGroupId;

        if (targetCardDoc && targetGroupId) {
            // REFRESH NAME LOGIC: If contact exists but has a generic name, try to fetch real name again
            let updatedName = existingContactName;
            if (!existingContactName || existingContactName.toLowerCase().includes('usuario')) {
                try {
                    if (tenantData?.accessToken) {
                        const fields = provider === 'instagram' ? 'name,username' : 'first_name,last_name,name';
                        const profileRes = await fetch(`https://graph.facebook.com/v21.0/${senderId}?fields=${fields}&access_token=${tenantData.accessToken}`);
                        const profileData = await profileRes.json();

                        if (profileData && !profileData.error) {
                            if (provider === 'instagram') {
                                updatedName = profileData.username ? `@${profileData.username}` : (profileData.name || updatedName);
                            } else {
                                updatedName = profileData.name || `${profileData.first_name || ''} ${profileData.last_name || ''}`.trim() || updatedName;
                            }
                        }
                    }
                } catch (err) {
                    debugLog(`[Name Refresh] Failed to refresh name: ${err}`);
                }
            }

            await targetCardDoc.ref.update({
                contactName: updatedName,
                lastMessage: text.length > 50 ? text.substring(0, 47) + '...' : text,
                updatedAt: new Date(),
                unreadCount: admin.firestore.FieldValue.increment(1),
                messages: admin.firestore.FieldValue.arrayUnion(newMessage),
                status: 'open',
                source: provider.toUpperCase(),
                platform_ids: { [provider]: senderId }
            });

            // Sincronizar campo source y nombre con el contacto existente
            if (existingContactId) {
                await db.collection(`${entityPath}/contacts`).doc(existingContactId).update({
                    name: updatedName,
                    source: provider.toUpperCase(),
                    updatedAt: new Date().toISOString()
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

            // CAPTURE REAL PROFILE NAME FROM META (Resilient)
            let contactName = `Usuario ${provider === 'instagram' ? 'IG' : 'FB'}`;
            try {
                if (tenantData?.accessToken) {
                    const fields = provider === 'instagram' ? 'name,username' : 'first_name,last_name,name';
                    const profileRes = await fetch(`https://graph.facebook.com/v21.0/${senderId}?fields=${fields}&access_token=${tenantData.accessToken}`);
                    const profileData = await profileRes.json();

                    if (profileData && !profileData.error) {
                        if (provider === 'instagram') {
                            contactName = profileData.username ? `@${profileData.username}` : (profileData.name || contactName);
                        } else {
                            contactName = profileData.name || `${profileData.first_name || ''} ${profileData.last_name || ''}`.trim() || contactName;
                        }
                    }
                }
            } catch (err) {
                debugLog(`[Profile Fetch] Failed to get name: ${err}`);
            }

            await newCardRef.set({
                crmId: contactIdToUse,
                contactName: contactName,
                contactNumber: senderId,
                metaSenderId: senderId,
                lastMessage: text.length > 50 ? text.substring(0, 47) + '...' : text,
                updatedAt: new Date(),
                createdAt: new Date(),
                messages: [newMessage],
                unreadCount: 1,
                status: 'open',
                source: provider.toUpperCase(),
                primary_channel: provider,
                platform_ids: { [provider]: senderId }
            });

            await db.collection(`${entityPath}/contacts`).doc(contactIdToUse).set({
                crmId: contactIdToUse,
                name: contactName,
                metaSenderId: senderId,
                kanbanGroupId: destinationGroupId,
                kanbanCardId: newCardRef.id,
                source: provider.toUpperCase(),
                updatedAt: new Date().toISOString(),
                createdAt: new Date().toISOString()
            }, { merge: true });

            cardId = newCardRef.id;
            groupId = destinationGroupId;
        }

        // 4. TRIGGER UNIVERSAL CHATBOT
        if (groupId && cardId) {
            console.log(`[Meta Webhook] 🤖 Triggering chatbot for ${provider} | User: ${userId} | Entity: ${entityId}`);
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

