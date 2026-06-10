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
        if (data.twitterUserId === ourUserId || data.twitterHandle === body.user?.screen_name) {
            tenantRef = doc.ref;
            break;
        }
    }

    if (!tenantRef) {
        const emergencySnap = integrationSnap.docs.find((d) => d.data().status === 'Connected');
        if (emergencySnap) tenantRef = emergencySnap.ref;
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
