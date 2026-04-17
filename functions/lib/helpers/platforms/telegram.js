"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramAdapter = void 0;
const telegramAPI = require("../telegramAPI");
class TelegramAdapter {
    constructor(userId, entityId) {
        this.ctx = { userId, entityId };
    }
    async sendMessage(to, text) {
        return telegramAPI.sendTelegramMessage(to, text, this.ctx);
    }
    async sendMediaMessage(to, mediaUrl, caption, mediaType) {
        if (mediaType === 'image') {
            return telegramAPI.sendTelegramPhoto(to, mediaUrl, caption, this.ctx);
        }
        else if (mediaType === 'video' || mediaType === 'audio') {
            return telegramAPI.sendTelegramMedia(to, mediaUrl, mediaType, caption, this.ctx);
        }
        else {
            return telegramAPI.sendTelegramMedia(to, mediaUrl, 'document', caption, this.ctx);
        }
    }
    async sendButtonMessage(to, text, buttons) {
        return telegramAPI.sendTelegramButtons(to, text, buttons, this.ctx);
    }
    async sendListMessage(to, text, _buttonText, sections) {
        // Telegram doesn't have a native List Message like WhatsApp.
        // We flatten it into buttons (Inline Keyboard) if small, or plain text otherwise.
        const allOptions = [];
        sections.forEach(sec => allOptions.push(...sec.rows));
        if (allOptions.length <= 10) {
            return telegramAPI.sendTelegramButtons(to, text, allOptions, this.ctx);
        }
        else {
            let menuText = text + '\n';
            allOptions.forEach(opt => menuText += `- ${opt.title}\n`);
            return telegramAPI.sendTelegramMessage(to, menuText, this.ctx);
        }
    }
    async sendLocationMessage(to, lat, long, name, address) {
        await telegramAPI.sendTelegramLocation(to, lat, long, this.ctx);
        if (name || address) {
            await telegramAPI.sendTelegramMessage(to, `${name}\n${address}`, this.ctx);
        }
    }
    async markAsRead(messageId) {
        return telegramAPI.markTelegramMessageAsRead(messageId);
    }
}
exports.TelegramAdapter = TelegramAdapter;
//# sourceMappingURL=telegram.js.map