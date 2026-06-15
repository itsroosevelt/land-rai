/**
 * Shared bot message-queue helpers for multitenant webhook ingestion.
 * Prevents duplicate prompts when Meta retries or multiple engines process the same event.
 */

export interface BotQueueItem {
    text: string;
    messageId: string;
    platform: string;
    from: string;
    timestamp: number;
    metadata?: {
        commentId?: string;
        mediaId?: string;
        mediaProductType?: string;
    };
}

export function buildBotQueueItem(params: {
    text: string;
    messageId: string;
    platform: string;
    from: string;
    metadata?: BotQueueItem['metadata'];
}): BotQueueItem {
    return {
        text: params.text || '',
        messageId: params.messageId,
        platform: params.platform,
        from: params.from,
        timestamp: Date.now(),
        ...(params.metadata ? { metadata: params.metadata } : {}),
    };
}

export function isDuplicateQueueMessage(
    cardData: Record<string, any> | null | undefined,
    messageId?: string | null
): boolean {
    if (!messageId) return false;
    const botState = cardData?.botState || {};
    const queue = botState.messageQueue || [];
    return (
        botState.lastProcessedMessageId === messageId ||
        queue.some((q: any) => q?.messageId === messageId)
    );
}

/** Initial botState for newly created kanban cards. */
export function createQueuedBotState(queueItem: BotQueueItem) {
    return {
        messageQueue: [queueItem],
        status: 'active',
        engine: 'queue',
    };
}
