/**
 * Extracts user-visible text and whether the payload should be ingested.
 */
export function extractWhatsAppInboundText(message: any): { text: string; shouldProcess: boolean } {
    if (!message) return { text: '', shouldProcess: false };

    let text = message.text?.body || '';

    if (message.type === 'interactive') {
        const interactive = message.interactive;
        text =
            interactive?.button_reply?.id ||
            interactive?.list_reply?.id ||
            interactive?.button_reply?.title ||
            interactive?.list_reply?.title ||
            '';
    } else if (message.type === 'button') {
        text = message.button?.payload || message.button?.text || '';
    } else if (message.type === 'image' || message.type === 'document' || message.type === 'video') {
        text = `[Archivo ${message.type}]`;
    } else if (message.type === 'audio' || message.type === 'voice') {
        text = '[Audio]';
    } else if (message.type === 'sticker') {
        text = '[Sticker]';
    } else if (message.type === 'location') {
        text = '[Ubicación]';
    } else if (message.type === 'contacts') {
        text = '[Contacto compartido]';
    }

    const trimmed = String(text || '').trim();
    const shouldProcess = trimmed.length > 0 || ['image', 'document', 'video', 'audio', 'voice', 'sticker', 'interactive', 'button', 'location', 'contacts'].includes(message.type);

    return { text: trimmed || (shouldProcess ? `[${message.type || 'mensaje'}]` : ''), shouldProcess };
}
