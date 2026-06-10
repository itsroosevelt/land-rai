import { admin, db } from './firebase-admin';
import { sendMetaMessage, sendWhatsAppMessage, sendTelegramMessage, sendGmailMessage } from './sendProviders';
import {
    buildWhatsAppQuickReplyButtons,
    buildWhatsAppListSections,
    resolveDefaultNextEdge,
    resolveListMessageEdge,
    resolveQuickReplyEdge,
    sanitizeFlowButtons,
} from './flowRouting';

export interface ChatbotContext {
    userId: string;
    entityId: string;
    groupId: string;
    cardId: string;
    platform: 'whatsapp' | 'messenger' | 'instagram' | 'telegram' | 'gmail' | 'x_twitter' | 'x';
    from: string;
    text: string;
    messageId?: string;
}

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

function dedupeQueueItems(queue: any[]): any[] {
    const seen = new Set<string>();
    return (queue || []).filter((item) => {
        const id = String(item?.messageId || '').trim();
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
    });
}

/**
 * Sequential Chatbot Engine Runner
 * Implements a FIFO queue consumer pattern to prevent race conditions and duplicate responses.
 */
export async function processChatbotFlow(ctx: ChatbotContext, retryCount = 0) {
    const { userId, entityId, groupId, cardId, platform, from, text, messageId } = ctx;
    const triggerMessageId = messageId ? String(messageId).trim() : '';
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

            const normInput = (text || '').trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const isPriorityCommand = /^(reinici[ao]r?|reinici|reinci(ar)?|restart|reset|clear|limpiar|borrar|menu|opciones|ayuda|help|inicio|start)/i.test(normInput);

            if (isPriorityCommand && data.botLock) {
                console.log(`[ChatbotEngine] 🔓 Priority command breaking existing lock for ${cardId}`);
            }

            // DEDUP: Skip only when this webhook message was fully processed in a prior run.
            if (triggerMessageId && bState.lastProcessedMessageId === triggerMessageId) return false;

            // LOCK CHECK: If still locked (not a priority command), check timeout
            if (data.botLock && !isPriorityCommand) {
                const lockTime = data.botLock.toDate?.() || new Date(data.botLock);
                const diff = (Date.now() - lockTime.getTime()) / 1000;
                if (diff < 30) {
                    console.log(`[ChatbotEngine] 🔒 Card ${cardId} is actively locked (${diff}s). Skipping parallel execution.`);
                    return false;
                }
            }

            // Acquire lock only — lastProcessedMessageId is set after the queue item is consumed.
            transaction.update(cardRef, {
                botLock: admin.firestore.FieldValue.serverTimestamp(),
            });
            return true;
        });

        if (!canExecute) {
            if (retryCount < 2 && triggerMessageId) {
                const blockedSnap = await cardRef.get();
                const blockedData = blockedSnap.data() || {};
                const blockedState = blockedData.botState || {};
                const stillPending = dedupeQueueItems(blockedState.messageQueue || [])
                    .some((item) => String(item?.messageId || '').trim() === triggerMessageId);
                const notYetProcessed = blockedState.lastProcessedMessageId !== triggerMessageId;

                if (stillPending && notYetProcessed && blockedData.botLock) {
                    console.log(`[ChatbotEngine] ⏳ Lock contention for ${cardId}; retrying queue consumer (${retryCount + 1}/2)`);
                    await sleep(2000);
                    return processChatbotFlow(ctx, retryCount + 1);
                }
            }
            return;
        }

        // Trim stale/duplicate queue entries before consuming (prevents old messages re-firing prompts).
        const preRunSnap = await cardRef.get();
        const preRunQueue = dedupeQueueItems(preRunSnap.data()?.botState?.messageQueue || []);
        if (preRunQueue.length > 5) {
            const trimmed = preRunQueue.slice(-5);
            await cardRef.update({ 'botState.messageQueue': trimmed });
            console.log(`[ChatbotEngine] 🧹 Trimmed message queue from ${preRunQueue.length} to ${trimmed.length}`);
        }

        // --- 2. THE CONSUMER LOOP ---
        const processedInRunner = new Set<string>();
        let queueHasItems = true;
        while (queueHasItems) {
            const snap = await cardRef.get();
            const cardData = snap.data() || {};
            const bState = cardData.botState || {};
            const queue = dedupeQueueItems(bState.messageQueue || []);

            if (queue.length === 0) {
                queueHasItems = false;
                break;
            }

            // Consume first item (FIFO)
            const currentMsg = queue[0];
            const msgId = String(currentMsg.messageId || '').trim();
            const msgText = String(currentMsg.text || '').trim();
            const msgPlatform = currentMsg.platform || platform;
            const msgFrom = currentMsg.from || from;

            // Skip duplicate deliveries within this runner, or stale items already handled earlier.
            const isStaleProcessedItem = !!msgId
                && bState.lastProcessedMessageId === msgId
                && msgId !== triggerMessageId;
            if (msgId && (processedInRunner.has(msgId) || isStaleProcessedItem)) {
                console.log(`[ChatbotEngine] ⏭️ Skipping duplicate queue item [${msgId}]`);
                await db.runTransaction(async (transaction) => {
                    transaction.update(cardRef, {
                        'botState.messageQueue': admin.firestore.FieldValue.arrayRemove(currentMsg),
                    });
                });
                continue;
            }

            if (msgId) processedInRunner.add(msgId);

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
                        'botState.lastProcessedMessageId': msgId || null,
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

    const appendAgentMessage = async (message: any) => {
        await cardRef.update({
            messages: admin.firestore.FieldValue.arrayUnion({
                sender: 'agent',
                platform,
                timestamp: new Date(),
                ...message
            })
        });
    };

    // --- A. HELPERS (Essentials) ---
    const dispatchMessage = async (content: string, options: any = {}) => {
        const opts = { userId, entityId, ...options };
        if (platform === 'whatsapp') return await sendWhatsAppMessage(from, content, opts);
        if (platform === 'messenger' || platform === 'instagram') return await sendMetaMessage(from, content, { ...opts, provider: platform });
        if (platform === 'telegram') return await sendTelegramMessage(from, content, opts);
        if (platform === 'gmail') return await sendGmailMessage(from, content, opts);
    };

    const normalizedInput = text.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    // Command categorization (Master Engine Sync)
    // Regex expanded to catch typos like 'reinciar', 'reiniciar', 'restart', etc.
    const isExplicitReset = /^(reinici[ao]r?|reinici|reinci(ar)?|reset|restart|clear|limpiar|borrar)/i.test(normalizedInput);
    
    // TIMEOUT LOGIC: If waiting for input for >= 15 days, auto-reset
    let isTimeoutReset = false;
    if (cardData.botState?.waitingForInput && cardData.botState?.lastWaitStartedAt) {
        const lastWait = cardData.botState.lastWaitStartedAt.toDate?.() || new Date(cardData.botState.lastWaitStartedAt);
        const daysPassed = (Date.now() - lastWait.getTime()) / (1000 * 60 * 60 * 24);
        if (daysPassed >= 15) {
            console.log(`[ChatbotEngine] ⏳ 15-day timeout reached for card ${cardRef.id}. Forcing reset.`);
            isTimeoutReset = true;
        }
    }
    
    const isReset = isExplicitReset || isTimeoutReset;
    const isMenu = /^(menu|opciones|ayuda|help)/i.test(normalizedInput);
    const isStop = /^(detener|stop|salir|chau|adios)/i.test(normalizedInput);
    const isStartTrigger = /^(hola|hi|buenas|inicio|start|buen(as)?\s*(dias|tardes|noches)|que\s*tal|saludos)/i.test(normalizedInput);

    // If the bot is waiting for an answer, greetings are part of the reply — not a new session.
    const wasWaitingForInput = !!cardData.botState?.waitingForInput;
    const shouldApplyStartTrigger = isStartTrigger && !wasWaitingForInput;
    
    const isCommand = isReset || isMenu || isStop;

    const sessionVars = {
        nombre: (isReset || shouldApplyStartTrigger) ? 'Usuario' : (cardData.contactName || 'Usuario'),
        name: (isReset || shouldApplyStartTrigger) ? 'Usuario' : (cardData.contactName || 'Usuario'),
        first_name: ((isReset || shouldApplyStartTrigger) ? 'Usuario' : (cardData.contactName || 'Usuario')).split(' ')[0],
        ...(cardData.customFields || {}),
        ...(cardData.variables || {})
    };

    const cleanInput = (raw: string, varName: string): string => {
        const val = raw.trim();
        if (varName.toLowerCase().includes('mail') || varName.toLowerCase().includes('correo')) {
            const matches = val.match(/[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*/g);
            return matches ? matches[0] : val;
        }
        if (/nombre|name|cli/i.test(varName)) {
            let cleaned = val;
            const patterns = [
                /me llamo\s+/i, /mi nombre es\s+/i, /soy\s+/i, /mucho gusto\s+/i, 
                /hola\s+/i, /encantado\s+/i, /un placer\s+/i, /saludos\s+/i,
                /que tal\s+/i, /buenas\s+/i, /buenos dias\s+/i, /buenas tardes\s+/i,
                /buenas noches\s+/i, /por aqui\s+/i, /llaman\s+/i
            ];
            patterns.forEach(p => cleaned = cleaned.replace(new RegExp(p, 'gi'), ''));
            return cleaned.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ').trim();
        }
        return val;
    };

    // --- B. MASTER BYPASS (Reset/Trigger Override) ---
    // Never treat greetings as a restart while waiting for user input (prevents question loops).
    if (isReset || isMenu || shouldApplyStartTrigger) {
        console.log(`[ChatbotEngine] 🧹 Master Bypass [${isReset ? 'RESET' : isMenu ? 'MENU' : 'START'}] for card ${cardRef.id}`);
        
        // Atomic wipe + Status reset (Rule 4: Root Isolation)
        const resetPayload: any = {
            'botState.status': 'active',
            'botState.waitingForInput': false,
            'botState.currentNodeId': null,
        };

        // Only wipe captured variables on explicit hard reset — not on "hola" to start.
        if (isReset) {
            resetPayload.customFields = {};
            resetPayload['botState.messageQueue'] = [];
            resetPayload['botState.lastProcessedMessageId'] = null;
        }

        await cardRef.update(resetPayload);
        
        // Sync local cardData for current cycle execution
        cardData.botState = { ...(cardData.botState || {}), status: 'active', waitingForInput: false, currentNodeId: null };
        if (isReset) {
            cardData.customFields = {};
        }
        
        if (isReset) {
            if (isExplicitReset) {
                const resetText = "🔄 Reinicio completado. Por favor, envíanos un mensaje para empezar de nuevo.";
                await dispatchMessage(resetText);
                await appendAgentMessage({ text: resetText, type: 'text', messageId: `bot_sys_${Date.now()}` });
                
                // Detenemos la ejecución aquí para que el bot ESPERE un nuevo mensaje
                // antes de iniciar el flujo principal nuevamente.
                return;
            } else {
                const timeoutText = "⏳ Por inactividad prolongada, hemos reiniciado la conversación.";
                await dispatchMessage(timeoutText);
                await appendAgentMessage({ text: timeoutText, type: 'text', messageId: `bot_sys_${Date.now()}` });
                // No retornamos. Dejamos que el motor inicie el flujo principal automáticamente con este nuevo mensaje.
            }
        }

        if (isMenu || (isReset && !isStartTrigger)) {
            // If it's a menu or a reset (without a specific greeting like 'hola'), 
            // we ensure the engine restarts by setting shouldRestart to true below.
        } else if (!isStartTrigger && !isReset) {
            // If it's not a restart trigger, we might want to stop here (e.g. for simple commands)
            // But for Roosevelt, we usually want the flow to start.
        }
    }

    // cardData.botState is the live source of truth (updated by Master Bypass above if needed)


    // --- C. FLOW RESOLUTION (Rule 4: Root Isolation) ---
    const botsRef = db.collection(`${entityPath}/chatbots`);
    const botsSnapshot = await botsRef.where('isActive', 'in', [true, 'true']).get();
    const allActiveBots = botsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

    if (allActiveBots.length === 0) {
        console.log(`[ChatbotEngine] ⚠️ No active bots found for entity ${entityId}`);
        return;
    }

    // Filter and score bots by platform relevance
    const platformBots = allActiveBots.map(bot => {
        const targets = (bot.targetPlatforms || []).map((t: string) => t.toLowerCase().trim());
        let score = 0;
        
        // Match platform case-insensitive and trimmed
        const currentPlatform = platform.toLowerCase().trim();
        
        // Robust matching for common abbreviations
        const aliases: Record<string, string[]> = {
            'whatsapp': ['wa', 'wpp', 'whatsapp cloud'],
            'instagram': ['ig', 'insta'],
            'messenger': ['fb', 'facebook', 'msg'],
            'telegram': ['tg', 'tele'],
            'x_twitter': ['x', 'twitter'],
            'x': ['x_twitter', 'twitter'],
        };

        const currentAliases = aliases[currentPlatform] || [];
        const hasMatch = targets.some((t: string) => t === currentPlatform || currentAliases.includes(t));

        if (hasMatch) {
            score = 10; // Explicit match (High Priority)
        } else if (currentPlatform === 'gmail') {
            score = 0; // STRICT MATCH REQUIRED: Gmail should never be targeted by a global/wildcard bot
        } else if (targets.length === 0 || targets.includes('*') || targets.includes('all')) {
            score = 5;  // Global Match (Medium Priority) for other platforms
        } else {
            score = 1; // Fallback
        }
        
        return { ...bot, _score: score };
    }).filter(bot => bot._score > 0);

    if (platformBots.length === 0) {
        console.log(`[ChatbotEngine] ⚠️ No matching bots found for platform ${platform} on entity ${entityId}. Active targets:`, allActiveBots.map(b => b.targetPlatforms));
        return;
    }

    // Sort by: 1. Score (Specificity) | 2. Recency
    platformBots.sort((a, b) => {
        if (b._score !== a._score) return b._score - a._score;
        return (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0);
    });

    const botData = platformBots[0];
    console.log(`[ChatbotEngine] 🤖 Selected Bot: "${botData.name}" (Score: ${botData._score}) for ${platform}`);
    const flow = botData.flow || { nodes: [], edges: [] };

    const replaceVars = (val: string, overlay: any = {}) => {
        if (!val) return '';
        const context: any = { ...sessionVars, ...overlay };
        return val.replace(/\{\{?(\w+)\}?}/g, (match, key) => {
            return context[key] !== undefined ? String(context[key]) : match;
        });
    };

    // --- INNER EXECUTION LOOP ---
    // CRITICAL: Read bState AFTER Master Bypass updates cardData.botState in memory
    // so that waitingForInput reflects the current state of this execution cycle.
    let currentNodeId: string | null = cardData.botState?.currentNodeId || null;
    let waitingForInput = cardData.botState?.waitingForInput || false;

    // FIX: Only restart if NOT explicitly waiting for user input.
    // If the flow is marked as 'completed', DO NOT restart automatically.
    // It must only restart if the user explicitly types 'reiniciar' (isReset = true).
    const shouldRestart = (isReset || isMenu)
        ? true
        : (!waitingForInput && cardData.botState?.status !== 'completed' && (!currentNodeId || cardData.botState?.status === 'inactive' || !cardData.botState?.status));

    // Handle incoming input for current node
    if (waitingForInput && currentNodeId) {
        // AGNOSTIC RULE: Do not allow the same message that triggered the start/reset to be captured as an input
        // This prevents capturing "Reiniciar" or "Hola" as answers to questions.
        // MOD: Solo bloqueamos si es un Reset explícito o si NO estamos esperando entrada (flujo inicial).
        // Si estamos esperando entrada (waitingForInput), permitimos que pase para que el 'cleanInput' haga su trabajo.
        if (isReset || shouldApplyStartTrigger) {
            console.log(`[ChatbotEngine] 🛡️ Trigger message [${isReset?'RESET':'START'}] blocked from captureInputNode to prevent auto-fill.`);
        } else {
            const node = flow.nodes.find((n: any) => n.id === currentNodeId);
            if (node?.type === 'captureInputNode') {
                const varName = node.data?.variableName || 'input';
                const inputType = node.data?.inputType || 'text';
                const validationRegex = node.data?.validationRegex;
                const errorMessage = node.data?.errorMessage || 'Formato inválido. Por favor intenta de nuevo.';
                
                // 1. ROBUST TYPE DETECTION
                let extracted = text.trim();
                const isEmail = inputType === 'email' || /email|mail|correo|direcc/i.test(varName);
                const isName = (inputType === 'text' || !inputType) && /nombre|name|cli/i.test(varName);

                if (isEmail) {
                    extracted = cleanInput(text, 'email');
                } else if (isName) {
                    extracted = cleanInput(text, 'nombre');
                }

                // 2. VALIDATION (Omnichannel Robust)
                let isValid = !!extracted;

                // SPECIAL RULE: If it's an email type, ensure it looks like an email at minimum
                if (isEmail && isValid) {
                    const basicEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (!basicEmailRegex.test(extracted)) {
                        console.log(`[ChatbotEngine] ⚠️ Basic Email validation failed for: ${extracted}`);
                        isValid = false;
                    }
                }

                // RULE: Regex Validation (if defined in node)
                if (isValid && validationRegex) {
                    try {
                        const regex = new RegExp(validationRegex, 'i');
                        isValid = regex.test(extracted);
                    } catch (e) {
                        console.error(`[ChatbotEngine] ❌ Invalid Regex in node ${node.id}:`, validationRegex);
                    }
                }

                if (!isValid) {
                    console.log(`[ChatbotEngine] ⚠️ Validation failed for ${varName}: "${extracted}"`);
                    const errorContent = replaceVars(errorMessage);
                    await dispatchMessage(errorContent);
                    await appendAgentMessage({
                        text: errorContent,
                        type: 'text',
                        messageId: `bot_validation_${Date.now()}`
                    });
                    return;
                }

                // 3. SUCCESS HANDLING
                console.log(`[ChatbotEngine] ✅ Captured & Validated ${varName}: ${extracted}`);
                
                if (isName) {
                    sessionVars.nombre = extracted;
                    sessionVars.name = extracted;
                }
                sessionVars[varName] = extracted;

                // Find next node (Universal Connector)
                const next = resolveDefaultNextEdge(flow.edges, node.id);
                const nextId = next?.target || null;

                const updatePayload: any = {
                    [`customFields.${varName}`]: extracted,
                    'botState.waitingForInput': false,
                    'botState.currentNodeId': nextId,
                };
                await cardRef.update(updatePayload);

                currentNodeId = nextId;
            } else if (node?.type === 'quickReplyNode') {
                const buttons = sanitizeFlowButtons(node.data?.buttons || []);
                const resolution = resolveQuickReplyEdge(flow.edges, node.id, buttons, text);

                if (resolution.invalid) {
                    console.log(`[ChatbotEngine] ⚠️ Invalid quick-reply selection for node ${node.id}: "${text}"`);
                    const errorContent = 'Por favor, selecciona una de las opciones válidas del menú para continuar.';
                    await dispatchMessage(errorContent);
                    await appendAgentMessage({
                        text: errorContent,
                        type: 'text',
                        messageId: `bot_validation_${Date.now()}`
                    });
                    return;
                }

                if (resolution.missingEdge) {
                    console.error(`[ChatbotEngine] ⚠️ No edge matched for quick-reply on node ${node.id} (input: "${text}"). Trying default exit.`);
                    const fallback = resolveDefaultNextEdge(flow.edges, node.id);
                    if (!fallback) {
                        const errorContent = 'Por favor, selecciona una de las opciones del mensaje anterior para continuar.';
                        await dispatchMessage(errorContent);
                        await appendAgentMessage({
                            text: errorContent,
                            type: 'text',
                            messageId: `bot_config_${Date.now()}`
                        });
                        return;
                    }
                    currentNodeId = fallback.target;
                } else {
                    currentNodeId = resolution.edge?.target || null;
                }
                await cardRef.update({ 'botState.waitingForInput': false });
            } else if (node?.type === 'listMessageNode') {
                const sections = node.data?.sections || [];
                const resolution = resolveListMessageEdge(flow.edges, node.id, sections, text);

                if (resolution.invalid) {
                    console.log(`[ChatbotEngine] ⚠️ Invalid list selection for node ${node.id}: "${text}"`);
                    const errorContent = 'Por favor, selecciona una de las opciones válidas del menú para continuar.';
                    await dispatchMessage(errorContent);
                    await appendAgentMessage({
                        text: errorContent,
                        type: 'text',
                        messageId: `bot_validation_${Date.now()}`
                    });
                    return;
                }

                if (resolution.missingEdge) {
                    console.error(`[ChatbotEngine] ⚠️ No edge matched for list on node ${node.id} (input: "${text}"). Trying default exit.`);
                    const fallback = resolveDefaultNextEdge(flow.edges, node.id);
                    if (!fallback) {
                        const errorContent = 'Por favor, selecciona una de las opciones del menú para continuar.';
                        await dispatchMessage(errorContent);
                        await appendAgentMessage({
                            text: errorContent,
                            type: 'text',
                            messageId: `bot_config_${Date.now()}`
                        });
                        return;
                    }
                    currentNodeId = fallback.target;
                } else {
                    currentNodeId = resolution.edge?.target || null;
                }
                await cardRef.update({ 'botState.waitingForInput': false });
            } else {
                const edge = resolveDefaultNextEdge(flow.edges, node?.id || '');
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

    // If we're already waiting on a prompt node, do NOT re-send it in the forward loop.
    const preLoopSnap = await cardRef.get();
    const preLoopState = preLoopSnap.data()?.botState || {};
    if (preLoopState.waitingForInput && preLoopState.currentNodeId) {
        const waitingNode = flow.nodes.find((n: any) => n.id === preLoopState.currentNodeId);
        const isWaitNode = ['captureInputNode', 'quickReplyNode', 'listMessageNode'].includes(waitingNode?.type || '');
        if (isWaitNode && String(preLoopState.currentNodeId) === String(currentNodeId)) {
            console.log(`[ChatbotEngine] 🛑 Already waiting on node ${currentNodeId} — skipping duplicate prompt send.`);
            return;
        }
    }

    // Node-by-Node Forward Execution
    let executionCount = 0;
    while (currentNodeId && executionCount < 15) {
        executionCount++;
        const node = flow.nodes.find((n: any) => n.id === currentNodeId);
        if (!node) {
            console.log(`[ChatbotEngine] 🛑 Node not found: ${currentNodeId}. Attempting default edge recovery.`);
            const orphanEdge = resolveDefaultNextEdge(flow.edges, currentNodeId);
            currentNodeId = orphanEdge?.target || null;
            if (!currentNodeId) break;
            continue;
        }

        console.log(`[ChatbotEngine] ⚙️ Executing Node Type: ${node.type} (${node.id})`);
        
        // Skip start nodes in the middle of execution
        if (node.type === 'start' || node.type === 'startNode') {
            const edge = resolveDefaultNextEdge(flow.edges, node.id);
            currentNodeId = edge ? edge.target : null;
            continue;
        }

        await cardRef.update({ 'botState.currentNodeId': node.id, 'botState.lastStep': `${node.type}` });

        // 1. TEXT MESSAGE
        if (node.type === 'textMessageNode') {
            const content = replaceVars(node.data?.content || node.data?.text || 'Hola');
            await dispatchMessage(content);
            if (content.trim()) {
                await appendAgentMessage({
                    text: content,
                    type: 'text',
                    messageId: `bot_${Date.now()}`
                });
            }
            const edge = resolveDefaultNextEdge(flow.edges, node.id);
            currentNodeId = edge ? edge.target : null;
            continue;
        }

        // 2. MEDIA MESSAGE
        console.log(`[ChatbotEngine] 🎯 Checking Node: ${node.id} | Type: ${node.type}`);
        if (node.type === 'mediaMessageNode' || (node.type as string) === 'multimedia') {
            const rawUrl = node.data?.url || node.data?.attachment || node.data?.link || node.data?.content || '';
            const url = replaceVars(rawUrl);
            
            // For caption, try caption, then body, then text, then content (only if content wasn't the URL)
            let rawCaption = node.data?.caption || node.data?.body || node.data?.text || '';
            if (!rawCaption && node.data?.content && node.data?.content !== rawUrl) {
                rawCaption = node.data.content;
            }
            const caption = replaceVars(rawCaption);

            console.log(`[ChatbotEngine] 🖼️ Media Node Detected: URL=${url.substring(0, 30)}... Caption=${caption.substring(0, 20)}`);
            
            if (url && url.startsWith('http')) {
                // Determine type based on extension if possible, default to image
                const type = url.match(/\.(mp4|mov|avi|webm)$/i) ? 'video' : (url.match(/\.(mp3|ogg|wav|m4a|opus)$/i) ? 'audio' : 'image');
                
                const sendResult = await dispatchMessage(caption, { 
                    type, 
                    url: url, 
                    filename: node.data?.filename 
                });
                console.log(`[ChatbotEngine] 📦 Dispatch Result:`, JSON.stringify(sendResult));

                await appendAgentMessage({
                    text: caption || '',
                    messageId: `bot_media_${Date.now()}`,
                    type: 'media',
                    fileUrl: url,
                    fileType: type === 'image' ? 'image/*' : type === 'video' ? 'video/*' : type === 'audio' ? 'audio/*' : 'application/octet-stream',
                    fileName: node.data?.filename || null,
                    metadata: {
                        url,
                        filename: node.data?.filename || null
                    }
                });

                // Crucial delay to allow media to be ingested before next node
                await sleep(2000);
            } else if (caption) {
                // FALLBACK: If URL is missing or invalid but we have text, send text so the flow doesn't look dead
                console.warn(`[ChatbotEngine] ⚠️ Media URL missing or invalid "${url}". Sending caption as text fallback.`);
                await dispatchMessage(caption);
                await appendAgentMessage({
                    text: caption,
                    type: 'text',
                    messageId: `bot_fallback_${Date.now()}`
                });
            }

            const edge = resolveDefaultNextEdge(flow.edges, node.id);
            currentNodeId = edge ? edge.target : null;
            continue;
        }

        // 3. LIST MESSAGE
        if (node.type === 'listMessageNode') {
            const body = replaceVars(node.data?.body || node.data?.text || 'Selecciona una opción:');
            const sections = buildWhatsAppListSections(node.data?.sections || []);

            await dispatchMessage(body, { type: 'list', button: node.data?.buttonText || 'Ver opciones', sections });
            
            await cardRef.update({
                'botState.status': 'active',
                'botState.waitingForInput': true,
                'botState.currentNodeId': node.id,
                'botState.lastWaitStartedAt': admin.firestore.FieldValue.serverTimestamp(),
                messages: admin.firestore.FieldValue.arrayUnion({
                    sender: 'agent',
                    text: body,
                    platform,
                    timestamp: new Date(),
                    messageId: `bot_list_${Date.now()}`,
                    type: 'list',
                    metadata: {
                        buttonText: node.data?.buttonText || 'Ver opciones',
                        sections
                    }
                })
            });
            return;
        }

        // 4. CAPTURE / QUICK REPLY (Wait nodes)
        if (node.type === 'captureInputNode' || node.type === 'quickReplyNode') {
            const content = replaceVars(node.data?.content || node.data?.text || node.data?.bodyText || '');
            const buttons = buildWhatsAppQuickReplyButtons(node.data?.buttons || []);
            const isQuickReply = node.type === 'quickReplyNode';

            if (isQuickReply && buttons.length > 0) {
                const prompt = content.trim() || 'Selecciona una opción:';
                await dispatchMessage(prompt, { type: 'quick_reply', buttons });
            } else if (content.trim()) {
                await dispatchMessage(content, {});
            } else if (node.type === 'captureInputNode') {
                const prompt = 'Por favor, escribe tu respuesta:';
                await dispatchMessage(prompt, {});
            }

            const agentText = isQuickReply && buttons.length > 0
                ? (content.trim() || 'Selecciona una opción:')
                : (content.trim() || (node.type === 'captureInputNode' ? 'Por favor, escribe tu respuesta:' : ''));

            const updatePayload: any = {
                'botState.status': 'active',
                'botState.waitingForInput': true,
                'botState.currentNodeId': node.id,
                'botState.variableName': node.data?.variableName || 'input',
                'botState.lastWaitStartedAt': admin.firestore.FieldValue.serverTimestamp()
            };
            
            if (agentText) {
                updatePayload.messages = admin.firestore.FieldValue.arrayUnion({
                    sender: 'agent', 
                    text: agentText, 
                    platform, 
                    timestamp: new Date(), 
                    messageId: `bot_wait_${Date.now()}`,
                    type: isQuickReply ? 'buttons' : 'text',
                    ...(isQuickReply ? {
                        metadata: {
                            buttons: buttons.map((button: any) => ({
                                text: button.reply?.title || '',
                                id: button.reply?.id || ''
                            }))
                        }
                    } : {})
                });
            }
            
            await cardRef.update(updatePayload);
            return; // EXIT loop, wait for user
        }

        // 4. LOGIC NODES (Set Variable, Webhook, etc.) - DEFAULT SKIP & ADVANCE
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
            currentNodeId = target
                || flow.edges.find((e: any) => e.source === node.id && e.sourceHandle === 'else')?.target
                || resolveDefaultNextEdge(flow.edges, node.id)?.target
                || null;
            continue;
        }

        if (node.type === 'setVariableNode') {
            await cardRef.update({ [`customFields.${node.data?.variableName}`]: node.data?.value });
            const edge = resolveDefaultNextEdge(flow.edges, node.id);
            currentNodeId = edge ? edge.target : null;
            continue;
        }

        if (node.type === 'endNode') {
            await cardRef.update({ 'botState.status': 'completed', 'botState.waitingForInput': false });
            return;
        }

        // DEFAULT: Just follow the edge if node is unhandled
        console.log(`[ChatbotEngine] ⏩ Skipping logic/unknown node type: ${node.type}`);
        const edge = resolveDefaultNextEdge(flow.edges, node.id);
        currentNodeId = edge ? edge.target : null;
        if (!edge) break;
    }
}
