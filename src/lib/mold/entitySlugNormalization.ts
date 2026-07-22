/**
 * Entity route slug mold helpers (client Firestore SDK).
 * Backfills `slug` + `entity_slugs` index for tenants created before slug URLs.
 */
import { doc, getDoc, setDoc, serverTimestamp, type Firestore } from 'firebase/firestore';
import { claimEntitySlug, generateUniqueEntitySlug } from '@/lib/entitySlug';

export async function ensureEntitySlugNormalization(
    db: Firestore,
    userId: string,
    entityId: string
): Promise<void> {
    const entityRef = doc(db, `users/${userId}/entities/${entityId}`);
    const snap = await getDoc(entityRef);
    if (!snap.exists()) return;

    const data = snap.data() || {};
    const existingSlug = String(data.slug || '').trim().toLowerCase();

    if (existingSlug) {
        await claimEntitySlug(userId, entityId, existingSlug);
        return;
    }

    const slug = await generateUniqueEntitySlug(
        userId,
        String(data.name || entityId),
        entityId
    );

    await setDoc(
        entityRef,
        {
            slug,
            updatedAt: serverTimestamp(),
        },
        { merge: true }
    );
    await claimEntitySlug(userId, entityId, slug);
}
