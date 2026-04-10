"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INSTAGRAM_ACCESS_TOKEN = void 0;
exports.sendMetaMessage = sendMetaMessage;
exports.sendMetaMediaMessage = sendMetaMediaMessage;
exports.markMetaMessageAsRead = markMetaMessageAsRead;
exports.sendMetaQuickReplies = sendMetaQuickReplies;
exports.getMetaProfile = getMetaProfile;
const functions = require("firebase-functions");
const axios_1 = require("axios");
const admin = require("firebase-admin");
// Get tokens from environment variables
const PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;
exports.INSTAGRAM_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN || process.env.META_PAGE_ACCESS_TOKEN;
// Generic function to make requests to Graph API
async function callSendApi(messageData, token, ctx) {
    var _a, _b;
    let accessToken = token || PAGE_ACCESS_TOKEN;
    let targetNodeId;
    // Resolve tenant-specific token if context provided
    if ((ctx === null || ctx === void 0 ? void 0 : ctx.userId) && (ctx === null || ctx === void 0 ? void 0 : ctx.entityId) && !token) {
        try {
            const db = admin.firestore();
            const platform = ctx.provider || 'messenger';
            // 1. Try direct doc lookup (fastest)
            let configSnap = await db.doc(`users/${ctx.userId}/entities/${ctx.entityId}/integrations/${platform}`).get();
            // 2. Try 'facebook' doc if 'messenger' fails
            if (!configSnap.exists && platform === 'messenger') {
                configSnap = await db.doc(`users/${ctx.userId}/entities/${ctx.entityId}/integrations/facebook`).get();
            }
            // 3. Robust fallback: search by field (matching resolveTenant logic)
            if (!configSnap.exists) {
                const fieldName = platform === 'instagram' ? 'instagramId' : 'pageId';
                const integrationsSnap = await db.collection(`users/${ctx.userId}/entities/${ctx.entityId}/integrations`)
                    .where(fieldName, '!=', '')
                    .limit(1)
                    .get();
                if (!integrationsSnap.empty) {
                    configSnap = integrationsSnap.docs[0];
                }
            }
            if (configSnap && configSnap.exists) {
                const data = configSnap.data();
                if (data === null || data === void 0 ? void 0 : data.accessToken) {
                    accessToken = data.accessToken;
                    targetNodeId = platform === 'messenger' ? data.pageId : data.instagramId;
                }
            }
            else if (platform === 'messenger') {
                // Last ditch fallback to whatsapp config
                const waSnap = await db.doc(`users/${ctx.userId}/entities/${ctx.entityId}/integrations/whatsapp`).get();
                if (waSnap.exists) {
                    const waData = waSnap.data();
                    if (waData === null || waData === void 0 ? void 0 : waData.accessToken) {
                        accessToken = waData.accessToken;
                        targetNodeId = waData.pageId;
                    }
                }
            }
        }
        catch (error) {
            functions.logger.error('[Meta API] Error fetching tenant token', error);
        }
    }
    if (!accessToken) {
        functions.logger.error('[Meta API] ❌ Missing Access Token.');
        throw new Error('Access Token is not configured.');
    }
    const node = targetNodeId || 'me';
    const url = `https://graph.facebook.com/v21.0/${node}/messages?access_token=${accessToken}`;
    // Mask token for logs
    const maskedToken = accessToken.substring(0, 6) + '...' + accessToken.substring(accessToken.length - 4);
    functions.logger.info(`[Meta API] 🚀 Sending to ${node}. Recipient: ${(_a = messageData.recipient) === null || _a === void 0 ? void 0 : _a.id}. Token: ${maskedToken} (Provider: ${ctx === null || ctx === void 0 ? void 0 : ctx.provider})`);
    try {
        const response = await axios_1.default.post(url, messageData);
        functions.logger.info(`[Meta API] ✅ Success: ${response.data.message_id || 'OK'}`);
        return response.data;
    }
    catch (error) {
        const errorData = ((_b = error.response) === null || _b === void 0 ? void 0 : _b.data) || error.message;
        functions.logger.error(`[Meta API] ❌ FAILED for ${node}:`, errorData);
        throw new Error(`Meta API Error: ${JSON.stringify(errorData)}`);
    }
}
/**
 * Sends a text message to a user via Messenger.
 */
async function sendMetaMessage(recipientId, text, token, ctx) {
    if (!text)
        return;
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
async function sendMetaMediaMessage(recipientId, mediaUrl, mediaType = 'image', token, ctx) {
    if (!mediaUrl)
        return;
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
async function markMetaMessageAsRead(recipientId, token, ctx) {
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
async function sendMetaQuickReplies(recipientId, text, quickReplies, token, ctx) {
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
async function getMetaProfile(recipientId, token, ctx) {
    var _a;
    let accessToken = token || PAGE_ACCESS_TOKEN;
    if ((ctx === null || ctx === void 0 ? void 0 : ctx.userId) && (ctx === null || ctx === void 0 ? void 0 : ctx.entityId) && !token) {
        try {
            const db = admin.firestore();
            const configSnap = await db.doc(`users/${ctx.userId}/entities/${ctx.entityId}/integrations/${ctx.provider || 'messenger'}`).get();
            if (configSnap.exists)
                accessToken = ((_a = configSnap.data()) === null || _a === void 0 ? void 0 : _a.accessToken) || accessToken;
        }
        catch (e) { }
    }
    if (!accessToken)
        return null;
    const url = `https://graph.facebook.com/v21.0/${recipientId}?fields=name,first_name,last_name,profile_pic&access_token=${accessToken}`;
    try {
        const res = await axios_1.default.get(url);
        return res.data;
    }
    catch (e) {
        functions.logger.warn(`[Meta API] Failed to fetch profile for ${recipientId}`);
        return null;
    }
}
//# sourceMappingURL=metaAPI.js.map