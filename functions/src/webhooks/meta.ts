import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { normalizeMetaMessage, normalizeWhatsAppMessage } from '../helpers/messageNormalizer';
import { getMetaProfile } from '../helpers/metaAPI';
import { handleKanbanUpdateOmni } from '../helpers/kanbanOperations';
import { tryTriggerBot } from '../helpers/botEngine';
import { resolveTenant } from '../helpers/tenantResolver';

/**
 * META WEBHOOK HANDLER (Arquitectura Molde Maestro)
 */

export const metaWebhook = functions.https.onRequest(async (req, res) => {
    // 1. VERIFICACIÓN (GET)
    if (req.method === 'GET') {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];
        const u = req.query['u'] as string;
        const e = req.query['e'] as string;

        let expectedToken = process.env.META_VERIFY_TOKEN || 'vg37e';

        if (u && e) {
            try {
                const db = admin.firestore();
                const configSnap = await db.doc(`users/${u}/entities/${e}/integrations/whatsapp`).get();
                if (configSnap.exists) {
                    expectedToken = configSnap.data()?.verifyToken || expectedToken;
                }
            } catch (err) {
                functions.logger.error('[Meta Webhook Verify] Tenant fetch failed', err);
            }
        }

        if (mode === 'subscribe' && token === expectedToken) {
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
        return;
    }

    // 2. PROCESAMIENTO (POST)
    if (req.method === 'POST') {
        try {
            const body = req.body;

            if (!body.object || !body.entry) {
                res.status(400).send('INVALID_PAYLOAD');
                return;
            }

            const platform = (body.object === 'whatsapp_business_account' || body.object === 'whatsapp_business') ? 'whatsapp' : (body.object === 'instagram' ? 'instagram' : 'messenger');

            for (const entry of body.entry) {
                if (platform === 'whatsapp') {
                    for (const change of entry.changes || []) {
                        if (change.field !== 'messages') continue;
                        const value = change.value;
                        if (!value || !value.messages) continue;

                        const phoneNumberId = value.metadata?.phone_number_id;
                        const wabaId = entry.id;

                        // A. RESOLVER INQUILINO (Prioridad 1: Búsqueda Global por Phone ID - Regla 1)
                        let u: string | undefined;
                        let e: string | undefined;

                        const tenant = await resolveTenant('whatsapp', phoneNumberId, wabaId);
                        if (tenant) {
                            u = tenant.userId;
                            e = tenant.entityId;
                        } else {
                            // Backup: Trust the URL only if global search fails (Rule 4 Fallback)
                            u = req.query['u'] as string;
                            e = req.query['e'] as string;
                        }

                        if (!u || !e) {
                            functions.logger.warn(`[WhatsApp] ❌ Abort: Unresolved Tenant for ID: ${phoneNumberId}`);
                            continue;
                        }

                        // B. AUDITORIA EN BÓVEDA
                        try {
                            const db = admin.firestore();
                            await db.collection(`users/${u}/entities/${e}/system_logs`).add({
                                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                                type: 'whatsapp_webhook_incoming',
                                platform,
                                phoneId: phoneNumberId,
                                raw: JSON.stringify(body).substring(0, 1500)
                            });
                        } catch (logErr) { }

                        // C. PROCESAR MENSAJES
                        const contactName = value.contacts?.[0]?.profile?.name || 'Cliente WhatsApp';
                        for (const msg of value.messages) {
                            if (!msg.id || msg.is_echo || msg.from === phoneNumberId) continue;

                            const unified = normalizeWhatsAppMessage(msg, contactName);
                            // handleKanbanUpdateOmni se encarga de buscar/crear cards y sincronizar CRM
                            const result = await handleKanbanUpdateOmni(unified, u, e);

                            if (result?.success) {
                                await tryTriggerBot(u, e, 'whatsapp', unified.external_id, unified.message_text, msg.id, { mediaUrl: unified.media_url, type: unified.message_type });
                            }
                        }
                    }
                } else if (entry.messaging) {
                    const event = entry.messaging[0];
                    const recipientId = event.recipient?.id;
                    const senderId = event.sender?.id;

                    // [DIAGNOSTIC] Skip echo messages (bot's own messages being reflected back)
                    if (event.message?.is_echo) {
                        functions.logger.info(`[Meta Webhook] Skipping echo message for ${platform}`);
                        continue;
                    }
                    // Skip events with no actual message text or attachments
                    if (!event.message?.text && !event.message?.attachments) {
                        functions.logger.info(`[Meta Webhook] Skipping non-message event for ${platform}`);
                        continue;
                    }

                    let u = req.query['u'] as string;
                    let e = req.query['e'] as string;

                    functions.logger.info(`[Meta Webhook] Processing ${platform} event. sender=${senderId}, recipient=${recipientId}, entryId=${entry.id}`);

                    if (!u || !e) {
                        // Try resolving by recipientId (page/instagram account that received the message)
                        let tenant = await resolveTenant(platform as any, recipientId);

                        // Fallback: try with entry.id (also the page ID in Messenger webhook payloads)
                        if (!tenant && entry.id && entry.id !== recipientId) {
                            functions.logger.info(`[Meta Webhook] Retrying tenant resolution with entry.id: ${entry.id}`);
                            tenant = await resolveTenant(platform as any, entry.id);
                        }

                        if (tenant) {
                            u = tenant.userId;
                            e = tenant.entityId;
                        } else {
                            functions.logger.warn(`[Meta Webhook] ❌ Could not resolve tenant for ${platform}. recipientId=${recipientId}, entryId=${entry.id}. Dropping event.`);
                        }
                    }

                    if (u && e) {
                        // Fetch real profile name
                        let profile = null;
                        if (senderId) {
                            profile = await getMetaProfile(senderId, undefined, { userId: u, entityId: e, provider: platform as any });
                        }

                        const unified = normalizeMetaMessage(event, platform as any, profile);
                        const result = await handleKanbanUpdateOmni(unified, u, e);
                        if (result?.success) {
                            await tryTriggerBot(u, e, platform as any, unified.external_id, unified.message_text, event.message?.mid, { type: unified.message_type });
                        }
                    }
                }
            }
            res.status(200).send('EVENT_RECEIVED');
        } catch (err: any) {
            functions.logger.error(`[Meta Webhook] 💥 Critical Error: ${err.message}`);
            res.status(500).send('INTERNAL_ERROR');
        }
    }
});
