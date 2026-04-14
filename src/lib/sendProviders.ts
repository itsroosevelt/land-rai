import axios from 'axios';
import { db, admin } from './firebase-admin'; // Use admin to fetch tokens on server
import { getGmailAccessToken } from './googleAuth';

// --- Meta (Instagram & Messenger) ---

export interface MetaSendOptions {
    type?: 'text' | 'image' | 'quick_reply' | 'media';
    userId?: string;
    entityId?: string;
    provider?: 'messenger' | 'instagram';
    buttons?: any[];
}

export async function sendMetaMessage(
    recipientId: string,
    text: string,
    options: MetaSendOptions | string = {}
): Promise<any> {
    if (!text) return;
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
                    console.log(`[sendMetaMessage] Loaded resolved token for ${options.provider} in tenant ${options.entityId}`);
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

    const messageData: any = {
        messaging_type: 'RESPONSE',
        recipient: { id: recipientId },
        message: {}
    };

    const isImage = options.type === 'image' || (typeof options !== 'string' && options.type === 'media');

    if (isImage) {
        messageData.message = {
            attachment: {
                type: 'image',
                payload: {
                    url: text,
                    is_selectable: true
                }
            }
        };
    } else {
        messageData.message = { text: text };
    }

    // --- QUICK REPLY SUPPORT (FIXES MESSENGER MISSING BUTTONS) ---
    if (options.type === 'quick_reply' && options.buttons && options.buttons.length > 0) {
        messageData.message.quick_replies = options.buttons.map((btn: any) => {
            const b = btn.reply || btn;
            return {
                content_type: 'text',
                title: (b.title || b).substring(0, 20),
                payload: (b.id || b.title || b).substring(0, 50)
            };
        });
    }

    // The Messenger Send API strictly requires the '/me/messages' endpoint.
    // Using the explicit pageId causes Graph API to throw 'Unsupported post request'.
    const endpoint = 'me';
    const url = `https://graph.facebook.com/v21.0/${endpoint}/messages?access_token=${token}`;

    try {
        const response = await axios.post(url, messageData);
        return {
            ...response.data,
            message_id: response.data.message_id || response.data.id,
            sentTo: recipientId
        };
    } catch (error: any) {
        const errorData = error.response?.data || error.message;
        console.error('Meta API Error:', JSON.stringify(errorData, null, 2));

        // Self-documenting error in Firestore for easier debugging
        if (options.userId && options.entityId && options.provider) {
            try {
                const searchSnap = await db.collectionGroup('cards')
                    .where(`platform_ids.${options.provider}`, '==', recipientId)
                    .limit(1)
                    .get();

                if (!searchSnap.empty) {
                    await searchSnap.docs[0].ref.update({
                        'botState.lastError': JSON.stringify(errorData),
                        'botState.lastErrorAt': new Date()
                    });
                }
            } catch (fsErr) {
                console.error('[sendMetaMessage] Failed to log error to Firestore:', fsErr);
            }
        }

        throw new Error(`Meta API Error: ${JSON.stringify(errorData)}`);
    }
}

// --- WhatsApp Business Cloud API (Multi-Tenant Aware) ---

interface WhatsAppSendOptions {
    type?: 'text' | 'template' | 'quick_reply' | 'list' | 'media';
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
        const mediaType = (typeIn === 'media' || typeIn === 'multimedia') ? 'document' : typeIn as 'image' | 'video' | 'audio' | 'document';
        payload.type = mediaType;
        
        // Build media object strictly (Meta rejects 'filename' inside 'image' or 'video')
        const mediaData: any = { link: options.url, caption: message };
        if (mediaType === 'document' && options.filename) {
            mediaData.filename = options.filename;
        }

        payload[mediaType] = mediaData;
    } else {
        console.warn(`[sendWhatsAppMessage] ⚠️ Falling back to TEXT. Received Type: "${options.type || 'undefined'}"`);
        payload.type = 'text';
        payload.text = { body: message, preview_url: false };
    }

    try {
        const response = await axios.post(url, payload, {
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log(`[sendWhatsAppMessage] Meta API Response:`, JSON.stringify(response.data, null, 2));

        return { ...response.data, sentTo: cleanTo };
    } catch (error: any) {
        const errorData = error.response?.data || error.message;
        console.error('WhatsApp API Error:', JSON.stringify(errorData, null, 2));
        throw new Error(`WhatsApp API Error: ${JSON.stringify(errorData)}`);
    }
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
