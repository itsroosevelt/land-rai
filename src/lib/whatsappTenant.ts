import { db, admin } from '@/lib/firebase-admin';

export interface WhatsAppTenantContext {
    userId: string;
    entityId: string;
}

/** Digits-only WhatsApp sender id (Meta `message.from`). */
export function cleanWhatsAppSenderId(from: string): string {
    return String(from || '').replace(/\D/g, '');
}

/** Phone values used in CRM `contacts.phone` (with/without +). */
export function phoneLookupVariants(cleanFrom: string): string[] {
    if (!cleanFrom) return [];
    const variants = new Set<string>([`+${cleanFrom}`, cleanFrom]);
    return Array.from(variants);
}

function parseTenantFromIntegrationPath(path: string): WhatsAppTenantContext | null {
    const parts = path.split('/');
    const uIdx = parts.indexOf('users');
    const eIdx = parts.indexOf('entities');
    if (uIdx === -1 || eIdx === -1) return null;
    const userId = parts[uIdx + 1];
    const entityId = parts[eIdx + 1];
    if (!userId || !entityId) return null;
    return { userId, entityId };
}

async function queryIntegrationsByPhoneId(phoneId: string | number): Promise<WhatsAppTenantContext | null> {
    const candidates: Array<string | number> = [String(phoneId)];
    const numeric = Number(phoneId);
    if (!Number.isNaN(numeric)) candidates.push(numeric);

    for (const id of candidates) {
        try {
            const snap = await db.collectionGroup('integrations')
                .where('phoneNumberId', '==', id)
                .limit(1)
                .get();
            if (!snap.empty) {
                const parsed = parseTenantFromIntegrationPath(snap.docs[0].ref.path);
                if (parsed) return parsed;
            }
        } catch (e) {
            console.warn('[WhatsApp Tenant] phoneNumberId lookup failed:', e);
        }

        try {
            const snap = await db.collectionGroup('integrations')
                .where('phone_number_id', '==', id)
                .limit(1)
                .get();
            if (!snap.empty) {
                const parsed = parseTenantFromIntegrationPath(snap.docs[0].ref.path);
                if (parsed) return parsed;
            }
        } catch (e) {
            console.warn('[WhatsApp Tenant] phone_number_id lookup failed:', e);
        }

        // MULTI-NUMBER: connected slot numbers live in `whatsapp_numbers/{slot}`.
        try {
            const snap = await db.collectionGroup('whatsapp_numbers')
                .where('phoneNumberId', '==', id)
                .limit(1)
                .get();
            if (!snap.empty) {
                const parsed = parseTenantFromIntegrationPath(snap.docs[0].ref.path);
                if (parsed) return parsed;
            }
        } catch (e) {
            console.warn('[WhatsApp Tenant] whatsapp_numbers lookup failed:', e);
        }
    }

    return null;
}

/** Persists a global fallback map used when collectionGroup lookup is unavailable. */
export async function registerWhatsAppTenantMapping(
    phoneNumberId: string,
    userId: string,
    entityId: string
): Promise<void> {
    if (!phoneNumberId || !userId || !entityId) return;
    const payload = {
        userId,
        entityId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    const ids = new Set<string>([String(phoneNumberId)]);
    const numeric = Number(phoneNumberId);
    if (!Number.isNaN(numeric)) ids.add(String(numeric));

    await Promise.all(
        Array.from(ids).map((id) =>
            db.doc(`system_mappings/whatsapp_numbers/numbers/${id}`).set(payload, { merge: true })
        )
    );
}

/**
 * Resolves { userId, entityId } for an inbound WhatsApp Cloud API webhook.
 */
export async function resolveWhatsAppTenant(
    recipientPhoneNumberId: string | undefined,
    urlUserId?: string | null,
    urlEntityId?: string | null
): Promise<WhatsAppTenantContext | null> {
    if (urlUserId && urlEntityId) {
        return { userId: urlUserId, entityId: urlEntityId };
    }

    if (!recipientPhoneNumberId) return null;

    const fromIntegrations = await queryIntegrationsByPhoneId(recipientPhoneNumberId);
    if (fromIntegrations) return fromIntegrations;

    try {
        const mappingRef = db.doc(
            `system_mappings/whatsapp_numbers/numbers/${recipientPhoneNumberId}`
        );
        const mappingDoc = await mappingRef.get();
        if (mappingDoc.exists) {
            const legacy = mappingDoc.data() as { userId?: string; entityId?: string };
            if (legacy?.userId && legacy?.entityId) {
                return { userId: legacy.userId, entityId: legacy.entityId };
            }
        }
    } catch (e) {
        console.warn('[WhatsApp Tenant] system_mappings lookup failed:', e);
    }

    return null;
}
