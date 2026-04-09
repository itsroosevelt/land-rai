import { admin, db } from './firebase-admin';
import { sendMetaMessage, sendWhatsAppMessage, sendTelegramMessage, sendGmailMessage } from './sendProviders';

export interface ChatbotContext {
    userId: string;
    entityId: string;
    groupId: string;
    cardId: string;
    platform: 'whatsapp' | 'messenger' | 'instagram' | 'telegram' | 'gmail';
    from: string;
    text: string;
}

export async function processChatbotFlow(ctx: ChatbotContext) {
    const { userId, entityId, groupId, cardId, platform, from, text } = ctx;
    const entityPath = `users/${userId}/entities/${entityId}`;

    console.log(`[ChatbotEngine] 🚀 START | Platform: ${platform} | From: ${from} | Text: "${text}"`);

    try {
        console.log(`[ChatbotEngine] 🔍 Searching active bot for ${entityId}...`);
        const botsRef = db.collection(`${entityPath}/chatbots`);
        const botsSnapshot = await botsRef.where('isActive', 'in', [true, 'true']).get();

        if (botsSnapshot.empty) {
            console.warn(`[ChatbotEngine] ⚠️ No active bot for entity ${entityId}.`);
            return;
        }

        const bots = botsSnapshot.docs.map(d => ({ id: d.id, ...d.data() as any }));
        bots.sort((a, b) => {
            const timeA = a.updatedAt?.toDate?.()?.getTime() || a.createdAt?.toDate?.()?.getTime() || 0;
            const timeB = b.updatedAt?.toDate?.()?.getTime() || b.createdAt?.toDate?.()?.getTime() || 0;
            return timeB - timeA;
        });
        const activeBot = bots[0];
        console.log(`[ChatbotEngine] 🤖 Active Bot detected: ${activeBot.id} (Total: ${botsSnapshot.size})`);
        const flow = activeBot.flow || { nodes: [], edges: [] };

        const cardRef = db.doc(`${entityPath}/kanban-groups/${groupId}/cards/${cardId}`);
        const cardSnap = await cardRef.get();
        if (!cardSnap.exists) {
            console.error(`[ChatbotEngine] ❌ Card ${cardId} NOT found in Firestore.`);
            return;
        }
        const cardData = cardSnap.data() || {};
        const currentState = cardData.botState || {};
        console.log(`[ChatbotEngine] 🗂️ Card Data loaded. Bot Status: ${currentState.status || 'none'}`);

        // Helper: Variable Injection (Agnostic)
        const replaceVars = (val: string) => {
            if (!val) return '';
            let p = val;
            const context = {
                nombre: cardData.contactName || 'Usuario',
                name: cardData.contactName || 'Usuario',
                ...(cardData.customFields || {}),
                ...(cardData.variables || {})
            };
            for (const [k, v] of Object.entries(context)) {
                p = p.replace(new RegExp(`\\{${k}\\}`, 'gi'), String(v));
                p = p.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'gi'), String(v));
            }
            return p;
        };

        // Helper: Message Sender Dispatcher
        const dispatchMessage = async (content: string, options: any = {}) => {
            console.log(`[ChatbotEngine] 📤 Sending "${content.substring(0, 30)}..." to ${from}`);
            try {
                const opts = { userId, entityId, ...options };
                let res;
                if (platform === 'whatsapp') res = await sendWhatsAppMessage(from, content, opts);
                else if (platform === 'messenger' || platform === 'instagram') res = await sendMetaMessage(from, content, { ...opts, provider: platform });
                else if (platform === 'telegram') res = await sendTelegramMessage(from, content, opts);
                else if (platform === 'gmail') res = await sendGmailMessage(from, content, opts);

                console.log(`[ChatbotEngine] ✅ Dispatch SUCCESS for ${from}`);
                return res;
            } catch (err: any) {
                console.error(`[ChatbotEngine] ❌ Dispatch FAILED for ${from}:`, err.message);
                throw err;
            }
        };

        // Execution Engine (With Continuation Loop)
        const executeFlow = async (startNodeId: string) => {
            let currentNodeId: string | null = startNodeId;
            let executionCount = 0;
            const MAX_STEPS = 15;

            console.log(`[ChatbotEngine] 🔄 FLOW START at node: ${startNodeId}`);

            while (currentNodeId && executionCount < MAX_STEPS) {
                executionCount++;
                const node = flow.nodes.find((n: any) => n.id === currentNodeId);
                if (!node) {
                    console.warn(`[ChatbotEngine] ⚠️ Node ${currentNodeId} NOT FOUND.`);
                    break;
                }

                console.log(`[ChatbotEngine] 📍 Executing [${node.type}] (${node.id})`);

                if (node.type === 'startNode' || node.type === 'start') {
                    const edge = flow.edges.find((e: any) => e.source === node.id);
                    currentNodeId = edge ? edge.target : null;
                    continue;
                }

                if (node.type === 'textMessageNode') {
                    const msg = replaceVars(node.data?.content || node.data?.text || 'Hola');
                    const res = await dispatchMessage(msg);
                    const messageId = res?.message_id || res?.messageId || `bot_${Date.now()}`;

                    await cardRef.update({
                        messages: admin.firestore.FieldValue.arrayUnion({
                            sender: 'agent', text: msg, platform, timestamp: new Date(), messageId
                        }),
                        lastMessage: msg.substring(0, 50),
                        updatedAt: new Date(),
                        'botState.currentNodeId': node.id,
                        'botState.status': 'active'
                    });

                    const edge = flow.edges.find((e: any) => e.source === node.id);
                    currentNodeId = edge ? edge.target : null;
                    continue;
                }

                if (node.type === 'quickReplyNode') {
                    const msg = replaceVars(node.data?.bodyText || node.data?.text || 'Selecciona:');
                    const buttons = (node.data?.buttons || []).map((btn: any) => ({
                        type: 'reply',
                        reply: {
                            id: (typeof btn === 'object' ? (btn.id || btn.title) : btn).substring(0, 20),
                            title: (typeof btn === 'object' ? btn.title : btn).substring(0, 20)
                        }
                    })).slice(0, 3);

                    await dispatchMessage(msg, { type: 'quick_reply', buttons });
                    await cardRef.update({
                        'botState.currentNodeId': node.id,
                        'botState.status': 'active',
                        'botState.waitingForInput': true,
                        'botState.lastInteraction': new Date()
                    });
                    console.log(`[ChatbotEngine] ⏸️ FLOW PAUSE (Input Needed) @ ${node.id}`);
                    return;
                }

                if (node.type === 'captureInputNode') {
                    const prompt = replaceVars(node.data?.content || node.data?.text || '');
                    if (prompt) await dispatchMessage(prompt);
                    await cardRef.update({
                        'botState.currentNodeId': node.id,
                        'botState.status': 'active',
                        'botState.waitingForInput': true,
                        'botState.variableName': node.data?.variableName || 'last_input',
                        'botState.lastInteraction': new Date()
                    });
                    console.log(`[ChatbotEngine] ⏸️ FLOW PAUSE (Capture Needed) @ ${node.id}`);
                    return;
                }

                if (node.type === 'conditionNode') {
                    const freshData = (await cardRef.get()).data() || {};
                    const val = freshData.customFields?.[node.data?.variableName] || freshData.variables?.[node.data?.variableName];
                    let target = null;
                    for (const r of node.data?.routes || []) {
                        if (r.condition === 'equals' && String(val) === String(r.value)) {
                            target = flow.edges.find((e: any) => e.source === node.id && e.sourceHandle === r.id)?.target;
                            if (target) break;
                        }
                    }
                    if (!target) target = flow.edges.find((e: any) => e.source === node.id && e.sourceHandle === 'else')?.target;
                    currentNodeId = target;
                    continue;
                }

                if (node.type === 'setVariableNode') {
                    await cardRef.update({ [`customFields.${node.data?.variableName}`]: node.data?.value });
                    const edge = flow.edges.find((e: any) => e.source === node.id);
                    currentNodeId = edge ? edge.target : null;
                    continue;
                }

                if (node.type === 'endNode') {
                    await cardRef.update({ 'botState.status': 'completed', 'botState.currentNodeId': node.id });
                    console.log(`[ChatbotEngine] 🏁 FLOW COMPLETED @ ${node.id}`);
                    return;
                }

                break;
            }
            if (executionCount >= MAX_STEPS) console.warn('[ChatbotEngine] ⚠️ FLOW ABORTED: MAX_STEPS reached.');
        };

        const input = text.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const isReset = input === 'reiniciar' || input === 'menu' || input === 'reset' || input === 'reinicia todo ahora';

        console.log(`[ChatbotEngine] 🛤️ PATH: isReset=${isReset}, status=${currentState.status}, waitingInput=${currentState.waitingForInput}`);

        if (isReset) {
            console.log(`[ChatbotEngine] ♻️ EXECUTING RESET for card ${cardId}`);
            await cardRef.update({
                'botState': admin.firestore.FieldValue.delete(),
                'customFields': admin.firestore.FieldValue.delete()
            });
            await dispatchMessage("🔄 Reinicio completado, empezamos de nuevo.");
            await cardRef.update({
                messages: admin.firestore.FieldValue.arrayUnion({
                    sender: 'agent', text: "🔄 Reinicio completado, empezamos de nuevo.", platform, timestamp: new Date(), messageId: `bot_sys_${Date.now()}`
                })
            });

            const startNode = flow.nodes.find((n: any) => n.type === 'start' || n.type === 'startNode');
            if (startNode) await executeFlow(startNode.id);
            return;
        }

        if (currentState.waitingForInput && currentState.currentNodeId) {
            const node = flow.nodes.find((n: any) => n.id === currentState.currentNodeId);
            console.log(`[ChatbotEngine] 📝 RESUMING @ ${node?.id}`);
            if (node?.type === 'captureInputNode') {
                const varName = currentState.variableName || 'input';
                await cardRef.update({ [`customFields.${varName}`]: text, 'botState.waitingForInput': false });
                const next = flow.edges.find((e: any) => e.source === node.id);
                if (next) await executeFlow(next.target);
            } else {
                const edge = flow.edges.find((e: any) => e.source === node?.id && (String(e.sourceHandle) === text || String(e.sourceHandle?.toLowerCase()) === text.toLowerCase()));
                if (edge) {
                    await cardRef.update({ 'botState.waitingForInput': false });
                    await executeFlow(edge.target);
                } else {
                    const fallback = flow.edges.find((e: any) => e.source === node?.id);
                    if (fallback) {
                        await cardRef.update({ 'botState.waitingForInput': false });
                        await executeFlow(fallback.target);
                    }
                }
            }
        } else if (currentState.status !== 'completed') {
            const startNode = flow.nodes.find((n: any) => n.type === 'start' || n.type === 'startNode');
            if (startNode) {
                console.log(`[ChatbotEngine] 🚀 FRESH START for ${cardId}`);
                await executeFlow(startNode.id);
            }
        } else {
            console.log(`[ChatbotEngine] ℹ️ Conversation is COMPLETED. Use RESET to restart.`);
        }

    } catch (err: any) {
        console.error(`[ChatbotEngine] 💥 CRITICAL FAILURE:`, err.message);
        console.error(err.stack);
    }
}
