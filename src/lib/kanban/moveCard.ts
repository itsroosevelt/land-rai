import {
    doc,
    runTransaction,
    updateDoc,
    arrayUnion,
    serverTimestamp,
    Firestore,
} from 'firebase/firestore';

export interface MoveKanbanCardParams {
    db: Firestore;
    tenantPath: string;
    cardId: string;
    sourceGroupId: string;
    destGroupId: string;
    historyEntry?: Record<string, unknown>;
}

/**
 * Move a kanban card between groups without losing data.
 * Copies the full document, updates groupId, then deletes the source.
 */
export async function moveKanbanCard({
    db,
    tenantPath,
    cardId,
    sourceGroupId,
    destGroupId,
    historyEntry,
}: MoveKanbanCardParams): Promise<void> {
    if (sourceGroupId === destGroupId) return;

    const sourceRef = doc(db, `${tenantPath}/kanban-groups/${sourceGroupId}/cards/${cardId}`);
    const destRef = doc(db, `${tenantPath}/kanban-groups/${destGroupId}/cards/${cardId}`);

    let contactId: string | undefined;

    await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(sourceRef);
        if (!snap.exists()) {
            throw new Error('CARD_NOT_FOUND');
        }

        const data = snap.data();
        contactId = data.contactId || data.crmId;

        transaction.set(destRef, {
            ...data,
            groupId: destGroupId,
            updatedAt: serverTimestamp(),
        });
        transaction.delete(sourceRef);
    });

    const followUps: Promise<unknown>[] = [];

    if (historyEntry) {
        followUps.push(updateDoc(destRef, { history: arrayUnion(historyEntry) }));
    }

    if (contactId) {
        const contactRef = doc(db, `${tenantPath}/contacts/${contactId}`);
        followUps.push(
            updateDoc(contactRef, {
                kanbanGroupId: destGroupId,
                kanbanCardId: cardId,
                updatedAt: serverTimestamp(),
            }).catch(() => undefined)
        );
    }

    await Promise.all(followUps);
}
