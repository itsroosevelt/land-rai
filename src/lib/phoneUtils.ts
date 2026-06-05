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

