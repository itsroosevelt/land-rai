import * as admin from 'firebase-admin';
import { MANUAL_KANBAN_COLUMNS } from '@/lib/kanban/manualKanbanColumns';
import { ENTITY_MOLD_FEATURES, ENTITY_MOLD_VERSION } from './entityMold';
import { MOLD_WHATSAPP_MESSAGING } from './whatsappMessaging';
import { SYSTEM_INBOX_GROUP_FIELDS, SYSTEM_INBOX_GROUP_ID } from '@/lib/kanban/botNodeGroups';
import {
    STARTER_CHATBOT_COUNTER,
    STARTER_CHATBOT_FIELDS,
    STARTER_CHATBOT_ID,
} from './starterChatbot';

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
    let writes = 0;

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
        writes++;
    }

    if (writes > 0) await batch.commit();

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

async function ensureReceptionColumnAdmin(db: AdminDb, path: string): Promise<void> {
    await db.doc(`${path}/kanban-groups/${SYSTEM_INBOX_GROUP_ID}`).set(
        {
            ...SYSTEM_INBOX_GROUP_FIELDS,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
    );
}

async function ensureStarterChatbotAdmin(db: AdminDb, path: string): Promise<void> {
    const botRef = db.doc(`${path}/chatbots/${STARTER_CHATBOT_ID}`);
    const existing = await botRef.get();
    if (existing.exists) return;

    await botRef.set({
        ...STARTER_CHATBOT_FIELDS,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await db.doc(`${path}/system_metadata/chatbot_counter`).set(
        { count: STARTER_CHATBOT_COUNTER },
        { merge: true }
    );
}

/** Versión servidor del aprovisionamiento del molde (webhooks, API, scripts). */
export async function provisionEntityMoldAdmin(
    db: AdminDb,
    userId: string,
    entityId: string
): Promise<void> {
    const path = tenantPath(userId, entityId);
    await ensureManualKanbanInitializedAdmin(db, path);
    await ensureReceptionColumnAdmin(db, path);
    await ensureStarterChatbotAdmin(db, path);

    await db.doc(path).set(
        {
            moldVersion: ENTITY_MOLD_VERSION,
            features: ENTITY_MOLD_FEATURES,
            whatsappMessaging: MOLD_WHATSAPP_MESSAGING,
            kanbanBotSyncId: STARTER_CHATBOT_ID,
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
