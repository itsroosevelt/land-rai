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

export async function processChatbotFlow(ctx: ChatbotContext) {
    const { userId, entityId, groupId, cardId, platform, from, text, messageId } = ctx;
    const entityPath = `users/${userId}/entities/${entityId}`;

    console.log(`[ChatbotEngine] 🚀 START | Platform: ${platform} | From: ${from} | Text: "${text}"`);

    // HIT AUDIT (Visible in CRM System Logs)
    try {
        await db.collection(`users/${userId}/entities/${entityId}/system_logs`).add({
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            type: 'chatbot_engine_hit',
            platform,
            from,
            textSnippet: text?.substring(0, 50)
        });
    } catch (e) { }

    // 0. QUICK RESET DETECTION
    const inputRaw = text || '';
    const input = inputRaw.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    // Fuzzy reset detection: catch typos like 'reincia', 'reiniciar', 'reset', 'menu'
    const isReset = input === 'reiniciar' || input === 'menu' || input === 'reset' ||
        input.includes('reinicia todo ahora') ||
        input.includes('reincia todo ahora') ||
        input.includes('reinicia el bot') ||
        input.includes('reinicio') ||
        input.includes('reiniciar chat') ||
        /^rein[ic]{1,4}[ao]/.test(input) || 
        input.startsWith('reinici') || input.startsWith('reincia');

    try {
        // 1. Core Data Retrieval
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
        const flow = activeBot.flow || { nodes: [], edges: [] };

        const cardRef = db.doc(`${entityPath}/kanban-groups/${groupId}/cards/${cardId}`);
        const cardSnap = await cardRef.get();
        if (!cardSnap.exists) {
            console.error(`[ChatbotEngine] ❌ Card ${cardId} NOT found in Firestore.`);
            return;
        }
        const cardData = cardSnap.data() || {};
        const currentState = cardData.botState || {};

        // 2. HELPERS (Must be declared before reset block)
        const replaceVars = (val: string, overlay: any = {}) => {
            if (!val) return '';
            let p = val;
            const context = {
                nombre: cardData.contactName || 'Usuario',
                name: cardData.contactName || 'Usuario',
                namecli: cardData.contactName || 'Usuario',
                first_name: cardData.contactName?.split(' ')[0] || 'Usuario',
                ...(cardData.customFields || {}),
                ...(cardData.variables || {}),
                ...overlay
            };
            // CRITICAL: Replace {{var}} BEFORE {var} to prevent partial corruption
            // e.g. {var} regex inside {{var}} would turn {{value}} into {replacedValue}
            for (const [k, v] of Object.entries(context)) {
                p = p.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'gi'), String(v));
            }
            for (const [k, v] of Object.entries(context)) {
                p = p.replace(new RegExp(`\\{${k}\\}`, 'gi'), String(v));
            }
            return p;
        };

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
                // PERSIST ERROR FOR CRM VISIBILITY
                try {
                    await cardRef.update({
                        'botState.lastError': err.message,
                        'botState.lastErrorAt': admin.firestore.FieldValue.serverTimestamp()
                    });
                } catch (inner) { }
                throw err;
            }
        };

        const executeFlow = async (startId: string, runtimeContext: any = {}, allowLookBack: boolean = false) => {
            let currentNodeId: string | null = startId;
            let executionCount = 0;
            const MAX_STEPS = 15;
            const currentOverlay = { ...runtimeContext };

            while (currentNodeId && executionCount < MAX_STEPS) {
                executionCount++;
                const node = flow.nodes.find((n: any) => n.id === currentNodeId);
                if (!node) break;

                if (node.type === 'startNode' || node.type === 'start') {
                    const edge = flow.edges.find((e: any) => e.source === node.id);
                    currentNodeId = edge ? edge.target : null;
                    continue;
                }

                if (node.type === 'textMessageNode') {
                    const msg = replaceVars(node.data?.content || node.data?.text || 'Hola', currentOverlay);
                    let messageId = `bot_${Date.now()}`;
                    let sendError = null;

                    try {
                        const res = await dispatchMessage(msg);
                        messageId = res?.message_id || res?.messageId || messageId;
                    } catch (err: any) {
                        sendError = err.message;
                    }

                    await cardRef.update({
                        messages: admin.firestore.FieldValue.arrayUnion({
                            sender: 'agent',
                            text: msg,
                            platform,
                            timestamp: new Date(),
                            messageId,
                            status: sendError ? 'error' : 'sent',
                            error: sendError
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
                    const msg = replaceVars(node.data?.bodyText || node.data?.text || 'Selecciona:', currentOverlay);
                    const buttons = (node.data?.buttons || []).map((btn: any) => ({
                        type: 'reply',
                        reply: {
                            id: (typeof btn === 'object' ? (btn.id || btn.title) : btn).substring(0, 20),
                            title: (typeof btn === 'object' ? btn.title : btn).substring(0, 20)
                        }
                    })).slice(0, 3);

                    // --- LOOK-BACK for QuickReply (only when genuinely resuming) ---
                    if (allowLookBack) {
                        const snap = await cardRef.get();
                        const cardData = snap.data() || {};
                        const lastMsg = (cardData.messages || []).slice(-1)[0];
                        // Allow if it's a user message (including the current one that triggered this)
                        if (lastMsg && lastMsg.sender === 'user') {
                            const normalizedInput = String(lastMsg.text || '').trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                            const edge = flow.edges.find((e: any) => {
                                const handle = String(e.sourceHandle || '').trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                                return e.source === node.id && handle === normalizedInput;
                            });
                            if (edge) {
                                console.log(`[ChatbotEngine] ⚡ Look-back: Using existing user message "${lastMsg.text}" for QuickReply`);
                                await cardRef.update({ 'botState.currentNodeId': node.id });
                                currentNodeId = edge.target;
                                continue;
                            }
                        }
                    }

                    let sendError = null;
                    try {
                        await dispatchMessage(msg, { type: 'quick_reply', buttons });
                    } catch (err: any) {
                        sendError = err.message;
                    }

                    await cardRef.update({
                        messages: admin.firestore.FieldValue.arrayUnion({
                            sender: 'agent',
                            text: msg,
                            platform,
                            timestamp: new Date(),
                            messageId: `bot_qr_${Date.now()}`,
                            status: sendError ? 'error' : 'sent'
                        }),
                        'botState.currentNodeId': node.id,
                        'botState.status': 'active',
                        'botState.waitingForInput': true,
                        'botState.lastInteraction': new Date(),
                        updatedAt: new Date()
                    });
                    return;
                }

                if (node.type === 'captureInputNode') {
                    const prompt = replaceVars(node.data?.content || node.data?.text || '', currentOverlay);
                    
                    // --- LOOK-BACK (only when genuinely resuming, not on fresh starts/resets) ---
                    if (allowLookBack) {
                        const snap = await cardRef.get();
                        const cardData = snap.data() || {};
                        const lastMsg = (cardData.messages || []).slice(-1)[0];
                        const lastMsgNormalized = String(lastMsg?.text || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                        const isLastMsgAReset = lastMsgNormalized === 'reiniciar' || lastMsgNormalized === 'reset' || lastMsgNormalized === 'menu' ||
                            lastMsgNormalized.includes('reinicia todo ahora') || lastMsgNormalized.startsWith('reinici');
                        
                        // Allow if it's a user message (including the current one) and NOT a reset
                        if (lastMsg && lastMsg.sender === 'user' && !isLastMsgAReset) {
                            console.log(`[ChatbotEngine] ⚡ Look-back: Capturing user message "${lastMsg.text}" for variable ${node.data?.variableName}`);
                            await cardRef.update({ 
                                [`customFields.${node.data?.variableName || 'last_input'}`]: lastMsg.text,
                                'botState.currentNodeId': node.id 
                            });
                            const next = flow.edges.find((e: any) => e.source === node.id);
                            if (next) {
                                currentNodeId = next.target;
                                continue;
                            }
                        }
                    }

                    if (prompt) await dispatchMessage(prompt);
                    await cardRef.update({
                        'botState.currentNodeId': node.id,
                        'botState.status': 'active',
                        'botState.waitingForInput': true,
                        'botState.variableName': node.data?.variableName || 'last_input',
                        'botState.lastInteraction': new Date()
                    });
                    return;
                }

                if (node.type === 'conditionNode') {
                    const snap = await cardRef.get();
                    const freshData = snap.data() || {};
                    const rawVal = freshData.customFields?.[node.data?.variableName] || freshData.variables?.[node.data?.variableName];
                    const val = String(rawVal || '').trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

                    let target = null;
                    for (const r of node.data?.routes || []) {
                        const targetVal = String(r.value || '').trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                        if (r.condition === 'equals' && val === targetVal) {
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
                    await cardRef.update({
                        'botState.status': 'completed',
                        'botState.currentNodeId': node.id,
                        'botState.waitingForInput': false
                    });
                    return;
                }

                break;
            }
        };

        // 3. FIFO QUEUE: If card is actively locked, enqueue this message instead of dropping it
        if (!isReset) {
            const wasQueued = await db.runTransaction(async (transaction) => {
                const snap = await transaction.get(cardRef);
                if (!snap.exists) return false;
                const data = snap.data() || {};

                if (!data.botLock) return false; // Not locked — proceed normally

                const lockTime = data.botLock.toDate?.() || new Date(data.botLock);
                const diff = (new Date().getTime() - lockTime.getTime()) / 1000;
                if (diff >= 4) return false; // Lock is stale — proceed normally

                // Card is actively locked: add this message to the pending queue
                const pendingMsg = {
                    text: text || '',
                    messageId: messageId || `mid_${Date.now()}`,
                    platform,
                    from,
                    queuedAt: new Date().toISOString()
                };

                // Dedup: don't queue the same messageId twice
                const alreadyQueued = (data.pendingMessages || []).some(
                    (m: any) => m.messageId && m.messageId === pendingMsg.messageId
                );
                if (alreadyQueued) return true; // Already in queue, silently skip

                transaction.update(cardRef, {
                    pendingMessages: admin.firestore.FieldValue.arrayUnion(pendingMsg)
                });
                return true;
            });

            if (wasQueued) {
                console.log(`[ChatbotEngine] 📥 Message queued (card busy): "${text?.substring(0, 30)}"`);
                return;
            }
        }

            // 4. ATOMIC OPERATION (Transaction-based — NO async side-effects inside)
            const proceedData = await db.runTransaction(async (transaction) => {
                const snap = await transaction.get(cardRef);
                if (!snap.exists) return null;
                const data = snap.data() || {};
                const bState = data.botState || {};
                const now = new Date();

                // MASTER RESET BYPASS: Always allow reset, clear queue and state
                if (isReset) {
                    console.log(`[ChatbotEngine] ♻️ Reset requested for ${cardId} (Master Bypass)`);
                    transaction.update(cardRef, {
                        'botLock': now,
                        'botState': admin.firestore.FieldValue.delete(),
                        'customFields': admin.firestore.FieldValue.delete(),
                        'pendingMessages': admin.firestore.FieldValue.delete(), // Clear queue on reset
                        'updatedAt': now
                    });
                    return { data, bState: {}, reset: true };
                }

                // Deduplication
                if (messageId && bState.lastProcessedMessageId === messageId) return null;

                // Lock Check inside transaction (definitive)
                if (data.botLock) {
                    const lockTime = data.botLock.toDate?.() || new Date(data.botLock);
                    const diff = (now.getTime() - lockTime.getTime()) / 1000;
                    if (diff < 4) {
                        console.warn(`[ChatbotEngine] 🔒 Card ${cardId} still LOCKED in transaction. Will queue.`);
                        return null;
                    }
                }

            // Acquire Lock & Mark Message
            transaction.update(cardRef, {
                botLock: now,
                'botState.lastProcessedMessageId': messageId
            });

            return { data, bState };
        });

        if (!proceedData) {
            console.warn(`[ChatbotEngine] ⏩ Skipping: Card ${cardId} is either locked or message ${messageId} already processed.`);
            return;
        }

        const stateSnapshot = proceedData.bState;

        if (proceedData.reset) {
            console.log(`[ChatbotEngine] ♻️ EXECUTING RESET for card ${cardId}`);
            const resetConfirmText = "🔄 Reinicio completado, empezamos de nuevo.";
            
            // Try to send confirmation with detailed error logging
            let resetSent = false;
            for (let attempt = 1; attempt <= 2; attempt++) {
                try {
                    await dispatchMessage(resetConfirmText);
                    resetSent = true;
                    console.log(`[ChatbotEngine] ✅ Reset confirmation sent (attempt ${attempt})`);
                    break;
                } catch (e: any) {
                    console.error(`[ChatbotEngine] ❌ Reset confirmation FAILED (attempt ${attempt}):`, e?.message || e);
                    if (attempt < 2) await sleep(1000); // Wait 1s before retry
                }
            }

            // Always record in Firestore regardless of send success
            await cardRef.update({
                messages: admin.firestore.FieldValue.arrayUnion({
                    sender: 'agent',
                    text: resetConfirmText,
                    platform,
                    timestamp: new Date(),
                    messageId: `bot_sys_${Date.now()}`,
                    delivered: resetSent
                })
            });

            // Clear local stale data
            if (cardData.customFields) Object.keys(cardData.customFields).forEach(k => delete cardData.customFields[k]);
            if (cardData.variables) Object.keys(cardData.variables).forEach(k => delete cardData.variables[k]);

            const startNode = flow.nodes.find((n: any) => n.type === 'start' || n.type === 'startNode');
            if (startNode) await executeFlow(startNode.id, {}, false); // NO look-back on reset
            return;
        }

        // 5. FLOW LOGIC (RESUME OR START)
        if (stateSnapshot.waitingForInput && stateSnapshot.currentNodeId) {
            const node = flow.nodes.find((n: any) => n.id === stateSnapshot.currentNodeId);
            if (node?.type === 'captureInputNode') {
                const varName = stateSnapshot.variableName || 'input';
                const nodeData = node.data || {};

                let extractedValue = text;
                const isNameVar = varName.toLowerCase().includes('name') || varName.toLowerCase().includes('nombre');
                const isEmailVar = varName.toLowerCase().includes('mail') || varName.toLowerCase().includes('correo');

                if (isNameVar) {
                    const match = text.match(/(?:me llamo|mi nombre es|soy|nombre:)\s+([a-z\s]+)/i);
                    if (match && match[1]) extractedValue = match[1].trim();
                } else if (isEmailVar) {
                    const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
                    if (match) extractedValue = match[0];
                }

                console.log(`[ChatbotEngine] 📥 Captured ${varName}: ${extractedValue}`);

                const updatePayload: any = {
                    [`customFields.${varName}`]: extractedValue,
                    'botState.waitingForInput': false
                };
                
                if (isNameVar) {
                    updatePayload.contactName = extractedValue;
                    updatePayload['customFields.namecli'] = extractedValue;
                }

                await cardRef.update(updatePayload);
                const next = flow.edges.find((e: any) => e.source === node.id);
                // allowLookBack=false: user just answered, don't re-capture old messages for NEW nodes
                if (next) await executeFlow(next.target, { [varName]: extractedValue, namecli: extractedValue }, false);
                else await cardRef.update({ 'botState.status': 'completed' });
            } else {
                const normalizedText = text.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                const edge = flow.edges.find((e: any) => {
                    const handle = String(e.sourceHandle || '').trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    return e.source === node?.id && handle === normalizedText;
                });

                if (edge) {
                    await cardRef.update({ 'botState.waitingForInput': false });
                    await executeFlow(edge.target);
                } else {
                    const fallback = flow.edges.find((e: any) => e.source === node?.id);
                    if (fallback) {
                        await cardRef.update({ 'botState.waitingForInput': false });
                        await executeFlow(fallback.target);
                    } else {
                        await cardRef.update({ 'botState.status': 'completed' });
                    }
                }
            }
        } else if (stateSnapshot.status === 'active' && stateSnapshot.currentNodeId) {
            // THE BOT TURN WAS INTERRUPTED: Try to capture the incoming message at the current node
            console.log(`[ChatbotEngine] ⚡ RESUMING active turn at ${stateSnapshot.currentNodeId}`);
            // allowLookBack=true: the message that just arrived is the input we need!
            await executeFlow(stateSnapshot.currentNodeId, {}, true);
        } else {
            // FRESH START OR RESTART (If completed/none)
            const startNode = flow.nodes.find((n: any) => n.type === 'start' || n.type === 'startNode');
            if (startNode) {
                console.log(`[ChatbotEngine] 🚀 ${stateSnapshot.status === 'completed' ? 'RESTARTING' : 'FRESH START'} for ${cardId}`);
                await executeFlow(startNode.id, {}, false); // NO look-back on fresh start
            }
        }

    } catch (err: any) {
        console.error(`[ChatbotEngine] 💥 CRITICAL FAILURE:`, err.message);
    } finally {
        try {
            // 1. Release the processing lock
            const cardRefFinal = db.doc(`${entityPath}/kanban-groups/${groupId}/cards/${cardId}`);
            await cardRefFinal.update({ botLock: admin.firestore.FieldValue.delete() });

            // 2. Drain queue: pick the oldest pending message and process it next
            const afterSnap = await cardRefFinal.get();
            const pending: any[] = (afterSnap.data()?.pendingMessages || [])
                .sort((a: any, b: any) => new Date(a.queuedAt).getTime() - new Date(b.queuedAt).getTime());

            if (pending.length > 0) {
                const nextMsg = pending[0];

                // Atomically remove from queue before processing
                await cardRefFinal.update({
                    pendingMessages: admin.firestore.FieldValue.arrayRemove(nextMsg)
                });

                console.log(`[ChatbotEngine] 📤 Draining queue (${pending.length} pending). Processing: "${nextMsg.text?.substring(0, 30)}"`);

                // Process next message — it will acquire its own lock
                await processChatbotFlow({
                    userId,
                    entityId,
                    groupId,
                    cardId,
                    platform: nextMsg.platform || platform,
                    from: nextMsg.from || from,
                    text: nextMsg.text,
                    messageId: nextMsg.messageId
                });
            }
        } catch (e) {
            console.error('[ChatbotEngine] ⚠️ Queue drain error:', e);
        }
    }
}
