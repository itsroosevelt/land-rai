"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrateCards = exports.moveCard = exports.whatsappWebhook = void 0;
const admin = require("firebase-admin");
if (!admin.apps.length) {
    admin.initializeApp();
}
/**
 * Firebase Functions (us-west3) — backend utilities + WhatsApp webhook proxy.
 * Web app + primary bot engine: Vercel (www.byroosevelt.com).
 */
var whatsapp_1 = require("./webhooks/whatsapp");
Object.defineProperty(exports, "whatsappWebhook", { enumerable: true, get: function () { return whatsapp_1.whatsappWebhook; } });
var kanbanOperations_1 = require("./helpers/kanbanOperations");
Object.defineProperty(exports, "moveCard", { enumerable: true, get: function () { return kanbanOperations_1.moveCard; } });
var migrateCards_1 = require("./helpers/migrateCards");
Object.defineProperty(exports, "migrateCards", { enumerable: true, get: function () { return migrateCards_1.migrateCards; } });
//# sourceMappingURL=index.js.map