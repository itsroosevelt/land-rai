import { Firestore } from 'firebase/firestore';
import {
    getPrimaryPlatform,
    isBotActiveValue,
    normalizeTargetPlatforms,
    updateExclusiveBotForChannel,
} from '@/lib/automation/botActivation';

export { normalizeTargetPlatforms, getPrimaryPlatform, isBotActiveValue };

interface UpdateExclusiveBotOptions {
    db: Firestore;
    userId: string;
    entityId: string;
    botId: string;
    platformId: string | null;
    activate?: boolean;
}

/** WhatsApp-only: exclusive activation in the legacy `chatbots` collection. */
export const updateExclusiveBotPlatform = async (opts: UpdateExclusiveBotOptions) =>
    updateExclusiveBotForChannel({ ...opts, botsCollection: 'chatbots' });
