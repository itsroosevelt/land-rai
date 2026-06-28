import * as admin from 'firebase-admin';
import { MANUAL_KANBAN_COLUMNS } from './mold/manualKanbanColumns';

export const ENTITY_MOLD_VERSION = 2;

const ENTITY_MOLD_FEATURES = {
    workspaceHub: true,
    botKanban: true,
    manualKanban: true,
} as const;

type AdminDb = admin.firestore.Firestore;

function tenantPath(userId: string, entityId: string) {
    return `users/${userId}/entities/${entityId}`;
}

async function ensureManualKanbanInitializedAdmin(db: AdminDb, path: string): Promise<void> {
    const boardRef = db.doc(`${path}/workspaces/manual_kanban`);
    const columnsCol = boardRef.collection('columns');
    const existingSnap = await columnsCol.get();
    const existing = new Set(existingSnap.docs.map((d) => d.id));

    const batch = db.batch();

    for (const col of MANUAL_KANBAN_COLUMNS) {
        const payload: Record<string, unknown> = {
            ...col,
            id: col.slug,
            fixed: true,
            boardType: 'manual',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            sequenceContext: col.sequenceContext ?? admin.firestore.FieldValue.delete(),
            actionLogic: col.actionLogic ?? admin.firestore.FieldValue.delete(),
        };
        if (!existing.has(col.slug)) {
            payload.createdAt = admin.firestore.FieldValue.serverTimestamp();
        }
        batch.set(columnsCol.doc(col.slug), payload, { merge: true });
    }

    await batch.commit();

    await boardRef.set(
        {
            columnOrder: MANUAL_KANBAN_COLUMNS.map((c) => c.slug),
            initialized: true,
            boardType: 'manual',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
    );
}

export async function provisionEntityMoldAdmin(
    db: AdminDb,
    userId: string,
    entityId: string
): Promise<void> {
    const path = tenantPath(userId, entityId);
    await ensureManualKanbanInitializedAdmin(db, path);

    await db.doc(path).set(
        {
            moldVersion: ENTITY_MOLD_VERSION,
            features: ENTITY_MOLD_FEATURES,
            moldProvisionedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
    );
}

export async function ensureEntityMoldUpToDateAdmin(
    db: AdminDb,
    userId: string,
    entityId: string
): Promise<void> {
    const snap = await db.doc(tenantPath(userId, entityId)).get();
    const currentVersion = snap.data()?.moldVersion ?? 0;
    if (currentVersion >= ENTITY_MOLD_VERSION) return;
    await provisionEntityMoldAdmin(db, userId, entityId);
}
