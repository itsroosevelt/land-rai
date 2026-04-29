import * as admin from 'firebase-admin';
import { db } from './firebase-admin';

export interface ChatbotContext {
    userId: string;
    entityId: string;
    groupId: string;
    cardId: string;
    platform: string;
    from: string;
    text: string;
    messageId?: string;
}

export async function processChatbotFlow({ userId, entityId, groupId, cardId, platform, from, text, messageId }: ChatbotContext) {
    console.log(`[ChatbotEngine] ⚡️ ENGINE ACTIVATED | Card: ${cardId} | Platform: ${platform}`);
    const entityPath = `users/${userId}/entities/${entityId}`;
    const cardRef = db.doc(`${entityPath}/kanban-groups/${groupId}/cards/${cardId}`);
    
    try {
        // 1. Acquire Lock & Steal Queue Atomically
        const startData = await db.runTransaction(async (transaction: any) => {
            const snap = await transaction.get(cardRef);
            if (!snap.exists) return null;
            const data = snap.data() || {};
            const bState = data.botState || {};

            // DEDUP
            if (messageId && bState.lastProcessedMessageId === messageId) {
                 return { skip: true };
            }

            // LOCK check
            if (data.botLock) {
                const lockTime = data.botLock.toDate?.() || new Date(data.botLock);
                const diff = (Date.now() - lockTime.getTime()) / 1000;
                if (diff < 15) return null; 
            }

            const updates: any = { 
                botLock: admin.firestore.FieldValue.serverTimestamp(),
                'botState.status': 'active',
                'botState.messageQueue': [] // CLEAR QUEUE ATOMICALLY
            };
            if (messageId) updates['botState.lastProcessedMessageId'] = messageId;
            
            transaction.update(cardRef, updates);

            return { ...data, id: cardId, messageQueue: bState.messageQueue || [] };
        });

        if (!startData || (startData as any).skip) return;
        const queue = (startData as any).messageQueue || [];

        // 2. Flow Discovery
        const botsSnap = await db.collection(`${entityPath}/chatbots`)
            .where('isActive', 'in', [true, 'true'])
            .get();
        
        if (botsSnap.empty) return;
        const botData = botsSnap.docs[0].data();
        const flow = botData.flow;
        if (!flow) return;

        // 3. Sequential Execution
        let currentCardState = startData;

        for (const currentMsg of queue) {
            try {
                const res = await runEngineCycle(currentCardState, currentMsg, entityPath, entityId, userId, flow);
                
                // Update Local State for next message
                let newVariables = { ...(currentCardState.variables || {}), ...res.newVariables };
                if (res.newVariables.__RESTART__) {
                    newVariables = {};
                }

                currentCardState = {
                    ...currentCardState,
                    variables: newVariables,
                    botState: {
                        ...currentCardState.botState,
                        ...res.nextState
                    }
                };

                // Persist Progress
                await cardRef.update({
                    'botState.currentNodeId': res.nextState.currentNodeId,
                    'botState.waitingForInput': res.nextState.waitingForInput,
                    'botState.variableName': res.nextState.variableName,
                    'botState.justRestarted': res.nextState.justRestarted,
                    'variables': newVariables
                });

                if (res.nextState.waitingForInput) break; 

            } catch (err: any) {
                console.error(`[ChatbotEngine] ❌ Cycle Failure:`, err.message);
                break;
            }
        }

    } catch (err: any) {
        console.error(`[ChatbotEngine] ❌ Fatal Error:`, err.message);
    } finally {
        try {
            await cardRef.update({ botLock: admin.firestore.FieldValue.delete() });
        } catch (e) {}
    }
}

async function runEngineCycle(cardData: any, msg: any, entityPath: string, entityId: string, userId: string, flow: any) {
    let cycleText = (msg.text || '').trim();
    const platform = (cardData.channel || cardData.source || cardData.primary_channel || 'telegram').toLowerCase();
    
    const msgTextLower = cycleText.toLowerCase().replace(/[?¿!¡.]/g, '').trim();
    const restartKeywords = ['clear', 'reiniciar', 'reincio', 'reinicio', 'reset', 'hola', 'inicio', 'comenzar', 'start'];
    const isRestart = msgTextLower.startsWith('/') || restartKeywords.some(kw => msgTextLower === kw);

    const accumulated: any = {
        nextState: {
            currentNodeId: cardData.botState?.currentNodeId || '1',
            waitingForInput: cardData.botState?.waitingForInput || false,
            variableName: cardData.botState?.variableName || null,
            justRestarted: cardData.botState?.justRestarted || false
        },
        newMessages: [],
        newVariables: {}
    };

    const dispatchMessage = async (content: string, options: any = {}) => {
        const providers = require('./sendProviders');
        const cleanPlatform = platform.toLowerCase();
        
        if (cleanPlatform === 'telegram') {
            await providers.sendTelegramMessage(userId, entityId, cardData.telegramChatId, content, options);
        } else if (cleanPlatform === 'whatsapp') {
            await providers.sendWhatsAppMessage(msg.from, content, { ...options, userId, entityId });
        } else if (cleanPlatform === 'instagram' || cleanPlatform === 'messenger') {
            await providers.sendMetaMessage(msg.from, content, { 
                ...options, 
                userId, 
                entityId, 
                provider: cleanPlatform as 'instagram' | 'messenger' 
            });
        }
    };

    const replaceVars = (str: string) => {
        let out = str;
        const vars = { ...(cardData.variables || {}), ...accumulated.newVariables };
        Object.entries(vars).forEach(([k, v]) => {
            out = out.replace(new RegExp(`{{${k}}}`, 'g'), String(v));
        });
        return out;
    };

    if (isRestart) {
        accumulated.nextState.currentNodeId = '1';
        accumulated.nextState.waitingForInput = false;
        accumulated.nextState.justRestarted = true;
        accumulated.newVariables = { __RESTART__: true };
        cycleText = ''; 
    }

    let currentNodeId = accumulated.nextState.currentNodeId;
    let iterations = 0;

    while (currentNodeId && iterations < 20) {
        iterations++;
        const node = flow.nodes.find((n: any) => n.id === currentNodeId);
        if (!node) break;

        if (node.type === 'startNode') {
            const edge = flow.edges.find((e: any) => e.source === node.id);
            currentNodeId = edge ? edge.target : null;
            continue;
        }

        if (node.type === 'textMessageNode') {
            const content = replaceVars(node.data?.content || node.data?.text || 'Hola');
            await dispatchMessage(content);
            const edge = flow.edges.find((e: any) => e.source === node.id);
            currentNodeId = edge ? edge.target : null;
            accumulated.nextState.justRestarted = false;
            continue;
        }

        if (node.type === 'conditionNode') {
            const { variableName, operator, value } = node.data;
            const currentVal = String((cardData.variables || {})[variableName] || accumulated.newVariables[variableName] || '');
            const targetVal = String(value || '');
            
            let result = false;
            if (operator === 'equals') result = currentVal === targetVal;
            else if (operator === 'contains') result = currentVal.includes(targetVal);
            else if (operator === 'greater') result = Number(currentVal) > Number(targetVal);
            else if (operator === 'less') result = Number(currentVal) < Number(targetVal);

            const edge = flow.edges.find((e: any) => e.source === node.id && String(e.sourceHandle) === String(result));
            currentNodeId = edge ? edge.target : null;
            continue;
        }

        if (node.type === 'assignVariableNode') {
            const { variableName, value } = node.data;
            accumulated.newVariables[variableName] = replaceVars(value);
            const edge = flow.edges.find((e: any) => e.source === node.id);
            currentNodeId = edge ? edge.target : null;
            continue;
        }

        if (node.type === 'delayNode') {
            const seconds = Number(node.data?.seconds || 1);
            await new Promise(resolve => setTimeout(resolve, seconds * 1000));
            const edge = flow.edges.find((e: any) => e.source === node.id);
            currentNodeId = edge ? edge.target : null;
            continue;
        }

        if (node.type === 'captureInputNode' || node.type === 'quickReplyNode') {
            const varName = node.data?.variableName || 'last_input';
            const inputType = node.data?.inputType || 'text';
            const regexStr = node.data?.validationRegex;
            const errorMsg = node.data?.errorMessage || "Formato inválido. Por favor intenta de nuevo.";
            const buttons = node.data?.buttons || [];
            
            if (cycleText && !isRestart) {
                let isValid = true;
                let matchedHandle = null;

                if (node.type === 'quickReplyNode') {
                    const match = buttons.find((b: any) => {
                        const label = (typeof b === 'object' ? (b.title || b.reply?.title) : b)?.toLowerCase().trim();
                        const id = (typeof b === 'object' ? (b.id || b.payload || b.title || b.reply?.id) : b)?.toLowerCase().trim();
                        return cycleText.toLowerCase().trim() === label || cycleText.toLowerCase().trim() === id;
                    });
                    if (match) {
                        matchedHandle = typeof match === 'object' ? (match.id || match.payload || match.title || match.reply?.id) : match;
                        cycleText = typeof match === 'object' ? (match.title || match.reply?.title) : match;
                    }
                }

                if (isValid) {
                    if (inputType === 'email') isValid = cycleText.includes('@') && cycleText.includes('.');
                    else if (inputType === 'phone') isValid = /^\+?[1-9]\d{7,14}$/.test(cycleText.replace(/[\s-]/g, ''));
                    else if (inputType === 'number') isValid = !isNaN(Number(cycleText));
                    else if (regexStr) {
                        try { isValid = new RegExp(regexStr).test(cycleText); } catch (e) {}
                    }
                }

                if (!isValid) {
                    await dispatchMessage(errorMsg);
                    accumulated.nextState.waitingForInput = true;
                    accumulated.nextState.currentNodeId = node.id;
                    return accumulated;
                }

                accumulated.newVariables[varName] = cycleText;
                let edge = matchedHandle ? flow.edges.find((e: any) => e.source === node.id && String(e.sourceHandle) === String(matchedHandle)) : null;
                if (!edge) edge = flow.edges.find((e: any) => e.source === node.id);

                currentNodeId = edge ? edge.target : null;
                accumulated.nextState.waitingForInput = false;
                accumulated.nextState.justRestarted = false;
                cycleText = ''; 
                continue;
            } else {
                const prompt = replaceVars(node.data?.content || node.data?.bodyText || node.data?.text || '');
                const opts: any = {};
                if (node.type === 'quickReplyNode' && buttons.length > 0) {
                    opts.type = 'quick_reply';
                    opts.buttons = buttons.map((b: any) => {
                        const isObj = typeof b === 'object' && b !== null;
                        const title = isObj ? (b.title || b.reply?.title) : b;
                        const id = isObj ? (b.id || b.payload || b.title || b.reply?.id) : b;
                        return { type: 'reply', reply: { id, title } };
                    });
                }
                if (prompt || opts.buttons) await dispatchMessage(prompt, opts);
                accumulated.nextState.waitingForInput = true;
                accumulated.nextState.currentNodeId = node.id;
                return accumulated;
            }
        }
        
        // Default jump
        const edge = flow.edges.find((e: any) => e.source === node.id);
        currentNodeId = edge ? edge.target : null;
    }

    return accumulated;
}
