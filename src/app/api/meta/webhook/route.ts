import { NextResponse } from 'next/server';
import { db, admin } from '@/lib/firebase-admin';
import { sendMetaMessage } from '@/lib/sendProviders';

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

    const expectedToken = process.env.kamban_VERIFY_TOKEN || 'vg37e'; // Shared global token

    if (mode === 'subscribe' && token === expectedToken) {
        debugLog(`Verification successful (GET)`);
        return new Response(challenge, { status: 200 });
    }
    debugLog(`Verification failed (GET) | Expected: ${expectedToken}, Got: ${token}`);
    return new Response('Forbidden', { status: 403 });
}

export async function POST(req: Request) {
    debugLog('--- [Meta Master Webhook] INCOMING HIT ---');

    try {
        let body;
        try {
            const rawBody = await req.text();
            body = JSON.parse(rawBody);
        } catch (parseError: any) {
            return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
        }

        const entry = body.entry?.[0];
        if (!entry) return NextResponse.json({ success: true });

        const targetId = entry.id; // Page ID or Instagram Account ID
        const messaging = entry.messaging?.[0];
        
        if (!messaging || !messaging.sender || !messaging.message) {
            return NextResponse.json({ success: true, ignored: 'not_a_message' });
        }

        const senderId = messaging.sender.id;
        const text = messaging.message.text || '[Multimedia/Otro]';

        if (messaging.message.is_echo) {
            return NextResponse.json({ success: true, ignored: 'echo' });
        }

        debugLog(`[POST] Searching tenant for Target ID: ${targetId}`);

        // Search for the Tenant globally
        let tenantRef: admin.firestore.DocumentReference | null = null;
        let provider: 'messenger' | 'instagram' = 'messenger';
        
        // SUPPORT BOTH STRING AND NUMBER IDS (Agnostic normalization)
        const numericId = parseInt(targetId);
        
        // 1. MESSENGER PAGE SEARCH
        const messengerSnap = await db.collectionGroup('integrations')
            .where('pageId', 'in', [targetId, numericId])
            .limit(1)
            .get();
            
        if (!messengerSnap.empty) {
            tenantRef = messengerSnap.docs[0].ref;
        } else {
            // 2. INSTAGRAM ACCOUNT SEARCH
            const instagramSnap = await db.collectionGroup('integrations')
                .where('instagramId', 'in', [targetId, numericId])
                .limit(1)
                .get();
                
            if (!instagramSnap.empty) {
                tenantRef = instagramSnap.docs[0].ref;
                provider = 'instagram';
            }
        }

        if (!tenantRef) {
            debugLog(`[POST] ❌ ABORT: Could not resolve tenant for Target ID ${targetId}.`);
            return NextResponse.json({ 
                success: false, 
                error: 'Tenant not mapped',
                triedId: targetId,
                triedNumeric: numericId
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

        // OMNICHANNEL INGESTION TO KANBAN
        let targetCardDoc: any = null;
        let targetGroupId: string | null = null;
        let existingContactId: string | null = null;
        let existingContactName: string | null = null;

        // Try to find if user exists by meta sender ID
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
            await targetCardDoc.ref.update({
                lastMessage: text.length > 50 ? text.substring(0, 47) + '...' : text,
                updatedAt: new Date(),
                unreadCount: admin.firestore.FieldValue.increment(1),
                messages: admin.firestore.FieldValue.arrayUnion(newMessage),
                status: 'open'
            });
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
            
            let numericId = String(Date.now()).slice(-10); // Simple ID for MVP
            const contactName = `Usuario ${provider === 'instagram' ? 'IG' : 'FB'}`;

            await newCardRef.set({
                crmId: numericId,
                contactName: contactName,
                contactNumber: senderId,
                metaSenderId: senderId, 
                lastMessage: text.length > 50 ? text.substring(0, 47) + '...' : text,
                updatedAt: new Date(),
                createdAt: new Date(),
                messages: [newMessage],
                unreadCount: 1,
                status: 'open',
                source: provider,
                primary_channel: provider
            });

            await db.collection(`${entityPath}/contacts`).doc(numericId).set({
                crmId: numericId,
                name: contactName,
                metaSenderId: senderId,
                kanbanGroupId: destinationGroupId,
                kanbanCardId: newCardRef.id,
                origin: provider,
                updatedAt: new Date().toISOString(),
                createdAt: new Date().toISOString()
            }, { merge: true });

            cardId = newCardRef.id;
            groupId = destinationGroupId;
        }

        // TRIGGER META CHATBOT
        if (groupId && cardId) {
            debugLog(`[POST] Triggering ${provider} chatbot for ${entityId}...`);
            triggerMetaChatbot(senderId, text, groupId, cardId, userId, entityId, provider).catch(error => {
                 debugLog(`[Chatbot Engine Error] ${error}`);
            });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: 'Crash: ' + (error.message || 'Unknown') }, { status: 500 });
    }
}

async function triggerMetaChatbot(from: string, text: string, groupId: string, cardId: string, userId: string, entityId: string, provider: 'messenger' | 'instagram') {
    const entityPath = `users/${userId}/entities/${entityId}`;

    // Read bot
    const botsRef = db.collection(`${entityPath}/chatbots`);
    const botsSnapshot = await botsRef.where('isActive', '==', true).limit(1).get();
    const activeBotDoc = botsSnapshot.empty ? null : botsSnapshot.docs[0];

    if (!activeBotDoc) return;

    const flow = activeBotDoc.data().flow || { nodes: [], edges: [] };
    const cardRef = db.doc(`${entityPath}/kanban-groups/${groupId}/cards/${cardId}`);
    const cardData = (await cardRef.get()).data() || {};
    
    // Very basic Chatbot iteration to prove concept
    const executeNode = async (nodeId: string) => {
        const node = flow.nodes.find((n: any) => n.id === nodeId);
        if (!node) return;

        if (node.type === 'startNode') {
            const edge = flow.edges.find((e: any) => e.source === node.id);
            if (edge) await executeNode(edge.target);
            return;
        }

        if (node.type === 'textMessageNode') {
            const msg = node.data?.content || node.data?.text || 'Hola';
            // Send via meta!
            await sendMetaMessage(from, msg, { userId, entityId, provider, type: 'text' });

            await cardRef.update({
                messages: admin.firestore.FieldValue.arrayUnion({
                    sender: 'agent', text: msg, timestamp: new Date(), platform: provider
                }),
                lastMessage: msg.substring(0, 47) + '...',
                updatedAt: new Date(),
                unreadCount: 0,
                'chatbotState.currentNodeId': node.id,
                'chatbotState.waitingForInput': true
            });
            return;
        }
    };
    
    // Auto-run from start (MVP implementation)
    // Here we'd map standard Chatbot node logic identical to WhatsApp
    const startNode = flow.nodes.find((n: any) => n.type === 'startNode');
    if (startNode) await executeNode(startNode.id);
}
