import { doc, getDoc, setDoc, serverTimestamp, Firestore } from 'firebase/firestore';
import { ensureManualKanbanInitialized } from '@/lib/kanban/manualKanban';
import { MOLD_WHATSAPP_MESSAGING } from './whatsappMessaging';

/** Incrementar cuando el molde multitenant gane nuevas estructuras obligatorias. */
export const ENTITY_MOLD_VERSION = 4;

export const ENTITY_MOLD_FEATURES = {
    workspaceHub: true,
    botKanban: true,
    manualKanban: true,
    whatsappOutbound: true,
    whatsappBroadcast: true,
} as const;

function tenantPath(userId: string, entityId: string) {
    return `users/${userId}/entities/${entityId}`;
}

/**
 * Aprovisiona estructuras CRM/Kanban del molde maestro para una empresa (tenant).
 * Idempotente — seguro llamar varias veces.
 */
export async function provisionEntityMold(
    db: Firestore,
    userId: string,
    entityId: string
): Promise<void> {
    const path = tenantPath(userId, entityId);

    await ensureManualKanbanInitialized(db, path);

    await setDoc(
        doc(db, path),
        {
            moldVersion: ENTITY_MOLD_VERSION,
            features: ENTITY_MOLD_FEATURES,
            whatsappMessaging: MOLD_WHATSAPP_MESSAGING,
            moldProvisionedAt: serverTimestamp(),
        },
        { merge: true }
    );
}

/**
 * Migra empresas existentes al molde actual (p. ej. creadas antes del Hub/Kanban manual).
 */
export async function ensureEntityMoldUpToDate(
    db: Firestore,
    userId: string,
    entityId: string
): Promise<void> {
    const entityRef = doc(db, tenantPath(userId, entityId));
    const snap = await getDoc(entityRef);
    const currentVersion = snap.data()?.moldVersion ?? 0;

    if (currentVersion >= ENTITY_MOLD_VERSION) return;

    await provisionEntityMold(db, userId, entityId);
}
