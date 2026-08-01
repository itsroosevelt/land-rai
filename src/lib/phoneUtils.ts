/**
 * Normalizes a phone number to the international format.
 * Currently defaults to Ecuador (+593) if no country code is present.
 */
export const normalizePhoneNumber = (phone: string): string => {
    if (!phone) return '';

    const trimmed = phone.trim();
    if (trimmed.startsWith('+')) {
        const digits = trimmed.replace(/\D/g, '');
        return digits ? `+${digits}` : '';
    }

    let clean = trimmed.replace(/\D/g, '');
    if (!clean) return '';

    // International numbers from Meta/WhatsApp already include country code (>10 digits).
    if (clean.length > 10) {
        return `+${clean}`;
    }

    // North America without leading country digit in some legacy imports.
    if (clean.length === 10 && clean.startsWith('1') === false) {
        return `+1${clean}`;
    }

    // Ecuador local numbers only when clearly local length (avoid mis-tagging foreign short codes).
    if (clean.length >= 9 && clean.length <= 10) {
        if (clean.startsWith('0')) {
            clean = clean.substring(1);
        }
        return `+593${clean}`;
    }

    return `+${clean}`;
};

/** Digit keys for broadcast_reply_index (send + webhook must use the same set). */
export function phoneReplyIndexKeys(phone: string): string[] {
    const digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return [];

    const keys = new Set<string>([digits]);

    // Mexico: Meta often sends 521… while CRM stores 52… (or the reverse).
    if (digits.length === 13 && digits.startsWith('521')) {
        keys.add(`52${digits.slice(3)}`);
    } else if (digits.length === 12 && digits.startsWith('52')) {
        keys.add(`521${digits.slice(2)}`);
    }

    // Argentina mobile: 549… vs 54…
    if (digits.length === 13 && digits.startsWith('549')) {
        keys.add(`54${digits.slice(3)}`);
    } else if (digits.length === 12 && digits.startsWith('54') && !digits.startsWith('549')) {
        keys.add(`549${digits.slice(2)}`);
    }

    return Array.from(keys);
}

/** All digit/+digit variants for CRM lookup (contacts, conversations, kanban cards). */
export function phoneSearchVariants(phone: string): string[] {
    const keys = phoneReplyIndexKeys(phone);
    const variants = new Set<string>();
    keys.forEach((digits) => {
        variants.add(digits);
        variants.add(`+${digits}`);
    });
    return Array.from(variants);
}

