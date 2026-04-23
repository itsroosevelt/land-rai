import { Firestore, collection, getDocs, writeBatch } from 'firebase/firestore';

export const normalizeTargetPlatforms = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];

    const cleaned = value
        .map((platform) => String(platform || '').trim().toLowerCase())
        .filter(Boolean);

    return Array.from(new Set(cleaned));
};

export const getPrimaryPlatform = (value: unknown): string | null => {
    const normalized = normalizeTargetPlatforms(value);
    return normalized[0] || null;
};

export const isBotActiveValue = (value: unknown) => value === true || value === 'true';

interface UpdateExclusiveBotOptions {
    db: Firestore;
    userId: string;
    entityId: string;
    botId: string;
    platformId: string | null;
    activate?: boolean;
}

export const updateExclusiveBotPlatform = async ({
    db,
    userId,
    entityId,
    botId,
    platformId,
    activate
}: UpdateExclusiveBotOptions) => {
    const normalizedPlatform = platformId ? platformId.trim().toLowerCase() : null;
    const botsRef = collection(db, 'users', userId, 'entities', entityId, 'chatbots');
    const snapshot = await getDocs(botsRef);
    const batch = writeBatch(db);
    const now = new Date();
    const hasOtherActiveBotOnTargetPlatform = !!normalizedPlatform && snapshot.docs.some((botDoc) => {
        if (botDoc.id === botId) return false;
        const data = botDoc.data();
        return isBotActiveValue(data.isActive) && getPrimaryPlatform(data.targetPlatforms) === normalizedPlatform;
    });

    snapshot.docs.forEach((botDoc) => {
        const data = botDoc.data();
        const isCurrentBot = botDoc.id === botId;
        const currentPrimaryPlatform = getPrimaryPlatform(data.targetPlatforms);
        const currentlyActive = isBotActiveValue(data.isActive);

        if (isCurrentBot) {
            const updates: Record<string, unknown> = {
                targetPlatforms: normalizedPlatform ? [normalizedPlatform] : [],
                updatedAt: now
            };

            if (typeof activate === 'boolean') {
                updates.isActive = normalizedPlatform ? activate : false;
            } else if (normalizedPlatform && currentlyActive && hasOtherActiveBotOnTargetPlatform) {
                // Changing platform alone must never steal the active slot from another bot.
                updates.isActive = false;
            } else if (!normalizedPlatform && currentlyActive) {
                updates.isActive = false;
            }

            batch.set(botDoc.ref, updates, { merge: true });
            return;
        }

        if (activate === true && normalizedPlatform && currentlyActive && currentPrimaryPlatform === normalizedPlatform) {
            batch.set(botDoc.ref, { isActive: false, updatedAt: now }, { merge: true });
        }
    });

    await batch.commit();
};
