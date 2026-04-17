import * as functions from 'firebase-functions';
import { normalizeTelegramMessage } from '../helpers/messageNormalizer';
import { handleKanbanUpdateOmni } from '../helpers/kanbanOperations';
import { tryTriggerBot } from '../helpers/botEngine';
import { resolveTenant } from '../helpers/tenantResolver';

/**
 * TELEGRAM WEBHOOK HANDLER
 * 
 * URL: https://[project-id].cloudfunctions.net/telegramWebhook
 */

export const telegramWebhook = functions.https.onRequest(async (req: functions.https.Request, res: functions.Response) => {
    if (req.method === 'POST') {
        const secretToken = req.headers['x-telegram-bot-api-secret-token'] as string | undefined;

        // --- RESOLUCIÓN DE INQUILINO (TENANT RESOLUTION) ---
        // Priority 1: resolve by secretToken (webhook secret header)
        // Priority 2: resolve by URL query params u/e (legacy or manual setup)
        let userId: string | undefined;
        let entityId: string | undefined;

        if (secretToken) {
            const tenant = await resolveTenant('telegram', secretToken);
            if (tenant) {
                userId = tenant.userId;
                entityId = tenant.entityId;
            }
        }

        // Fallback: URL params for manual/legacy setups
        if (!userId || !entityId) {
            userId = req.query['u'] as string | undefined;
            entityId = req.query['e'] as string | undefined;
        }

        if (!userId || !entityId) {
            functions.logger.error(`[Telegram Webhook] ❌ Unresolved tenant. secretToken=${secretToken}. Dropping event.`);
            // Return 200 to prevent Telegram from retrying with the same unresolvable payload
            res.sendStatus(200);
            return;
        }

        const update = req.body;

        if (update.message) {
            functions.logger.info('Received Telegram message', update.message);
            try {
                const unifiedMsg = normalizeTelegramMessage(update.message);
                const cardResult = await handleKanbanUpdateOmni(unifiedMsg, userId, entityId);

                if (cardResult && cardResult.success) {
                    await tryTriggerBot(userId, entityId, 'telegram', unifiedMsg.external_id, unifiedMsg.message_text);
                }
                res.sendStatus(200);
            } catch (error) {
                functions.logger.error('Error processing Telegram webhook', error);
                res.sendStatus(500);
            }
        } else {
            // Acknowledge other updates (edits, typing, etc.)
            res.sendStatus(200);
        }
    } else {
        res.sendStatus(405);
    }
});
