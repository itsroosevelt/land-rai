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
    botsCollection: string;
    platformId: string | null;
    activate?: boolean;
}

/** One active bot per channel collection (isolated from WhatsApp and other channels). */
export const updateExclusiveBotForChannel = async ({
    db,
    userId,
    entityId,
    botId,
    botsCollection,
    platformId,
    activate,
}: UpdateExclusiveBotOptions) => {
    const normalizedPlatform = platformId ? platformId.trim().toLowerCase() : null;
    const botsRef = collection(db, 'users', userId, 'entities', entityId, botsCollection);
    const snapshot = await getDocs(botsRef);
    const batch = writeBatch(db);
    const now = new Date();

    snapshot.docs.forEach((botDoc) => {
        const data = botDoc.data();
        const isCurrentBot = botDoc.id === botId;
        const currentlyActive = isBotActiveValue(data.isActive);

        if (isCurrentBot) {
            const updates: Record<string, unknown> = {
                targetPlatforms: normalizedPlatform ? [normalizedPlatform] : [],
                updatedAt: now,
            };

            if (typeof activate === 'boolean') {
                updates.isActive = normalizedPlatform ? activate : false;
            } else if (!normalizedPlatform && currentlyActive) {
                updates.isActive = false;
            }

            batch.set(botDoc.ref, updates, { merge: true });
            return;
        }

        if (activate === true && currentlyActive) {
            batch.set(botDoc.ref, { isActive: false, updatedAt: now }, { merge: true });
        }
    });

    await batch.commit();
};
