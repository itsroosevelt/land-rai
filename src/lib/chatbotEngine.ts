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
    messageId?: string;
}

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

/**
 * Sequential Chatbot Engine Runner
 * Implements a FIFO queue consumer pattern to prevent race conditions and duplicate responses.
 */
export async function processChatbotFlow(ctx: ChatbotContext) {
    const { userId, entityId, groupId, cardId, platform, from, text, messageId } = ctx;
    const entityPath = `users/${userId}/entities/${entityId}`;
    const cardRef = db.doc(`${entityPath}/kanban-groups/${groupId}/cards/${cardId}`);

    console.log(`[ChatbotEngine] 🚀 RUNNER START | Platform: ${platform} | From: ${from}`);

    try {
        // --- 1. ATOMIC LOCK ACQUISITION ---
        const canExecute = await db.runTransaction(async (transaction) => {
            const snap = await transaction.get(cardRef);
            if (!snap.exists) return false;
            const data = snap.data() || {};
            const bState = data.botState || {};

            // DEDUP: If this exact message ID was just processed, skip queueing (but runner might already have it)
            if (messageId && bState.lastProcessedMessageId === messageId) return false;

            // LOCK CHECK: If locked and lock is less than 30 seconds old, we let the existing runner handle it.
            // Our webhook already pushed the message to 'messageQueue', so the active runner WILL see it.
            if (data.botLock) {
                const lockTime = data.botLock.toDate?.() || new Date(data.botLock);
                const diff = (Date.now() - lockTime.getTime()) / 1000;
                if (diff < 30) {
                    console.log(`[ChatbotEngine] 🔒 Card ${cardId} is actively locked (${diff}s). Skipping parallel execution.`);
                    return false;
                }
            }

            // REPAIR/INITIALIZE: If botState is missing or incomplete, heal it now
            const updateData: any = { 
                botLock: admin.firestore.FieldValue.serverTimestamp(),
                'botState.lastProcessedMessageId': messageId || null
            };

            if (!data.botState) {
                console.log(`[ChatbotEngine] 🩹 Healing missing botState for card ${cardId}`);
                updateData.botState = {
                    status: 'inactive',
                    currentNodeId: null,
                    waitingForInput: false,
                    messageQueue: data.botState?.messageQueue || [],
                    lastStep: 'AUTO_HEAL'
                };
            }

            // Acquire lock and mark start
            transaction.update(cardRef, updateData);
            return true;
        });

        if (!canExecute) return;

        // --- 2. THE CONSUMER LOOP ---
        let queueHasItems = true;
        while (queueHasItems) {
            const snap = await cardRef.get();
            const cardData = snap.data() || {};
            const bState = cardData.botState || {};
            const queue = bState.messageQueue || [];

            if (queue.length === 0) {
                queueHasItems = false;
                break;
            }

            // Consume first item (FIFO)
            const currentMsg = queue[0];
            const msgId = currentMsg.messageId;
            const msgText = String(currentMsg.text || '').trim();
            const msgPlatform = currentMsg.platform || platform;
            const msgFrom = currentMsg.from || from;

            console.log(`[ChatbotEngine] 🧵 Processing Queue Item [${msgId}]: "${msgText.substring(0, 30)}"`);

            // --- 3. INNER ENGINE CORE ---
            try {
                await runEngineCycle(cardRef, cardData, currentMsg, entityPath, entityId, userId);
            } catch (cycleError: any) {
                console.error(`[ChatbotEngine] 💥 Engine Cycle Crashed on Msg ${msgId}:`, cycleError.message);
                await db.runTransaction(async (t) => {
                     t.update(cardRef, { 'botState.lastError': cycleError.message, 'botState.lastErrorAt': new Date() });
                });
            }

            // --- 4. ATOMIC QUEUE DRAIN ---
            await db.runTransaction(async (transaction) => {
                transaction.update(cardRef, {
                    'botState.messageQueue': admin.firestore.FieldValue.arrayRemove(currentMsg),
                    botLock: admin.firestore.FieldValue.serverTimestamp() // Refresh lock
                });
            });
        }
    } catch (err: any) {
        console.error(`[ChatbotEngine] 💥 Runner Crash:`, err.message);
    } finally {
        // --- 5. FINAL RELEASE ---
        try {
            await cardRef.update({ botLock: admin.firestore.FieldValue.delete() });
            console.log(`[ChatbotEngine] 🏁 RUNNER FINISHED for ${cardId}`);
        } catch (e) {}
    }
}

/**
 * Single Engine Cycle: Processes ONE message through the flow.
 */
async function runEngineCycle(cardRef: any, cardData: any, msg: any, entityPath: string, entityId: string, userId: string) {
    const text = msg.text || '';
    const platform = msg.platform;
    const from = msg.from;
    const messageId = msg.messageId;

    // A. RESET CHECK (Master Bypass)
    const normalizedInput = text.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const isReset = normalizedInput === 'reiniciar' || normalizedInput === 'menu' || normalizedInput === 'reset' ||
        normalizedInput.includes('reinicia todo ahora') || normalizedInput.startsWith('reinici');

    // B. FETCH BOT & FLOW
    const botsRef = db.collection(`${entityPath}/chatbots`);
    const botsSnapshot = await botsRef.where('isActive', 'in', [true, 'true']).get();
    if (botsSnapshot.empty) return;

    const bots = botsSnapshot.docs.map(d => ({ id: d.id, ...d.data() as any }));
    bots.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
    const flow = bots[0].flow || { nodes: [], edges: [] };

    // C. HELPERS
    const replaceVars = (val: string, overlay: any = {}) => {
        if (!val) return '';
        const context: any = {
            nombre: cardData.contactName || 'Usuario',
            name: cardData.contactName || 'Usuario',
            first_name: cardData.contactName?.split(' ')[0] || 'Usuario',
            ...(cardData.customFields || {}),
            ...(cardData.variables || {}),
            ...overlay
        };
        // Bulletproof regex for {{var}} and {var}
        return val.replace(/\{\{?(\w+)\}?}/g, (match, key) => {
            return context[key] !== undefined ? String(context[key]) : match;
        });
    };

    const dispatchMessage = async (content: string, options: any = {}) => {
        try {
            const opts = { userId, entityId, ...options };
            if (platform === 'whatsapp') return await sendWhatsAppMessage(from, content, opts);
            if (platform === 'messenger' || platform === 'instagram') return await sendMetaMessage(from, content, { ...opts, provider: platform });
            if (platform === 'telegram') return await sendTelegramMessage(from, content, opts);
            if (platform === 'gmail') return await sendGmailMessage(from, content, opts);
        } catch (dispatchError: any) {
            console.error(`[ChatbotEngine] ⚠️ Dispatch failed for ${platform} (${from}):`, dispatchError.message);
            // Safely absorb the error so the engine continues to save the message to Firestore UI
            // and successfully drains the queue. The sendProviders function already writes the lastError.
        }
    };

    // D. RESET EXECUTION
    if (isReset) {
        console.log(`[ChatbotEngine] ♻️ EXECUTING RESET for ${from}`);
        await cardRef.update({
            'botState.status': 'inactive',
            'botState.currentNodeId': null,
            'botState.waitingForInput': false,
            'botState.messageQueue': [], // WIPE QUEUE ON RESET
            'customFields': admin.firestore.FieldValue.delete(),
            'botState.lastStep': 'FORCE_RESET'
        });
        const resetText = "🔄 Reinicio completado. Escribe 'hola' para empezar de nuevo.";
        await dispatchMessage(resetText);
        await cardRef.update({
            messages: admin.firestore.FieldValue.arrayUnion({
                sender: 'agent', text: resetText, platform, timestamp: new Date(), messageId: `bot_sys_${Date.now()}`
            })
        });
        return;
    }

    // E. RESUME OR START
    const bState = cardData.botState || {};
    
    // --- INNER EXECUTION LOOP (Node by Node until Wait) ---
    let currentNodeId: string | null = bState.currentNodeId || null;
    let waitingForInput = bState.waitingForInput || false;

    // Handle incoming input for current node
    if (waitingForInput && currentNodeId) {
        const node = flow.nodes.find((n: any) => n.id === currentNodeId);
        if (node?.type === 'captureInputNode') {
            const varName = node.data?.variableName || 'input';
            const isEmail = varName.toLowerCase().includes('mail') || varName.toLowerCase().includes('correo');
            let extracted = text;
            if (isEmail) {
                const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
                if (match) extracted = match[0];
            }

            console.log(`[ChatbotEngine] 📥 Captured ${varName}: ${extracted}`);
            const updatePayload: any = { [`customFields.${varName}`]: extracted, 'botState.waitingForInput': false };
            if (varName === 'nombre' || varName === 'name') updatePayload.contactName = extracted;
            await cardRef.update(updatePayload);

            const next = flow.edges.find((e: any) => e.source === node.id);
            currentNodeId = next ? next.target : null;
        } else {
            // QuickReply or generic wait
            const edge = flow.edges.find((e: any) => {
                const handle = String(e.sourceHandle || '').trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                return e.source === node?.id && handle === normalizedInput;
            }) || flow.edges.find((e: any) => e.source === node?.id);
            
            currentNodeId = edge ? edge.target : null;
            await cardRef.update({ 'botState.waitingForInput': false });
        }
    } else {
        // Start from beginning if not active
        if (bState.status !== 'active') {
             const start = flow.nodes.find((n: any) => n.type === 'start' || n.type === 'startNode');
             currentNodeId = start ? start.id : null;
             // Mark as active so future messages follow the flow logic
             await cardRef.update({ 'botState.status': 'active' });
        }
    }

    // Node-by-Node Forward Execution
    let executionCount = 0;
    while (currentNodeId && executionCount < 15) {
        executionCount++;
        const node = flow.nodes.find((n: any) => n.id === currentNodeId);
        if (!node) break;

        await cardRef.update({ 'botState.currentNodeId': node.id, 'botState.lastStep': `${node.type}` });

        if (node.type === 'start' || node.type === 'startNode') {
            const edge = flow.edges.find((e: any) => e.source === node.id);
            currentNodeId = edge ? edge.target : null;
            continue;
        }

        if (node.type === 'textMessageNode') {
            const content = replaceVars(node.data?.content || node.data?.text || 'Hola');
            await dispatchMessage(content);
            await cardRef.update({
                messages: admin.firestore.FieldValue.arrayUnion({
                    sender: 'agent', text: content, platform, timestamp: new Date(), messageId: `bot_${Date.now()}`
                })
            });
            const edge = flow.edges.find((e: any) => e.source === node.id);
            currentNodeId = edge ? edge.target : null;
            continue;
        }

        if (node.type === 'captureInputNode' || node.type === 'quickReplyNode') {
            const content = replaceVars(node.data?.content || node.data?.text || node.data?.bodyText || '...');
            const buttons = (node.data?.buttons || []).map((b: any) => ({
                type: 'reply', reply: { id: (b.id || b.title || b).substring(0, 20), title: (b.title || b).substring(0, 20) }
            })).slice(0, 3);

            await dispatchMessage(content, node.type === 'quickReplyNode' ? { type: 'quick_reply', buttons } : {});
            await cardRef.update({
                messages: admin.firestore.FieldValue.arrayUnion({
                    sender: 'agent', text: content, platform, timestamp: new Date(), messageId: `bot_wait_${Date.now()}`
                }),
                'botState.status': 'active',
                'botState.waitingForInput': true,
                'botState.currentNodeId': node.id,
                'botState.variableName': node.data?.variableName || 'input'
            });
            return; // EXIT loop, wait for user
        }

        if (node.type === 'conditionNode') {
            const snap = await cardRef.get();
            const fresh = snap.data() || {};
            const val = String(fresh.customFields?.[node.data?.variableName] || '').trim().toLowerCase();
            let target = null;
            for (const r of node.data?.routes || []) {
                if (val === String(r.value || '').trim().toLowerCase()) {
                    target = flow.edges.find((e: any) => e.source === node.id && e.sourceHandle === r.id)?.target;
                    break;
                }
            }
            currentNodeId = target || flow.edges.find((e: any) => e.source === node.id && e.sourceHandle === 'else')?.target;
            continue;
        }

        if (node.type === 'setVariableNode') {
            await cardRef.update({ [`customFields.${node.data?.variableName}`]: node.data?.value });
            const edge = flow.edges.find((e: any) => e.source === node.id);
            currentNodeId = edge ? edge.target : null;
            continue;
        }

        if (node.type === 'endNode') {
            await cardRef.update({ 'botState.status': 'completed', 'botState.waitingForInput': false });
            return;
        }
        break;
    }
}
