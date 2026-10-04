import { admin, db } from '@/lib/firebase-admin';

export interface TwitterTenant {
    userId: string;
    entityId: string;
    entityPath: string;
    ourUserId: string;
}

/** Resolves Roosevelt tenant from X Account Activity payload. */
export async function resolveTwitterTenant(body: Record<string, any>): Promise<TwitterTenant | null> {
    const ourUserId = String(body.for_user_id || '');
    if (!ourUserId) return null;

    const integrationSnap = await db.collectionGroup('integrations')
        .where('provider', '==', 'x_twitter')
        .get();

    let tenantRef: admin.firestore.DocumentReference | null = null;

    for (const doc of integrationSnap.docs) {
        const data = doc.data();
        const screenName = body.user?.screen_name ? String(body.user.screen_name) : '';
        // Exigir valores reales: `undefined === undefined` haría coincidir con cualquier tenant.
        const matchesId = !!data.twitterUserId && String(data.twitterUserId) === ourUserId;
        const matchesHandle = !!screenName && !!data.twitterHandle && String(data.twitterHandle) === screenName;
        if (matchesId || matchesHandle) {
            tenantRef = doc.ref;
            break;
        }
    }

    if (!tenantRef) return null;

    const pathParts = tenantRef.path.split('/');
    const userId = pathParts[pathParts.indexOf('users') + 1];
    const entityId = pathParts[pathParts.indexOf('entities') + 1];

    return {
        userId,
        entityId,
        entityPath: `users/${userId}/entities/${entityId}`,
        ourUserId,
    };
}
