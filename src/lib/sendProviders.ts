import axios from 'axios';
import { db, admin } from './firebase-admin'; // Use admin to fetch tokens on server
import { getGmailAccessToken } from './googleAuth';

// --- Meta (Instagram & Messenger) ---

export interface MetaSendOptions {
    type?: 'text' | 'image' | 'quick_reply' | 'media' | 'video' | 'audio' | 'document' | 'list';
    mediaType?: string;
    userId?: string;
    entityId?: string;
    provider?: 'messenger' | 'instagram';
    buttons?: any[];
    sections?: any[];
    url?: string;
}

export async function sendMetaMessage(
    recipientId: string,
    text: string,
    options: MetaSendOptions | string = {}
): Promise<any> {
    // If text is empty, it's okay IF it's a media message (image, video, audio, document)
    const META_MEDIA_TYPES = ['image', 'media', 'video', 'audio', 'document'];
    const isMedia = (typeof options !== 'string') && (
        META_MEDIA_TYPES.includes(options.type || '') || META_MEDIA_TYPES.includes(options.mediaType || '')
    );
    if (!text && !isMedia) return;

    // Fallback for list type from WhatsApp into text for Messenger
    if (typeof options !== 'string' && options.type === 'list' && options.sections) {
        let listText = '\n\n';
        options.sections.forEach((section: any) => {
            if (section.title && section.title !== 'Opciones') {
                listText += `*${section.title}*\n`;
            }
            (section.rows || []).forEach((row: any) => {
                listText += `- ${row.title}\n`;
            });
        });
        text = (text || '') + listText;
    }

    let token = process.env.META_PAGE_ACCESS_TOKEN;

    // Backwards compatibility with the old signature
    if (typeof options === 'string') {
        token = options;
        options = {};
    }

    let targetNodeId: string | undefined;
    if (options.userId && options.entityId && options.provider) {
        try {
            const configPath = `users/${options.userId}/entities/${options.entityId}/integrations/${options.provider}`;
            const configDoc = await db.doc(configPath).get();
            if (configDoc.exists) {
                const data = configDoc.data();
                // SUPPORT MULTIPLE TOKEN KEYS (Agnosticism Rule)
                const resolvedToken = data?.accessToken || data?.pageAccessToken || data?.token;
                if (resolvedToken) {
                    token = resolvedToken;
                    targetNodeId = options.provider === 'messenger' ? data.pageId : data.instagramId;
                    console.log(`[sendMetaMessage] 💎 Using PERMANENT TOKEN from Firestore (${options.provider})`);
                } else {
                    // EMERGENCY RESOLUTION: If doc exists but no token, try checking a generic name
                    const fallbackPath = `users/${options.userId}/entities/${options.entityId}/integrations/meta`;
                    const fallbackDoc = await db.doc(fallbackPath).get();
                    const fData = fallbackDoc.data();
                    const fToken = fData?.accessToken || fData?.token;
                    if (fToken) {
                        token = fToken;
                        targetNodeId = options.provider === 'messenger' ? fData.pageId : fData.instagramId;
                        console.log(`[sendMetaMessage] Resolved via generic 'meta' fallback for ${options.entityId}`);
                    }
                }
            }
        } catch (err) {
            console.error(`[sendMetaMessage] Error resolving config:`, err);
        }
    }

    if (!token) {
        console.error('Missing Access Token (Meta/Instagram).');
        throw new Error('Access Token is not configured.');
    }

    const endpoint = 'me';
    const apiUrl = `https://graph.facebook.com/v21.0/${endpoint}/messages?access_token=${token}`;

    const messageData: any = {
        messaging_type: 'RESPONSE',
        recipient: { id: recipientId },
        message: {}
    };

    // Determine final media type — covers image, video, audio, document
    const resolvedMediaType = (typeof options !== 'string') ? (options.mediaType || options.type || '') : '';
    const isMediaFinal = (typeof options !== 'string') && !!resolvedMediaType && META_MEDIA_TYPES.includes(resolvedMediaType);
    let mediaUrl = (typeof options !== 'string' && options.url) ? options.url : null;

    // Safety check: if mediaUrl doesn't look like a URL, don't treat it as an attachment
    if (mediaUrl && !mediaUrl.startsWith('http')) {
        mediaUrl = null;
    }

    if (isMediaFinal && mediaUrl) {
        // Map internal type to Meta attachment type ('document' → 'file' in Meta API)
        const attachmentType = resolvedMediaType === 'document' ? 'file'
            : resolvedMediaType === 'media' ? 'image'
            : resolvedMediaType;

        messageData.message = {
            attachment: {
                type: attachmentType,
                payload: {
                    url: mediaUrl,
                    is_reusable: true
                }
            }
        };

        // If there's ALSO text (caption), we send the media first, then the caption separately for Messenger reliability
        if (text && text.trim() && text !== mediaUrl) {
            try {
                // Send media-only first
                await axios.post(apiUrl, messageData);
                // Then send caption as separate text message
                const textOnlyPayload = {
                    messaging_type: 'RESPONSE',
                    recipient: { id: recipientId },
                    message: { text: text }
                };
                const textResponse = await axios.post(apiUrl, textOnlyPayload);
                return {
                    ...textResponse.data,
                    message_id: textResponse.data.message_id || textResponse.data.id,
                    sentTo: recipientId
                };
            } catch (err) {
                console.error(`[Meta Sending] Multi-part delivery failed:`, err);
                throw err;
            }
        }
    } else {
        // Fallback: If it was supposed to be media but URL is missing,
        // send the text (which might contain the link as text)
        messageData.message = { text: text || mediaUrl || 'Mensaje sin contenido' };
    }

    // --- QUICK REPLY SUPPORT (FIXES MESSENGER MISSING BUTTONS) ---
    if (options.type === 'quick_reply' && options.buttons && options.buttons.length > 0) {
        // Messenger REQUIRES text when sending quick_replies. If empty, add fallback.
        if (!messageData.message.text) {
            messageData.message.text = text || '¿Qué te gustaría hacer?';
        }

        messageData.message.quick_replies = options.buttons.map((btn: any) => {
            const b = btn.reply || btn;
            return {
                content_type: 'text',
                title: (b.title || b).substring(0, 20),
                payload: (b.id || b.title || b).substring(0, 50)
            };
        });
    }

    // Metadata for Instagram accounts is handled via targetNodeId above

    try {
        const response = await axios.post(apiUrl, messageData);

        // Success! Autoclear Error status if we have the context
        if (options.userId && options.entityId && options.provider) {
            const integrationRef = db.doc(`users/${options.userId}/entities/${options.entityId}/integrations/${options.provider}`);
            // Check status before updating to avoid unnecessary writes
            integrationRef.get().then(snap => {
                if (snap.exists && snap.data()?.status === 'Error') {
                    integrationRef.update({ status: 'Connected', lastError: null, updatedAt: admin.firestore.FieldValue.serverTimestamp() }).catch(() => {});
                }
            }).catch(() => {});
        }

        return {
            ...response.data,
            message_id: response.data.message_id || response.data.id,
            sentTo: recipientId
        };
    } catch (error: any) {
        const errorData = error.response?.data || { message: error.message };
        const detailedError = typeof errorData === 'object' ? JSON.stringify(errorData) : errorData;
        console.error('Meta API Error:', detailedError);

        // Self-documenting error in Firestore for easier debugging
        if (options.userId && options.entityId && options.provider) {
            try {
                const entityPath = `users/${options.userId}/entities/${options.entityId}`;
                
                // 1. Detect Token Death (Code 190) and mark integration as Error
                if (detailedError.includes('Code 190') || detailedError.includes('OAuthException')) {
                    const integrationRef = db.doc(`${entityPath}/integrations/${options.provider}`);
                    await integrationRef.update({
                        status: 'Error',
                        lastError: `Token expirado: ${detailedError}`,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    }).catch(() => {}); // Avoid crashing if doc missing
                }

                // 2. Find card to log error directly where user sees it
                const groupsRef = db.collection(`${entityPath}/kanban-groups`);
                const groupsSnap = await groupsRef.get();
                
                for (const groupDoc of groupsSnap.docs) {
                    const searchSnap = await groupDoc.ref.collection('cards')
                        .where(`platform_ids.${options.provider}`, '==', recipientId)
                        .get();

                    if (!searchSnap.empty) {
                        await searchSnap.docs[0].ref.update({
                            'botState.lastError': `Meta Error [${options.provider}]: ${detailedError}`,
                            'botState.lastErrorAt': admin.firestore.FieldValue.serverTimestamp()
                        });
                        break;
                    }
                }
                
                // Also log to general entity logs
                await db.collection(`${entityPath}/system_logs`).add({
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    type: `error_${options.provider}`,
                    error: errorData,
                    recipientId
                });
            } catch (fsErr) {
                console.error('[sendMetaMessage] Failed to log error to Firestore:', fsErr);
            }
        }

        throw new Error(`Meta API Error: ${detailedError}`);
    }
}

// --- WhatsApp Business Cloud API (Multi-Tenant Aware) ---

interface WhatsAppSendOptions {
    type?: 'text' | 'template' | 'quick_reply' | 'list' | 'media' | 'image' | 'video' | 'audio' | 'document';
    mediaType?: string;
    template?: any;
    buttons?: any[];
    button?: string;
    sections?: any[];
    url?: string;
    filename?: string;
    // Multi-tenant context
    userId?: string;
    entityId?: string;
}

/**
 * Sends a message via WhatsApp Business API.
 * If userId and entityId are provided, it fetches the credentials from Firestore.
 */
export async function sendWhatsAppMessage(
    toNumber: string,
    message: string,
    options: WhatsAppSendOptions = {}
): Promise<any> {
    let token = process.env.WHATSAPP_ACCESS_TOKEN;
    let phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    // 1. Multi-Tenant Token Resolution
    if (options.userId && options.entityId) {
        try {
            // First try standard paths for the specific user
            const configPath = `users/${options.userId}/entities/${options.entityId}/integrations/whatsapp`;
            const internalPath = `users/${options.userId}/entities/${options.entityId}/integrations/whatsapp_internal`;

            const configDoc = await db.doc(configPath).get();
            let data = configDoc.data();

            if (!data?.accessToken || !data?.phoneNumberId) {
                const internalDoc = await db.doc(internalPath).get();
                if (internalDoc.exists) data = internalDoc.data();
            }

            if (data?.accessToken && data?.phoneNumberId) {
                token = data.accessToken;
                phoneNumberId = data.phoneNumberId;
                console.log(`[sendWhatsAppMessage] Using Config: PhoneID=${phoneNumberId?.substring(0, 4)}... Source=${configDoc.exists ? 'standard' : 'internal'}`);
            } else {
                console.warn(`[sendWhatsAppMessage] No valid config found for entity ${options.entityId}`);
            }
        } catch (err) {
            console.error(`[sendWhatsAppMessage] Error resolving config:`, err);
        }
    }

    // 2. Final Extraction & Validation
    if (!token || !phoneNumberId) {
        throw new Error(`Configuración de WhatsApp faltante para '${options.entityId}'. \nDetalles: userId=${options.userId}, hasToken=${!!token}, hasPhoneId=${!!phoneNumberId}`);
    }

    const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;
    const cleanTo = toNumber.replace(/\D/g, '');

    let payload: any = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanTo,
    };

    console.log(`[sendWhatsAppMessage] Preparing message type: ${options.type || 'text'} to ${cleanTo}`);

    // Construct Payload based on type
    if (options.type === 'template' && options.template) {
        payload.type = 'template';
        payload.template = {
            name: options.template.name,
            language: { code: options.template.language?.code || 'es' },
            components: options.template.components || []
        };
    } else if (options.type === 'quick_reply') {
        payload.type = 'interactive';
        payload.interactive = {
            type: 'button',
            body: { text: message },
            action: { buttons: options.buttons }
        };
    } else if (options.type === 'list') {
        payload.type = 'interactive';
        payload.interactive = {
            type: 'list',
            header: { type: 'text', text: 'Opciones' },
            body: { text: message },
            action: {
                button: options.button || 'Seleccionar',
                sections: options.sections
            }
        };
    } else if (['media', 'multimedia', 'image', 'video', 'audio', 'document'].includes((options.type || '').toLowerCase())) {
        const typeIn = (options.type || 'image').toLowerCase();
        const url = options.url || '';
        
        // Auto-detect image type from extension for better WhatsApp rendering
        let mediaType: 'image' | 'video' | 'audio' | 'document' | 'file' = 'document';
        if (typeIn === 'image' || url.match(/\.(jpg|jpeg|png|webp|gif)$/i)) {
            mediaType = 'image';
        } else if (typeIn === 'video' || url.match(/\.(mp4|mov)$/i)) {
            mediaType = 'video';
        } else if (typeIn === 'audio' || url.match(/\.(mp3|ogg|wav)$/i)) {
            mediaType = 'audio';
        } else if (typeIn === 'document' || typeIn === 'media' || typeIn === 'multimedia') {
            mediaType = 'document';
        }

        const msgType = mediaType === 'document' ? 'document' : mediaType;
        payload.type = msgType;

        // Build media object — link is required for WhatsApp Cloud API
        const mediaData: any = { link: url, caption: message || '' };
        if (msgType === 'document' && options.filename) {
            mediaData.filename = options.filename;
        }

        payload[msgType] = mediaData;
    } else {
        console.warn(`[sendWhatsAppMessage] ⚠️ Falling back to TEXT. Received Type: "${options.type || 'undefined'}"`);
        payload.type = 'text';
        payload.text = { body: message, preview_url: false };
    }

    // Retry logic (up to 3 attempts, same as Firebase Functions version)
    let lastError: any = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const response = await axios.post(url, payload, {
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
            });
            console.log(`[sendWhatsAppMessage] ✅ Success (attempt ${attempt}):`, JSON.stringify(response.data));
            return { ...response.data, sentTo: cleanTo };
        } catch (error: any) {
            lastError = error.response?.data || error.message;
            const detailedError = typeof lastError === 'object' ? JSON.stringify(lastError) : lastError;
            const status = error.response?.status;
            const isTransient = status === 429 || (status >= 500 && status <= 599);
            
            if (isTransient && attempt < 3) {
                const wait = Math.pow(2, attempt) * 1000;
                console.warn(`[sendWhatsAppMessage] ⚠️ Transient error (attempt ${attempt}/3), retrying in ${wait}ms...`);
                await new Promise(r => setTimeout(r, wait));
                continue;
            }

            // EXHAUSTIVE LOGGING: If it fails, log the error to the card so the user knows WHY
            if (options.userId && options.entityId) {
                try {
                    const entityPath = `users/${options.userId}/entities/${options.entityId}`;
                    const groupsRef = db.collection(`${entityPath}/kanban-groups`);
                    const groupsSnap = await groupsRef.get();
                    
                    for (const groupDoc of groupsSnap.docs) {
                        const searchSnap = await groupDoc.ref.collection('cards')
                            .where('contactNumber', '==', toNumber)
                            .get();

                        if (!searchSnap.empty) {
                            await searchSnap.docs[0].ref.update({
                                'botState.lastError': `WhatsApp Error: ${detailedError}`,
                                'botState.lastErrorAt': admin.firestore.FieldValue.serverTimestamp()
                            });
                            break;
                        }
                    }
                    
                    await db.collection(`${entityPath}/system_logs`).add({
                        timestamp: admin.firestore.FieldValue.serverTimestamp(),
                        type: 'error_whatsapp',
                        error: lastError,
                        recipient: toNumber
                    });
                } catch (fsErr) {
                    console.error('[sendWhatsAppMessage] Failed to log error to Firestore:', fsErr);
                }
            }
            break;
        }
    }
    throw new Error(`WhatsApp API Error: ${JSON.stringify(lastError)}`);
}

// --- Telegram Bot API ---

export async function sendTelegramMessage(
    chatId: string,
    text: string,
    options: { userId?: string; entityId?: string; botToken?: string } = {}
): Promise<any> {
    if (!text) return;
    let token = options.botToken;

    if (options.userId && options.entityId && !token) {
        try {
            const configPath = `users/${options.userId}/entities/${options.entityId}/integrations/telegram`;
            const configDoc = await db.doc(configPath).get();
            if (configDoc.exists) {
                token = configDoc.data()?.botToken;
            }
        } catch (err) {
            console.error(`[sendTelegramMessage] Error resolving config:`, err);
        }
    }

    if (!token) {
        throw new Error('Telegram Bot Token is not configured for this entity.');
    }

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const payload: any = {
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML'
    };

    // Support for buttons (Quick Replies / Inline Keyboard)
    const optAny = options as any;
    if (optAny.type === 'quick_reply' && Array.isArray(optAny.buttons)) {
        payload.reply_markup = {
            inline_keyboard: optAny.buttons.map((btn: any) => {
                const b = btn.reply || btn;
                return [{ text: b.title, callback_data: b.id || b.title }];
            })
        };
    }

    try {
        const response = await axios.post(url, payload);
        return {
            ...response.data,
            message_id: response.data.result?.message_id,
            sentTo: chatId
        };
    } catch (error: any) {
        const errorData = error.response?.data || error.message;
        console.error('Telegram API Error:', JSON.stringify(errorData, null, 2));
        throw new Error(`Telegram API Error: ${JSON.stringify(errorData)}`);
    }
}

// --- Gmail API ---

export async function sendGmailMessage(
    to: string,
    text: string,
    options: { userId: string; entityId: string; subject?: string }
): Promise<any> {
    if (!text) return;

    try {
        const accessToken = await getGmailAccessToken(options.userId, options.entityId);

        // Gmail requires a base64url encoded raw message for its 'send' endpoint
        const subject = options.subject || 'Respuesta de Roosevelt';
        const str = [
            `To: ${to}`,
            'Content-Type: text/html; charset=utf-8',
            'MIME-Version: 1.0',
            `Subject: ${subject}`,
            '',
            text
        ].join('\n');

        const encodedMail = Buffer.from(str).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

        const url = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
        const response = await axios.post(url, { raw: encodedMail }, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        return { ...response.data, sentTo: to };
    } catch (error: any) {
        console.error('Gmail Send API Error:', error.response?.data || error.message);
        throw new Error('Fallo al enviar correo desde Gmail.');
    }
}
