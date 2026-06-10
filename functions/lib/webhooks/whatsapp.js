"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.whatsappWebhook = void 0;
const functions = require("firebase-functions");
const axios_1 = require("axios");
const config_1 = require("../config");
const region_1 = require("../region");
/**
 * WhatsApp webhook compatibility endpoint (Firebase → Vercel).
 * Meta may still point at Cloud Functions; this proxies to the Next.js queue engine on Vercel.
 * Recommended Meta callback: https://www.byroosevelt.com/api/whatsapp/webhook
 */
exports.whatsappWebhook = region_1.regionalFunctions.https.onRequest(async (req, res) => {
    const target = `${config_1.ROOSEVELT_API_BASE.replace(/\/$/, '')}/api/whatsapp/webhook`;
    try {
        if (req.method === 'GET') {
            const response = await axios_1.default.get(target, {
                params: req.query,
                validateStatus: () => true,
                responseType: 'text',
                timeout: 15000,
            });
            res.status(response.status).send(response.data);
            return;
        }
        if (req.method === 'POST') {
            const response = await axios_1.default.post(target, req.body, {
                params: req.query,
                headers: {
                    'Content-Type': req.headers['content-type'] || 'application/json',
                },
                validateStatus: () => true,
                timeout: 55000,
            });
            if (typeof response.data === 'object' && response.data !== null) {
                res.status(response.status).json(response.data);
            }
            else {
                res.status(response.status).send(response.data);
            }
            return;
        }
        res.status(405).send('Method Not Allowed');
    }
    catch (err) {
        functions.logger.error('[WhatsApp Proxy] Failed forwarding to Vercel:', err.message);
        res.status(502).send('WEBHOOK_PROXY_ERROR');
    }
});
//# sourceMappingURL=whatsapp.js.map