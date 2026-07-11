import { doc, getDoc, setDoc, serverTimestamp, Firestore } from 'firebase/firestore';
import { ensureManualKanbanInitialized } from '@/lib/kanban/manualKanban';
import { MOLD_WHATSAPP_MESSAGING } from './whatsappMessaging';
import { SYSTEM_INBOX_GROUP_FIELDS, SYSTEM_INBOX_GROUP_ID } from '@/lib/kanban/botNodeGroups';

/** Incrementar cuando el molde multitenant gane nuevas estructuras obligatorias. */
export const ENTITY_MOLD_VERSION = 5;

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
 * Columna de recepción permanente en `kanban-groups`. Siempre debe existir para que los
 * mensajes lleguen aunque el bot esté apagado. Idempotente.
 */
async function ensureReceptionColumn(db: Firestore, path: string): Promise<void> {
    await setDoc(
        doc(db, `${path}/kanban-groups`, SYSTEM_INBOX_GROUP_ID),
        {
            ...SYSTEM_INBOX_GROUP_FIELDS,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        },
        { merge: true }
    );
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
    await ensureReceptionColumn(db, path);

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
