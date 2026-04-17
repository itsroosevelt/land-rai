import * as functions from 'firebase-functions';
import { normalizeWebChatMessage } from '../helpers/messageNormalizer';
import { handleKanbanUpdateOmni } from '../helpers/kanbanOperations';
import { tryTriggerBot } from '../helpers/botEngine';
import { resolveTenant } from '../helpers/tenantResolver';

/**
 * WEB CHAT WEBHOOK HANDLER
 * 
 * Receives messages from the custom website widget.
 * URL: https://[project-id].cloudfunctions.net/webchatWebhook
 */

// Simple in-memory rate limiting check could go here, or Auth check
// For now, assuming direct post from widget secured by CORS/Origin check in Firebase Config

export const webchatWebhook = functions.https.onRequest(async (req: functions.https.Request, res: functions.Response) => {
    // Enable CORS
    res.set('Access-Control-Allow-Origin', '*'); // Secure this in production!
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    if (req.method === 'POST') {
        try {
            const body = req.body;
            // Expected body: { sessionId, text, visitorName?, attachments? }

            if (!body.sessionId || !body.text) {
                res.status(400).send('Missing required fields');
                return;
            }

            functions.logger.info('Received WebChat message', body);

            // Resolve tenant: widgetId lookup → body-supplied entityId → URL params
            let userId: string | undefined;
            let entityId: string | undefined;

            const widgetId = body.widgetId as string | undefined;
            if (widgetId) {
                const tenant = await resolveTenant('webchat', widgetId);
                if (tenant) {
                    userId = tenant.userId;
                    entityId = tenant.entityId;
                }
            }

            // Fallback 1: widget sent explicit entityId with userId in URL
            if (!userId || !entityId) {
                userId = (req.query['u'] || body.userId) as string | undefined;
                entityId = (req.query['e'] || body.entityId) as string | undefined;
            }

            if (!userId || !entityId) {
                functions.logger.error(`[WebChat Webhook] ❌ Unresolved tenant. widgetId=${widgetId}. Dropping event.`);
                res.status(400).json({ error: 'Tenant could not be resolved. Provide a valid widgetId or u/e params.' });
                return;
            }

            const unifiedMsg = normalizeWebChatMessage(body);
            const cardResult = await handleKanbanUpdateOmni(unifiedMsg, userId, entityId);

            // Trigger Bot (Unified Logic)
            if (cardResult && cardResult.success) {
                await tryTriggerBot(userId, entityId, 'webchat', unifiedMsg.external_id, unifiedMsg.message_text);
            }

            res.status(200).json({ success: true });
        } catch (error) {
            functions.logger.error('Error processing WebChat webhook', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    } else {
        res.sendStatus(405);
    }
});
