import { admin, db } from './firebase-admin';
import { sendMetaMessage, sendWhatsAppMessage, sendTelegramMessage } from './sendProviders';

export interface ChatbotContext {
    userId: string;
    entityId: string;
    groupId: string;
    cardId: string;
    platform: 'whatsapp' | 'messenger' | 'instagram' | 'telegram';
    from: string;
    text: string;
}

export async function processChatbotFlow(ctx: ChatbotContext) {
    const { userId, entityId, groupId, cardId, platform, from, text } = ctx;
    const entityPath = `users/${userId}/entities/${entityId}`;

    console.log(`[ChatbotEngine] 🚀 Engine started for ${platform} | From: ${from}`);

    try {
        // 1. Fetch Tenant-specific Chatbot
        const botsRef = db.collection(`${entityPath}/chatbots`);
        const botsSnapshot = await botsRef.where('isActive', '==', true).limit(1).get();
        let activeBotDoc = botsSnapshot.empty ? null : botsSnapshot.docs[0];

        if (!activeBotDoc) {
            const fallbackSnap = await botsRef.where('isActive', '==', 'true').limit(1).get();
            activeBotDoc = fallbackSnap.empty ? null : fallbackSnap.docs[0];
        }

        if (!activeBotDoc) {
            console.log(`[ChatbotEngine] No active bot for entity ${entityId}.`);
            return;
        }

        const flow = activeBotDoc.data().flow || { nodes: [], edges: [] };
        const cardRef = db.doc(`${entityPath}/kanban-groups/${groupId}/cards/${cardId}`);
        const cardSnap = await cardRef.get();
        if (!cardSnap.exists) return;
        const cardData = cardSnap.data() || {};

        // Helper: Variable Injection
        const replaceVars = (val: string) => {
            if (!val) return '';
            let p = val;
            const context = {
                nombre: cardData.contactName || '',
                ...(cardData.variables || {}),
                ...(cardData.customFields || {})
            };
            for (const [k, v] of Object.entries(context)) {
                p = p.replace(new RegExp(`\\{${k}\\}`, 'gi'), String(v));
            }
            return p;
        };

        // Helper: Message Sender Dispatcher
        const dispatchMessage = async (content: string, options: any = {}) => {
            const opts = { userId, entityId, ...options };
            if (platform === 'whatsapp') return await sendWhatsAppMessage(from, content, opts);
            if (platform === 'messenger' || platform === 'instagram') return await sendMetaMessage(from, content, { ...opts, provider: platform });
            if (platform === 'telegram') return await sendTelegramMessage(from, content, opts);
            return null;
        };

        // Execution Engine
        const executeNode = async (nodeId: string) => {
            const node = flow.nodes.find((n: any) => n.id === nodeId);
            if (!node) return;

            if (node.type === 'startNode') {
                const edge = flow.edges.find((e: any) => e.source === node.id);
                if (edge) await executeNode(edge.target);
                return;
            }

            if (node.type === 'textMessageNode') {
                const msg = replaceVars(node.data?.content || node.data?.text || 'Hola');
                const res = await dispatchMessage(msg);

                await cardRef.update({
                    messages: admin.firestore.FieldValue.arrayUnion({
                        sender: 'agent', text: msg, timestamp: new Date(), platform: platform,
                        messageId: res?.whatsappMessageId || res?.messageId || null
                    }),
                    lastMessage: msg.substring(0, 47) + '...',
                    updatedAt: new Date(),
                    unreadCount: 0,
                    'chatbotState.currentNodeId': node.id,
                    'chatbotState.waitingForInput': true
                });
                return;
            }

            if (node.type === 'quickReplyNode') {
                const msg = replaceVars(node.data?.bodyText || node.data?.text || 'Opción:');
                const buttons = (node.data?.buttons || []).map((btn: any) => ({
                    type: 'reply',
                    reply: {
                        id: (typeof btn === 'object' ? (btn.id || btn.title) : btn).substring(0, 20),
                        title: (typeof btn === 'object' ? btn.title : btn).substring(0, 20)
                    }
                })).slice(0, 3);

                const res = await dispatchMessage(msg, { type: 'quick_reply', buttons });

                await cardRef.update({
                    messages: admin.firestore.FieldValue.arrayUnion({
                        sender: 'agent', text: `${msg} (Opciones Enviadas)`, timestamp: new Date(), platform: platform
                    }),
                    'chatbotState.currentNodeId': node.id,
                    'chatbotState.waitingForInput': true,
                    'chatbotState.isQuickReply': true
                });
                return;
            }

            if (node.type === 'captureInputNode') {
                const prompt = replaceVars(node.data?.content || '');
                if (prompt) await dispatchMessage(prompt);
                
                await cardRef.update({
                    'chatbotState.currentNodeId': node.id,
                    'chatbotState.waitingForInput': true,
                    'chatbotState.variableName': node.data?.variableName || 'last_input'
                });
                return;
            }

            if (node.type === 'conditionNode') {
                const val = (await cardRef.get()).data()?.variables?.[node.data?.variableName];
                let target = null;
                for (const r of node.data?.routes || []) {
                    if (r.condition === 'equals' && String(val) === String(r.value)) {
                        target = flow.edges.find((e: any) => e.source === node.id && e.sourceHandle === r.id)?.target;
                        if (target) break;
                    }
                }
                if (!target) target = flow.edges.find((e: any) => e.source === node.id && e.sourceHandle === 'else')?.target;
                if (target) await executeNode(target);
                return;
            }

            if (node.type === 'setVariableNode') {
                await cardRef.update({ [`variables.${node.data?.variableName}`]: node.data?.value });
                const next = flow.edges.find((e: any) => e.source === node.id);
                if (next) await executeNode(next.target);
                return;
            }

            if (node.type === 'endNode') {
                await cardRef.update({ 'chatbotState': null });
                return;
            }
        };

        // Resume or Start logic
        const currentState = cardData.chatbotState || {};
        if (text.trim().toLowerCase() === 'reiniciar' || text.trim().toLowerCase() === 'menu') {
            await cardRef.update({ 'chatbotState': null });
            const startNode = flow.nodes.find((n: any) => n.type === 'startNode');
            if (startNode) await executeNode(startNode.id);
            return;
        }

        if (currentState.waitingForInput && currentState.currentNodeId) {
            const node = flow.nodes.find((n: any) => n.id === currentState.currentNodeId);
            if (node?.type === 'captureInputNode') {
                const varName = currentState.variableName || 'input';
                await cardRef.update({ [`variables.${varName}`]: text, 'chatbotState.waitingForInput': false });
                const next = flow.edges.find((e: any) => e.source === node.id);
                if (next) await executeNode(next.target);
            } else {
                // Check edges for interactive response matching
                const edge = flow.edges.find((e: any) => e.source === node?.id && (String(e.sourceHandle) === text || String(e.sourceHandle?.toLowerCase()) === text.toLowerCase()));
                if (edge) {
                    await cardRef.update({ 'chatbotState.waitingForInput': false });
                    await executeNode(edge.target);
                } else {
                    const startNode = flow.nodes.find((n: any) => n.type === 'startNode');
                    if (startNode) await executeNode(startNode.id);
                }
            }
        } else {
            const startNode = flow.nodes.find((n: any) => n.type === 'startNode');
            if (startNode) await executeNode(startNode.id);
        }

    } catch (err: any) {
        console.error(`[ChatbotEngine] Critical error: ${err.message}`);
    }
}
