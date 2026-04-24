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

            const normInput = (text || '').trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const isPriorityCommand = /^(reinicia|reinicio|reset|clear|limpiar|menu|opciones|ayuda|help|inicio|start)/i.test(normInput);

            if (isPriorityCommand && data.botLock) {
                console.log(`[ChatbotEngine] 🔓 Priority command breaking existing lock for ${cardId}`);
            }

            // DEDUP: If this exact message ID was just processed, skip queueing
            if (messageId && bState.lastProcessedMessageId === messageId) return false;

            // LOCK CHECK: If still locked (not a priority command), check timeout
            if (data.botLock && !isPriorityCommand) {
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
    const isReset = /^(reinicia(r| todo ahora)?|reinicio|reset|clear|limpiar)/i.test(normalizedInput);
    const isMenu = /^(menu|opciones|ayuda|help)/i.test(normalizedInput);
    const isStop = /^(detener|stop|salir|chau|adios)/i.test(normalizedInput);
    const isStartTrigger = /^(hola|hi|buenas|inicio|start|buen(as)?\s*(dias|tardes|noches)|que\s*tal|saludos)/i.test(normalizedInput);
    
    const isCommand = isReset || isMenu || isStop;

    const sessionVars = {
        nombre: (isStartTrigger || isReset) ? 'Usuario' : (cardData.contactName || 'Usuario'),
        name: (isStartTrigger || isReset) ? 'Usuario' : (cardData.contactName || 'Usuario'),
        first_name: ((isStartTrigger || isReset) ? 'Usuario' : (cardData.contactName || 'Usuario')).split(' ')[0],
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
            [/me llamo /i, /mi nombre es /i, /soy /i, /mucho gusto/i, /hola/i].forEach(p => cleaned = cleaned.replace(p, ''));
            return cleaned.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ').trim();
        }
        return val;
    };

    // --- B. MASTER BYPASS (Reset/Trigger Override) ---
    if (isReset || isMenu || isStartTrigger) {
        console.log(`[ChatbotEngine] 🧹 Master Bypass [${isReset ? 'RESET' : isMenu ? 'MENU' : 'START'}] for card ${cardRef.id}`);
        
        // Atomic wipe + Status reset (Rule 4: Root Isolation)
        const resetPayload: any = {
            'botState.status': 'active',
            'botState.waitingForInput': false,
            'botState.currentNodeId': null,
            customFields: {},
            contactName: 'Usuario'
        };

        // If it's a hard reset, we clear the queue to prevent "echoes" of previous flow messages
        if (isReset) {
            resetPayload['botState.messageQueue'] = [];
            resetPayload['botState.lastProcessedMessageId'] = null; // Allow re-processing if needed
        }

        await cardRef.update(resetPayload);
        
        // Sync local cardData for current cycle execution
        cardData.botState = { ...(cardData.botState || {}), status: 'active', waitingForInput: false, currentNodeId: null };
        cardData.customFields = {};
        cardData.contactName = 'Usuario';
        
        if (isReset) {
            const resetText = "🔄 Reinicio completado. Por favor, envíanos un mensaje para empezar de nuevo.";
            await dispatchMessage(resetText);
            await appendAgentMessage({ text: resetText, type: 'text', messageId: `bot_sys_${Date.now()}` });
            
            // Detenemos la ejecución aquí para que el bot ESPERE un nuevo mensaje
            // antes de iniciar el flujo principal nuevamente.
            return;
        }

        if (isMenu || (isReset && !isStartTrigger)) {
            // If it's a menu or a reset (without a specific greeting like 'hola'), 
            // we ensure the engine restarts by setting shouldRestart to true below.
        } else if (!isStartTrigger && !isReset) {
            // If it's not a restart trigger, we might want to stop here (e.g. for simple commands)
            // But for Roosevelt, we usually want the flow to start.
        }
    }

    let bState = cardData.botState || {};

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
        const simplifiedPlatform = currentPlatform === 'messenger' ? 'facebook' : currentPlatform;

        const hasMatch = targets.some((t: string) => 
            t === currentPlatform || 
            t === simplifiedPlatform ||
            (currentPlatform === 'facebook' && t === 'messenger')
        );

        if (hasMatch) {
            score = 10; // Explicit match (High Priority)
        } else if (currentPlatform === 'gmail') {
            score = 0; // STRIC MATCH REQUIRED
        } else if (targets.length === 0 || targets.includes('*') || targets.includes('all')) {
            score = 5;  // Global Match (Medium Priority)
        } else {
            score = 1;
        }
        
        return { ...bot, _score: score };
    }).filter(bot => bot._score > 0);

    if (platformBots.length === 0) {
        console.warn(`[ChatbotEngine] ⚠️ No matching bots found for platform ${platform} (simplified: ${platform === 'messenger' ? 'facebook' : platform}) on entity ${entityId}`);
        await cardRef.update({ 
            'botState.lastError': `Plataforma ${platform} no asignada a ningún bot activo.`,
            'botState.status': 'inactive' 
        });
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
    let currentNodeId: string | null = bState.currentNodeId || null;
    let waitingForInput = bState.waitingForInput || false;

    // FIX: If status is 'active' but we have no node (stuck) or it's 'completed', we should try to restart
    // Enhanced restart check for new cards (status undefined)
    const shouldRestart = isStartTrigger || !currentNodeId || !bState.status || bState.status === 'completed' || bState.status === 'inactive';

    // Handle incoming input for current node
    if (waitingForInput && currentNodeId) {
        // AGNOSTIC RULE: Do not allow the same message that triggered the start/reset to be captured as an input
        // This prevents capturing "Reiniciar" or "Hola" as answers to questions.
        if (isReset || isStartTrigger || (shouldRestart && !waitingForInput)) {
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
                const updatePayload: any = { [`customFields.${varName}`]: extracted, 'botState.waitingForInput': false };
                
                if (isName) {
                    updatePayload.contactName = extracted;
                    sessionVars.nombre = extracted;
                    sessionVars.name = extracted;
                }
                sessionVars[varName] = extracted;
                await cardRef.update(updatePayload);

                // Find next node (Universal Connector)
                const edges = flow.edges.filter((e: any) => e.source === node.id);
                const next = edges.find((e: any) => e.sourceHandle === 'success') 
                          || edges.find((e: any) => !e.sourceHandle || !e.sourceHandle.toLowerCase().includes('fail'))
                          || edges[0];
                
                if (next) {
                    currentNodeId = next.target;
                } else {
                    currentNodeId = null;
                }
            } else {
                // QuickReply or List Selection - HYBRID MATCHING
                const edge = flow.edges.find((e: any) => {
                    const handle = String(e.sourceHandle || '').trim().toLowerCase();
                    // Match by technical ID (handle) OR formatted text
                    return e.source === node?.id && (handle === normalizedInput || handle === text.trim().toLowerCase());
                }) || flow.edges.find((e: any) => e.source === node?.id); // Fallback to first exit
                
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
                await appendAgentMessage({
                    text: content,
                    type: 'text',
                    messageId: `bot_${Date.now()}`
                });
            }
            const edge = flow.edges.find((e: any) => e.source === node.id);
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

            const edge = flow.edges.find((e: any) => e.source === node.id);
            currentNodeId = edge ? edge.target : null;
            continue;
        }

        // 3. LIST MESSAGE
        if (node.type === 'listMessageNode') {
            const body = replaceVars(node.data?.body || node.data?.text || 'Selecciona una opción:');
            const sections = (node.data?.sections || []).map((s: any) => ({
                title: s.title || 'Opciones',
                rows: (s.rows || []).map((r: any) => ({
                    id: (r.id || r.title).substring(0, 50),
                    title: r.title.substring(0, 24),
                    description: r.description?.substring(0, 72)
                }))
            }));

            await dispatchMessage(body, { type: 'list', button: node.data?.buttonText || 'Ver opciones', sections });
            
            await cardRef.update({
                'botState.status': 'active',
                'botState.waitingForInput': true,
                'botState.currentNodeId': node.id,
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
                    sender: 'agent', 
                    text: content, 
                    platform, 
                    timestamp: new Date(), 
                    messageId: `bot_wait_${Date.now()}`,
                    type: node.type === 'quickReplyNode' ? 'buttons' : 'text',
                    ...(node.type === 'quickReplyNode' ? {
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

        // DEFAULT: Just follow the edge if node is unhandled
        console.log(`[ChatbotEngine] ⏩ Skipping logic/unknown node type: ${node.type}`);
        const edge = flow.edges.find((e: any) => e.source === node.id);
        currentNodeId = edge ? edge.target : null;
        if (!edge) break; // End of flow if no way forward
    }
}
