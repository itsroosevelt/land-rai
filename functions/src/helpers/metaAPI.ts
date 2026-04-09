
import * as functions from 'firebase-functions';
import axios from 'axios';

import * as admin from 'firebase-admin';

// Get tokens from environment variables
const PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;
export const INSTAGRAM_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN || process.env.META_PAGE_ACCESS_TOKEN;

interface Context {
    userId?: string;
    entityId?: string;
    provider?: 'messenger' | 'instagram';
}

// Generic function to make requests to Graph API
async function callSendApi(messageData: object, token?: string, ctx?: Context): Promise<any> {
    let accessToken = token || PAGE_ACCESS_TOKEN;
    let targetNodeId: string | undefined;

    // Resolve tenant-specific token if context provided
    if (ctx?.userId && ctx?.entityId && !token) {
        try {
            const db = admin.firestore();
            const platform = ctx.provider || 'messenger';

            // Reintentamos con el documento de integración específico
            const configSnap = await db.doc(`users/${ctx.userId}/entities/${ctx.entityId}/integrations/${platform}`).get();

            if (configSnap.exists) {
                const data = configSnap.data();
                if (data?.accessToken) {
                    accessToken = data.accessToken;
                    // Resolvemos el ID del nodo para System User Tokens
                    targetNodeId = platform === 'messenger' ? data.pageId : data.instagramId;
                }
            } else if (platform === 'messenger') {
                // Fallback a whatsapp config si es messenger y no tiene config propia
                const waSnap = await db.doc(`users/${ctx.userId}/entities/${ctx.entityId}/integrations/whatsapp`).get();
                if (waSnap.exists) {
                    const waData = waSnap.data();
                    if (waData?.accessToken) {
                        accessToken = waData.accessToken;
                        targetNodeId = waData.pageId;
                    }
                }
            }
        } catch (error) {
            functions.logger.error('[Meta API] Error fetching tenant token', error);
        }
    }

    if (!accessToken) {
        functions.logger.error('Missing Access Token (Meta/Instagram).');
        throw new Error('Access Token is not configured.');
    }

    // Si no tenemos el ID del nodo, intentamos con 'me' como fallback (solo funciona con User Tokens)
    const node = targetNodeId || 'me';
    const url = `https://graph.facebook.com/v21.0/${node}/messages?access_token=${accessToken}`;

    try {
        const response = await axios.post(url, messageData);
        return response.data;
    } catch (error: any) {
        const errorData = error.response?.data || error.message;
        functions.logger.error('Meta API Error:', errorData);

        // Log error to card if possible
        if (ctx?.userId && ctx?.entityId && ctx?.provider) {
            const db = admin.firestore();
            // Intentamos actualizar la última card activa
            try {
                //Nota: El query por platform_ids aquí es pesado, pero útil para depuración
                const cards = await db.collectionGroup('cards')
                    .where(`platform_ids.${ctx.provider}`, '!=', null)
                    .limit(5).get(); // Limitado para evitar timeout
                // Aquí lo ideal sería pasar el recipientId a callSendApi para buscar la card exacta
            } catch (e) { }
        }

        throw new Error(`Meta API Error: ${JSON.stringify(errorData)}`);
    }
}

/**
 * Sends a text message to a user via Messenger.
 */
export async function sendMetaMessage(recipientId: string, text: string, token?: string, ctx?: Context): Promise<any> {
    if (!text) return;

    const messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            text: text
        }
    };

    return await callSendApi(messageData, token, ctx);
}

/**
 * Sends a media message (image, video, etc.).
 */
export async function sendMetaMediaMessage(recipientId: string, mediaUrl: string, mediaType: 'image' | 'video' | 'audio' | 'file' = 'image', token?: string, ctx?: Context): Promise<any> {
    if (!mediaUrl) return;

    const messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            attachment: {
                type: mediaType,
                payload: {
                    url: mediaUrl,
                    is_reusable: true
                }
            }
        }
    };

    return await callSendApi(messageData, token, ctx);
}

/**
 * Marks a message as read in Messenger.
 * Note: Facebook does not have an explicit "mark as read" endpoint same as WhatsApp, but we can send "sender_action: mark_seen".
 */
export async function markMetaMessageAsRead(recipientId: string, token?: string, ctx?: Context): Promise<any> {
    const messageData = {
        recipient: {
            id: recipientId
        },
        sender_action: 'mark_seen'
    };

    return await callSendApi(messageData, token, ctx);
}

/**
 * Sends Quick Replies (Buttons).
 * Facebook Quick Replies are different from WhatsApp Buttons.
 */
export async function sendMetaQuickReplies(recipientId: string, text: string, quickReplies: any[], token?: string, ctx?: Context): Promise<any> {
    // Format quick replies for Messenger
    // Expected format: { content_type: 'text', title: 'Yes', payload: 'YES_PAYLOAD' }
    const formattedQRs = quickReplies.slice(0, 13).map(qr => ({
        content_type: 'text',
        title: (qr.title || 'Opción').substring(0, 20),
        payload: qr.id || qr.payload || qr.title
    }));

    const messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            text: text,
            quick_replies: formattedQRs
        }
    };

    return await callSendApi(messageData, token, ctx);
}

/**
 * Fetches user profile from Meta
 */
export async function getMetaProfile(recipientId: string, token?: string, ctx?: Context): Promise<any> {
    let accessToken = token || PAGE_ACCESS_TOKEN;

    if (ctx?.userId && ctx?.entityId && !token) {
        try {
            const db = admin.firestore();
            const configSnap = await db.doc(`users/${ctx.userId}/entities/${ctx.entityId}/integrations/${ctx.provider || 'messenger'}`).get();
            if (configSnap.exists) accessToken = configSnap.data()?.accessToken || accessToken;
        } catch (e) {}
    }

    if (!accessToken) return null;

    const url = `https://graph.facebook.com/v21.0/${recipientId}?fields=name,first_name,last_name,profile_pic&access_token=${accessToken}`;
    
    try {
        const res = await axios.get(url);
        return res.data;
    } catch (e) {
        functions.logger.warn(`[Meta API] Failed to fetch profile for ${recipientId}`);
        return null;
    }
}
