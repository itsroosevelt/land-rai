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

            // Acquire lock and mark start
            transaction.update(cardRef, { 
                botLock: admin.firestore.FieldValue.serverTimestamp(),
                'botState.lastProcessedMessageId': messageId || null
            });
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

            try {
                // --- 3. INNER ENGINE CORE ---
                await runEngineCycle(cardRef, cardData, currentMsg, entityPath, entityId, userId);
            } catch (cycleErr: any) {
                console.error(`[ChatbotEngine] ❌ Cycle Error [${msgId}]:`, cycleErr.message);
                // Log error to card but DON'T stop the whole runner
                await cardRef.update({
                    'botState.lastError': cycleErr.message || 'Unknown Cycle Error',
                    'botState.lastErrorAt': admin.firestore.FieldValue.serverTimestamp()
                });
            } finally {
                // --- 4. ATOMIC QUEUE DRAIN (MUST happen even on failure to avoid blocking) ---
                await db.runTransaction(async (transaction) => {
                    transaction.update(cardRef, {
                        'botState.messageQueue': admin.firestore.FieldValue.arrayRemove(currentMsg),
                        botLock: admin.firestore.FieldValue.serverTimestamp() // Refresh lock
                    });
                });
            }
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

    // A. RESET CHECK (Master Bypass) - MOVED TO TOP
    const normalizedInput = text.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const isReset = normalizedInput === 'reiniciar' || normalizedInput === 'menu' || normalizedInput === 'reset' ||
        normalizedInput.includes('reinicia todo ahora') || normalizedInput.startsWith('reinici');

    // Trigger check for "hola" and variants
    const isStartTrigger = normalizedInput === 'hola' || normalizedInput === 'hi' || normalizedInput === 'buenas' || normalizedInput === 'inicio';
    
    // TRACK SESSION VARIABLES (Avoids stale cardData)
    const sessionVars = {
        nombre: cardData.contactName || 'Usuario',
        name: cardData.contactName || 'Usuario',
        first_name: (cardData.contactName || 'Usuario').split(' ')[0],
        ...(cardData.customFields || {}),
        ...(cardData.variables || {})
    };

    const dispatchMessage = async (content: string, options: any = {}) => {
        const opts = { userId, entityId, ...options };
        if (platform === 'whatsapp') return await sendWhatsAppMessage(from, content, opts);
        if (platform === 'messenger' || platform === 'instagram') return await sendMetaMessage(from, content, { ...opts, provider: platform });
        if (platform === 'telegram') return await sendTelegramMessage(from, content, opts);
        if (platform === 'gmail') return await sendGmailMessage(from, content, opts);
    };

    // SMART CLEANING HELPER
    const cleanInput = (raw: string, varName: string): string => {
        const val = raw.trim();
        const v = varName.toLowerCase();
        
        // A. EMAIL EXTRACTION
        if (v.includes('mail') || v.includes('correo')) {
            const match = val.match(/[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*/);
            return match ? match[0] : val;
        }
        
        // B. NAME CLEANSING
        if (v === 'nombre' || v === 'name' || v === 'first_name') {
            let cleaned = val;
            const prefixes = [
                /^(hola,?\s+)?me\s+llamo\s+/i,
                /^(hola,?\s+)?mi\s+nombre\s+es\s+/i,
                /^(hola,?\s+)?soy\s+/i,
                /^(mucho\s+gusto,?\s+)/i,
                /^(buen(as|os)\s+(dias|noches|tardes),?\s+)/i
            ];
            prefixes.forEach(p => { cleaned = cleaned.replace(p, ''); });
            // Capitalize names
            return cleaned.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ').trim();
        }
        
        return val;
    };

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
            ...sessionVars,
            ...overlay
        };
        // Bulletproof regex for {{var}} and {var}
        return val.replace(/\{\{?(\w+)\}?}/g, (match, key) => {
            return context[key] !== undefined ? String(context[key]) : match;
        });
    };

    // E. RESUME OR START
    const bState = cardData.botState || {};
    
    // --- INNER EXECUTION LOOP (Node by Node until Wait) ---
    let currentNodeId: string | null = bState.currentNodeId || null;
    let waitingForInput = bState.waitingForInput || false;

    // FIX: If status is 'active' but we have no node (stuck) or it's 'completed', we should try to restart
    const shouldRestart = isStartTrigger || !currentNodeId || bState.status === 'completed' || bState.status === 'inactive';

    // Handle incoming input for current node
    if (waitingForInput && currentNodeId) {
        // AGNOSTIC RULE: Do not allow the same message that triggered the start to be captured as an input
        // This prevents "mucho gusto hola" if 'hola' was the trigger.
        if (isStartTrigger || (shouldRestart && !waitingForInput)) {
            console.log(`[ChatbotEngine] 🛡️ Trigger message blocked from capture captureInputNode to prevent auto-fill.`);
        } else {
            const node = flow.nodes.find((n: any) => n.id === currentNodeId);
            if (node?.type === 'captureInputNode') {
                const varName = node.data?.variableName || 'input';
                const inputType = node.data?.inputType || 'text';
                const validationRegex = node.data?.validationRegex;
                const errorMessage = node.data?.errorMessage || 'Formato inválido. Por favor intenta de nuevo.';
                
                // 1. SMART EXTRACTION & CLEANSING
                // We use inputType to decide how to clean, or fallback to name heuristics
                let extracted = text;
                const isEmail = inputType === 'email' || varName.toLowerCase().includes('mail') || varName.toLowerCase().includes('correo');
                const isName = inputType === 'text' && (varName.toLowerCase().includes('nombre') || varName.toLowerCase().includes('name'));

                if (isEmail) {
                    extracted = cleanInput(text, 'email'); // Force email cleaning
                } else if (isName) {
                    extracted = cleanInput(text, 'nombre'); // Force name cleaning
                } else {
                    extracted = text.trim();
                }

                // 2. VALIDATION (Smart)
                let isValid = true;

                // RULE 1: If result is empty after cleaning, it's invalid noise
                if (!extracted) {
                    console.log(`[ChatbotEngine] 🛡️ Smart rejection: Input for ${varName} was purely noise or empty.`);
                    isValid = false;
                }

                // RULE 2: Regex Validation (if defined)
                if (isValid && validationRegex) {
                    try {
                        const regex = new RegExp(validationRegex, 'i');
                        isValid = regex.test(extracted);
                        console.log(`[ChatbotEngine] 🔍 Validation Check: "${extracted}" against /${validationRegex}/i => ${isValid}`);
                    } catch (e) {
                        console.error(`[ChatbotEngine] ❌ Invalid Regex in node ${node.id}:`, validationRegex);
                    }
                }

                if (!isValid) {
                    console.log(`[ChatbotEngine] ⚠️ Validation failed for ${varName}: "${extracted}"`);
                    // Stay on same node, send error message (default or custom)
                    const errorContent = replaceVars(errorMessage);
                    await dispatchMessage(errorContent);
                    return;
                }

                // 3. SUCCESS HANDLING
                console.log(`[ChatbotEngine] ✅ Captured & Validated ${varName}: ${extracted}`);
                const updatePayload: any = { [`customFields.${varName}`]: extracted, 'botState.waitingForInput': false };
                
                if (isName) {
                    updatePayload.contactName = extracted;
                    sessionVars.nombre = extracted;
                    sessionVars.name = extracted;
                }
                sessionVars[varName] = extracted;
                await cardRef.update(updatePayload);

                // Find next node (Success edge)
                // UNIVERSAL CONNECTOR LOGIC: 
                // 1. Look for 'success' handle
                // 2. Look for ANY edge that isn't for a specific 'fail' handle
                // 3. Take first available edge
                const edges = flow.edges.filter((e: any) => e.source === node.id);
                const next = edges.find((e: any) => e.sourceHandle === 'success') 
                          || edges.find((e: any) => !e.sourceHandle || !e.sourceHandle.toLowerCase().includes('fail'))
                          || edges[0];
                
                if (next) {
                    console.log(`[ChatbotEngine] ➡️ Validated! Moving from ${node.id} to ${next.target}`);
                    currentNodeId = next.target;
                } else {
                    console.log(`[ChatbotEngine] ⚠️ No outgoing edge found for node ${node.id}. Flow ends here.`);
                    currentNodeId = null;
                }
            } else {
                // QuickReply or generic wait
                const edge = flow.edges.find((e: any) => {
                    const handle = String(e.sourceHandle || '').trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    return e.source === node?.id && handle === normalizedInput;
                }) || flow.edges.find((e: any) => e.source === node?.id);
                
                currentNodeId = edge ? edge.target : null;
                await cardRef.update({ 'botState.waitingForInput': false });
            }
        }
    } else {
        // Start from beginning if not active or if stuck
        if (shouldRestart) {
             const start = flow.nodes.find((n: any) => n.type === 'start' || n.type === 'startNode');
             currentNodeId = start ? start.id : null;
             console.log(`[ChatbotEngine] 🆕 Starting/Restarting flow at node ${currentNodeId}`);
        }
    }

    // Node-by-Node Forward Execution
    let executionCount = 0;
    while (currentNodeId && executionCount < 15) {
        executionCount++;
        const node = flow.nodes.find((n: any) => n.id === currentNodeId);
        if (!node) {
            console.log(`[ChatbotEngine] 🛑 Node not found: ${currentNodeId}`);
            break;
        }

        console.log(`[ChatbotEngine] ⚙️ Executing Node Type: ${node.type} (${node.id})`);
        
        // Skip start nodes in the middle of execution
        if (node.type === 'start' || node.type === 'startNode') {
            const edge = flow.edges.find((e: any) => e.source === node.id);
            currentNodeId = edge ? edge.target : null;
            continue;
        }

        await cardRef.update({ 'botState.currentNodeId': node.id, 'botState.lastStep': `${node.type}` });

        if (node.type === 'start' || node.type === 'startNode') {
            const edge = flow.edges.find((e: any) => e.source === node.id);
            currentNodeId = edge ? edge.target : null;
            continue;
        }

        // 1. TEXT MESSAGE
        if (node.type === 'textMessageNode') {
            const content = replaceVars(node.data?.content || node.data?.text || 'Hola');
            await dispatchMessage(content);
            if (content.trim()) {
                await cardRef.update({
                    messages: admin.firestore.FieldValue.arrayUnion({
                        sender: 'agent', text: content, platform, timestamp: new Date(), messageId: `bot_${Date.now()}`
                    })
                });
            }
            const edge = flow.edges.find((e: any) => e.source === node.id);
            currentNodeId = edge ? edge.target : null;
            continue;
        }

        // 2. MEDIA MESSAGE
        if (node.type === 'mediaMessageNode') {
            const url = node.data?.url;
            const caption = replaceVars(node.data?.caption || '');
            if (url) {
                // We use dispatchMessage for caption and assume provider can handle media if we had a dedicated tool, 
                // for now we send caption as text + url if possible.
                await dispatchMessage(`${caption}\n${url}`.trim());
                await cardRef.update({
                    messages: admin.firestore.FieldValue.arrayUnion({
                        sender: 'agent', text: caption || 'Imagen', platform, timestamp: new Date(), messageId: `bot_media_${Date.now()}`
                    })
                });
            }
            const edge = flow.edges.find((e: any) => e.source === node.id);
            currentNodeId = edge ? edge.target : null;
            continue;
        }

        // 3. CAPTURE / QUICK REPLY (Wait nodes)
        if (node.type === 'captureInputNode' || node.type === 'quickReplyNode') {
            const content = replaceVars(node.data?.content || node.data?.text || node.data?.bodyText || '');
            const buttons = (node.data?.buttons || []).map((b: any) => ({
                type: 'reply', reply: { id: (b.id || b.title || b).substring(0, 20), title: (b.title || b).substring(0, 20) }
            })).slice(0, 3);

            if (content.trim()) {
                await dispatchMessage(content, node.type === 'quickReplyNode' ? { type: 'quick_reply', buttons } : {});
            }
            
            const updatePayload: any = {
                'botState.status': 'active',
                'botState.waitingForInput': true,
                'botState.currentNodeId': node.id,
                'botState.variableName': node.data?.variableName || 'input'
            };
            
            if (content.trim()) {
                updatePayload.messages = admin.firestore.FieldValue.arrayUnion({
                    sender: 'agent', text: content, platform, timestamp: new Date(), messageId: `bot_wait_${Date.now()}`
                });
            }
            
            await cardRef.update(updatePayload);
            return; // EXIT loop, wait for user
        }

        // 4. LOGIC NODES (Set Variable, Webhook, etc.) - DEFAULT SKIP & ADVANCE
        // This is the "Agnostic" part: if it has an edge, just follow it.
        console.log(`[ChatbotEngine] ⏩ Skipping logic/unknown node type: ${node.type}`);
        const edge = flow.edges.find((e: any) => e.source === node.id);
        currentNodeId = edge ? edge.target : null;
        if (!edge) break; // End of flow if no way forward
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
