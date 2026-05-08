"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendTelegramMessage = sendTelegramMessage;
exports.sendTelegramPhoto = sendTelegramPhoto;
exports.sendTelegramMedia = sendTelegramMedia;
exports.sendTelegramButtons = sendTelegramButtons;
exports.sendTelegramLocation = sendTelegramLocation;
exports.markTelegramMessageAsRead = markTelegramMessageAsRead;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios_1 = require("axios");
// Singleton env var token — used only when per-tenant token is not available
const TELEGRAM_BOT_TOKEN_ENV = process.env.TELEGRAM_BOT_TOKEN;
/**
 * Resolves the Telegram bot token for a tenant.
 * Priority: ctx.botToken → Firestore integration doc → env var.
 */
async function resolveBotToken(ctx) {
    var _a;
    if (ctx === null || ctx === void 0 ? void 0 : ctx.botToken)
        return ctx.botToken;
    if ((ctx === null || ctx === void 0 ? void 0 : ctx.userId) && (ctx === null || ctx === void 0 ? void 0 : ctx.entityId)) {
        try {
            const db = admin.firestore();
            const snap = await db
                .doc(`users/${ctx.userId}/entities/${ctx.entityId}/integrations/telegram`)
                .get();
            const token = (_a = snap.data()) === null || _a === void 0 ? void 0 : _a.botToken;
            if (token)
                return token;
        }
        catch (err) {
            functions.logger.warn(`[TelegramAPI] Could not fetch tenant token for ${ctx.userId}/${ctx.entityId}: ${err.message}`);
        }
    }
    if (TELEGRAM_BOT_TOKEN_ENV)
        return TELEGRAM_BOT_TOKEN_ENV;
    throw new Error('Telegram Bot Token is not configured (no tenant token and no env var).');
}
// Generic function to make requests to Telegram API
async function callTelegramApi(method, data, ctx) {
    var _a;
    const token = await resolveBotToken(ctx);
    const url = `https://api.telegram.org/bot${token}/${method}`;
    try {
        const response = await axios_1.default.post(url, data);
        return response.data;
    }
    catch (error) {
        const errorData = ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message;
        functions.logger.error(`Telegram API Error (${method}):`, errorData);
        throw new Error(`Telegram API Error: ${JSON.stringify(errorData)}`);
    }
}
/**
 * Sends a text message to a user via Telegram.
 */
async function sendTelegramMessage(chatId, text, ctx) {
    if (!text)
        return;
    return await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: text
    }, ctx);
}
/**
 * Sends a photo to a user.
 */
async function sendTelegramPhoto(chatId, photoUrl, caption, ctx) {
    return await callTelegramApi('sendPhoto', {
        chat_id: chatId,
        photo: photoUrl,
        caption: caption
    }, ctx);
}
/**
 * Sends a generic document/video/audio.
 */
async function sendTelegramMedia(chatId, mediaUrl, type, caption, ctx) {
    const method = type === 'video' ? 'sendVideo' : type === 'audio' ? 'sendAudio' : 'sendDocument';
    const payload = {
        chat_id: chatId,
        caption: caption
    };
    payload[type] = mediaUrl;
    return await callTelegramApi(method, payload, ctx);
}
/**
 * Sends Buttons (Inline Keyboard).
 */
async function sendTelegramButtons(chatId, text, buttons, ctx) {
    const inlineKeyboard = buttons.map(btn => ([{
            text: btn.title,
            callback_data: btn.id
        }]));
    return await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: text,
        reply_markup: {
            inline_keyboard: inlineKeyboard
        }
    }, ctx);
}
/**
 * Sends Location.
 */
async function sendTelegramLocation(chatId, lat, long, ctx) {
    return await callTelegramApi('sendLocation', {
        chat_id: chatId,
        latitude: lat,
        longitude: long
    }, ctx);
}
/**
 * For Telegram, "mark as read" is not directly supported via Bot API.
 */
async function markTelegramMessageAsRead(_chatId) {
    return Promise.resolve();
}
//# sourceMappingURL=telegramAPI.js.map