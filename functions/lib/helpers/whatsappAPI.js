"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markAsRead = markAsRead;
exports.sendMessage = sendMessage;
exports.sendMediaMessage = sendMediaMessage;
exports.sendButtonMessage = sendButtonMessage;
exports.sendListMessage = sendListMessage;
exports.sendLocationMessage = sendLocationMessage;
// src/helpers/whatsappAPI.ts
const functions = require("firebase-functions");
const axios_1 = require("axios");
const admin = require("firebase-admin");
const whatsappConfig = functions.config().whatsapp;
// Updated with user provided keys as primary or fallback
const accessToken = (whatsappConfig === null || whatsappConfig === void 0 ? void 0 : whatsappConfig.access_token) || '';
const phoneNumberId = (whatsappConfig === null || whatsappConfig === void 0 ? void 0 : whatsappConfig.phone_number_id) || '676837795516836';
function cleanNumber(phone) {
    return phone.replace(/\D/g, ''); // Solo números, quita el '+'
}
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
async function getWhatsAppCredentials(ctx) {
    var _a, _b;
    // Priority: Cloud Config > Environment Variables
    let apiToken = ((_a = functions.config().whatsapp) === null || _a === void 0 ? void 0 : _a.access_token) || process.env.WHATSAPP_ACCESS_TOKEN || accessToken;
    let phoneId = ((_b = functions.config().whatsapp) === null || _b === void 0 ? void 0 : _b.phone_number_id) || process.env.WHATSAPP_PHONE_NUMBER_ID || phoneNumberId;
    if ((ctx === null || ctx === void 0 ? void 0 : ctx.userId) && (ctx === null || ctx === void 0 ? void 0 : ctx.entityId)) {
        try {
            const db = admin.firestore();
            const paths = [
                `users/${ctx.userId}/entities/${ctx.entityId}/integrations/whatsapp`,
                `users/${ctx.userId}/entities/${ctx.entityId}/integrations/whatsapp_internal`
            ];
            for (const configPath of paths) {
                const snapshot = await db.doc(configPath).get();
                if (snapshot.exists) {
                    const configData = snapshot.data();
                    if ((configData === null || configData === void 0 ? void 0 : configData.accessToken) && (configData === null || configData === void 0 ? void 0 : configData.phoneNumberId)) {
                        apiToken = configData.accessToken;
                        phoneId = configData.phoneNumberId;
                        break;
                    }
                }
            }
        }
        catch (e) {
            functions.logger.error("[WhatsApp API] Failed to fetch custom credentials", e);
        }
    }
    if (!apiToken || !phoneId) {
        throw new Error('WhatsApp API credentials are not configured.');
    }
    return { apiToken, phoneId };
}
async function makeWhatsAppRequest(data, type, ctx) {
    var _a, _b;
    const { apiToken, phoneId } = await getWhatsAppCredentials(ctx);
    const url = `https://graph.facebook.com/v19.0/${phoneId}/messages`;
    let lastError = null;
    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
            const response = await axios_1.default.post(url, data, {
                headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
            });
            functions.logger.info(`✅ [WhatsApp API] ${type} success (Attempt ${attempt})`, { recipient: data.to });
            return response.data;
        }
        catch (error) {
            lastError = ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message;
            // Only retry on potential transient errors (5xx or 429)
            const status = (_b = error.response) === null || _b === void 0 ? void 0 : _b.status;
            const isTransient = status === 429 || (status >= 500 && status <= 599);
            if (isTransient && attempt < MAX_ATTEMPTS) {
                const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s
                functions.logger.warn(`⚠️ [WhatsApp API] ${type} failed (Attempt ${attempt}/${MAX_ATTEMPTS}). Retrying in ${waitTime}ms...`, { error: lastError });
                await sleep(waitTime);
                continue;
            }
            functions.logger.error(`❌ [WhatsApp API] Error (${type}) on attempt ${attempt}:`, {
                error: lastError,
                payload: data,
                url: url.replace(phoneId, 'HIDDEN_ID')
            });
            break;
        }
    }
    throw new Error(`WhatsApp API Error after ${MAX_ATTEMPTS} attempts: ${JSON.stringify(lastError)}`);
}
async function markAsRead(messageId, ctx) {
    if (!messageId)
        return;
    return await makeWhatsAppRequest({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId
    }, 'MarkAsRead', ctx);
}
async function sendMessage(to, message, options) {
    if (!message)
        return;
    const cleanTo = cleanNumber(to);
    const payload = {
        messaging_product: 'whatsapp',
        to: cleanTo,
        text: { body: message }
    };
    if (options === null || options === void 0 ? void 0 : options.preview_url) {
        payload.text.preview_url = true;
    }
    return await makeWhatsAppRequest(payload, 'Text', options);
}
/**
 * Downloads media from URL and uploads it to Meta to get a media_id.
 * This is the most reliable way to ensure images are displayed directly.
 */
async function uploadMediaToMeta(fileUrl, mediaType, ctx) {
    var _a;
    try {
        const { apiToken: token, phoneId } = await getWhatsAppCredentials(ctx);
        // 1. Download the file internally
        const fileResponse = await axios_1.default.get(fileUrl, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(fileResponse.data);
        // 2. Prepare FormData for Meta
        // Node 20 has built-in FormData, but axios handles Blob/Buffer better with specific headers
        const formData = new FormData();
        const blob = new Blob([buffer], { type: fileResponse.headers['content-type'] });
        formData.append('file', blob);
        formData.append('type', mediaType);
        formData.append('messaging_product', 'whatsapp');
        // 3. Upload to Meta
        const uploadUrl = `https://graph.facebook.com/v19.0/${phoneId}/media`;
        const response = await axios_1.default.post(uploadUrl, formData, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'multipart/form-data'
            }
        });
        if (response.data && response.data.id) {
            functions.logger.info(`[WhatsApp API] ✅ Media uploaded to Meta. ID: ${response.data.id}`);
            return response.data.id;
        }
        throw new Error('No media ID returned from Meta');
    }
    catch (err) {
        functions.logger.error('[WhatsApp API] ❌ Failed to upload media to Meta:', err.message);
        if ((_a = err.response) === null || _a === void 0 ? void 0 : _a.data) {
            functions.logger.error('[WhatsApp API] Meta Upload Error Details:', JSON.stringify(err.response.data));
        }
        throw err;
    }
}
async function sendMediaMessage(to, fileUrl, caption = '', 
/** Pass the media type directly ('image'|'video'|'audio'|'document') or a filename for auto-detection */
mediaTypeOrFileName = 'file', ctx) {
    // If the caller already knows the type, use it directly; otherwise detect from URL/filename
    const knownTypes = ['image', 'video', 'audio', 'document'];
    const mediaType = knownTypes.includes(mediaTypeOrFileName)
        ? mediaTypeOrFileName
        : getMediaType(fileUrl, mediaTypeOrFileName);
    if (mediaType === 'unsupported') {
        functions.logger.warn(`[WhatsApp] Unsupported media type for: ${fileUrl}`);
        return;
    }
    const cleanTo = cleanNumber(to);
    // 1. UPLOAD media directly to Meta's servers (Ensures high reliability and direct visualization)
    const mediaId = await uploadMediaToMeta(fileUrl, mediaType, ctx);
    // 2. Build the media object (Using ID instead of LINK)
    const mediaObj = {
        id: mediaId
    };
    // Include a filename for document type 
    if (mediaType === 'document') {
        const cleanUrl = fileUrl.split('?')[0];
        mediaObj.filename = (caption && caption.length < 50) ? caption : (cleanUrl.split('/').pop() || 'archivo');
    }
    functions.logger.info(`[WhatsApp API] 📤 Sending ${mediaType} via Media ID: ${mediaId}`);
    // 3. Send the MEDIA (Using id instead of link)
    const response = await makeWhatsAppRequest({
        messaging_product: 'whatsapp',
        to: cleanTo,
        type: mediaType,
        [mediaType]: mediaObj
    }, 'Media', ctx);
    functions.logger.info(`[WhatsApp API] ✅ Media (${mediaType}) delivered successfully.`);
    // 4. Send the CAPTION as a separate message (STAGGERED DELIVERY)
    if (caption && caption.trim()) {
        try {
            await sleep(1500); // Micro-delay for sequencing
            await sendMessage(to, caption, ctx);
        }
        catch (err) {
            functions.logger.error('[WhatsApp API] Staggered caption failed', err);
        }
    }
    return response;
}
async function sendButtonMessage(to, bodyText, buttons, header, ctx) {
    const validButtons = buttons.slice(0, 3).map((btn, i) => {
        const id = (btn.id || `btn_${i}`).substring(0, 256);
        const title = (btn.title || "Opción").substring(0, 20);
        return {
            type: "reply",
            reply: { id, title }
        };
    });
    if (validButtons.length === 0)
        return;
    const interactive = {
        type: 'button',
        body: { text: bodyText.substring(0, 1024) },
        action: { buttons: validButtons }
    };
    // Add optional header if provided
    if (header && header.type !== 'none') {
        if (header.type === 'text' && header.text) {
            interactive.header = { type: 'text', text: header.text.substring(0, 60) };
        }
        else if (['image', 'video', 'document'].includes(header.type) && header.url) {
            interactive.header = {
                type: header.type,
                [header.type]: { link: header.url }
            };
        }
    }
    const payload = {
        messaging_product: 'whatsapp',
        to: cleanNumber(to),
        type: 'interactive',
        interactive
    };
    await makeWhatsAppRequest(payload, 'Buttons', ctx);
}
async function sendListMessage(to, bodyText, buttonText, sections, ctx) {
    if (!sections || sections.length === 0)
        return;
    const formattedSections = [];
    let totalRows = 0;
    for (const sec of sections) {
        const rows = (sec.rows || []).map((row) => {
            const rowId = (row.id || row.title || `row_${Math.random()}`).substring(0, 200);
            let rowTitle = (row.title || "Opción").trim();
            if (rowTitle.length > 24)
                rowTitle = rowTitle.substring(0, 21) + "...";
            let rowDesc = row.description ? row.description.substring(0, 72) : undefined;
            return { id: rowId, title: rowTitle, description: rowDesc };
        });
        if (rows.length > 0) {
            formattedSections.push({
                title: (sec.title || "Opciones").substring(0, 50),
                rows: rows
            });
            totalRows += rows.length;
        }
    }
    if (totalRows === 0)
        return;
    let validBtnText = (buttonText || "Ver Opciones").substring(0, 20);
    const payload = {
        messaging_product: 'whatsapp',
        to: cleanNumber(to),
        type: 'interactive',
        interactive: {
            type: 'list',
            body: { text: (bodyText || "Selecciona una opción").substring(0, 1024) },
            action: { button: validBtnText, sections: formattedSections }
        }
    };
    await makeWhatsAppRequest(payload, 'List', ctx);
}
async function sendLocationMessage(to, lat, long, name, address, ctx) {
    await makeWhatsAppRequest({
        messaging_product: 'whatsapp', to: cleanNumber(to), type: 'location',
        location: { latitude: lat, longitude: long, name: name, address: address }
    }, 'Location', ctx);
}
function getMediaType(url, fileName) {
    var _a, _b;
    // Extension extraction: prefer filename if it has a dot, otherwise use URL path (strip query params)
    const cleanUrl = url.split('?')[0];
    const ext = (_b = (fileName && fileName.includes('.')
        ? fileName.split('.').pop()
        : (_a = cleanUrl.split('/').pop()) === null || _a === void 0 ? void 0 : _a.split('.').pop())) === null || _b === void 0 ? void 0 : _b.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext || ''))
        return 'image';
    if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'zip'].includes(ext || ''))
        return 'document';
    if (['mp4', '3gp', 'mov', 'avi', 'mkv', 'webm'].includes(ext || ''))
        return 'video';
    if (['mp3', 'aac', 'ogg', 'wav', 'm4a', 'opus'].includes(ext || ''))
        return 'audio';
    // Safer fallback: treat unknown binaries as document rather than image
    return 'document';
}
//# sourceMappingURL=whatsappAPI.js.map