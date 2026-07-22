"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.locateKanbanCard = locateKanbanCard;
exports.ensureCardKanbanPlacement = ensureCardKanbanPlacement;
exports.buildBotNodeGroupMap = buildBotNodeGroupMap;
exports.syncKanbanGroupsFromBotAdmin = syncKanbanGroupsFromBotAdmin;
exports.syncCardToBotNodeAdmin = syncCardToBotNodeAdmin;
exports.relocateAllCardsToBotNodesAdmin = relocateAllCardsToBotNodesAdmin;
const admin = require("firebase-admin");
const botNodeGroups_1 = require("./botNodeGroups");
async function moveKanbanCardAdmin(db, tenantPath, cardId, sourceGroupId, destGroupId) {
    if (!sourceGroupId || !destGroupId || sourceGroupId === destGroupId)
        return;
    const sourceRef = db.doc(`${tenantPath}/kanban-groups/${sourceGroupId}/cards/${cardId}`);
    const destRef = db.doc(`${tenantPath}/kanban-groups/${destGroupId}/cards/${cardId}`);
    let contactId;
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(sourceRef);
        if (!snap.exists)
            return;
        const data = snap.data() || {};
        contactId = (data.contactId || data.crmId);
        tx.set(destRef, Object.assign(Object.assign({}, data), { groupId: destGroupId, updatedAt: admin.firestore.FieldValue.serverTimestamp() }));
        tx.delete(sourceRef);
    });
    if (contactId) {
        await db.doc(`${tenantPath}/contacts/${contactId}`).set({
            kanbanGroupId: destGroupId,
            kanbanCardId: cardId,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true }).catch(() => undefined);
    }
}
async function locateKanbanCard(db, tenantPath, cardId) {
    const groupsSnap = await db.collection(`${tenantPath}/kanban-groups`).get();
    for (const groupDoc of groupsSnap.docs) {
        const cardRef = groupDoc.ref.collection('cards').doc(cardId);
        const snap = await cardRef.get();
        if (snap.exists) {
            return { groupId: groupDoc.id, ref: cardRef };
        }
    }
    return null;
}
async function ensureCardKanbanPlacement(params) {
    var _a;
    const { db, tenantPath, cardId, botId, preferredGroupId } = params;
    // Regla de oro: el bot no altera posición en el tablero manual
    const manualPlacementRef = db.doc(`${tenantPath}/workspaces/manual_kanban/placements/${cardId}`);
    const manualPlacementSnap = await manualPlacementRef.get();
    if (manualPlacementSnap.exists && ((_a = manualPlacementSnap.data()) === null || _a === void 0 ? void 0 : _a.manualLocked)) {
        return null;
    }
    let groupId = preferredGroupId;
    let cardSnap = preferredGroupId
        ? await db.doc(`${tenantPath}/kanban-groups/${preferredGroupId}/cards/${cardId}`).get()
        : null;
    if (!(cardSnap === null || cardSnap === void 0 ? void 0 : cardSnap.exists)) {
        const located = await locateKanbanCard(db, tenantPath, cardId);
        if (!located)
            return null;
        groupId = located.groupId;
        cardSnap = await located.ref.get();
    }
    const data = cardSnap === null || cardSnap === void 0 ? void 0 : cardSnap.data();
    const nodeId = (0, botNodeGroups_1.resolveCardBotNodeId)(data);
    if (!nodeId || !groupId)
        return groupId || null;
    const nodeGroupMap = await buildBotNodeGroupMap(db, tenantPath, botId);
    return syncCardToBotNodeAdmin({
        db,
        tenantPath,
        cardId,
        currentGroupId: groupId,
        botId,
        nodeId,
        nodeGroupMap,
    });
}
async function buildBotNodeGroupMap(db, tenantPath, botId) {
    const snap = await db.collection(`${tenantPath}/kanban-groups`).where('botId', '==', botId).get();
    const map = new Map();
    snap.docs.forEach((doc) => {
        const nodeId = doc.data().botNodeId;
        if (nodeId)
            map.set(String(nodeId), doc.id);
    });
    return map;
}
async function syncKanbanGroupsFromBotAdmin(params) {
    var _a, _b;
    const { db, tenantPath, botId, botName, flow } = params;
    const nodes = (0, botNodeGroups_1.getKanbanEligibleNodes)((flow === null || flow === void 0 ? void 0 : flow.nodes) || []);
    const ordered = (0, botNodeGroups_1.orderNodesForKanban)(nodes, (flow === null || flow === void 0 ? void 0 : flow.edges) || []);
    const groupsRef = db.collection(`${tenantPath}/kanban-groups`);
    const existingSnap = await groupsRef.get();
    const existing = existingSnap.docs.map((d) => (Object.assign({ id: d.id }, d.data())));
    const byBotNodeId = new Map();
    const manualGroups = [];
    existing.forEach((g) => {
        if (g.botId === botId && g.botNodeId) {
            byBotNodeId.set(String(g.botNodeId), { id: g.id, data: g });
        }
        else if (!g.autoManaged) {
            manualGroups.push({ id: g.id, data: g });
        }
    });
    let created = 0;
    let updated = 0;
    let linked = 0;
    const nodeGroupMap = {};
    const seenNodeIds = new Set();
    for (let i = 0; i < ordered.length; i++) {
        const node = ordered[i];
        const nodeId = String(node.id);
        seenNodeIds.add(nodeId);
        const nodeDetails = (0, botNodeGroups_1.extractBotNodeDetails)(node);
        const name = nodeDetails.title || (0, botNodeGroups_1.getBotNodeLabel)(node);
        const color = (0, botNodeGroups_1.getGroupColorForIndex)(i);
        const payload = {
            name,
            color,
            order: i,
            botId,
            botNodeId: nodeId,
            botNodeType: node.type,
            botNodeDetails: nodeDetails,
            autoManaged: true,
            boardType: 'bot',
            botName: botName || null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        const existingGroup = byBotNodeId.get(nodeId);
        if (existingGroup) {
            await groupsRef.doc(existingGroup.id).set(payload, { merge: true });
            nodeGroupMap[nodeId] = existingGroup.id;
            updated++;
            continue;
        }
        if (node.type === 'startNode' || node.type === 'start') {
            const inbox = manualGroups.find((g) => { var _a; return (0, botNodeGroups_1.isInboxLikeGroupName)(((_a = g.data) === null || _a === void 0 ? void 0 : _a.name) || ''); });
            if (inbox) {
                await groupsRef.doc(inbox.id).set(Object.assign(Object.assign({}, payload), { order: (_b = (_a = inbox.data) === null || _a === void 0 ? void 0 : _a.order) !== null && _b !== void 0 ? _b : 0 }), { merge: true });
                nodeGroupMap[nodeId] = inbox.id;
                linked++;
                continue;
            }
        }
        const createdRef = await groupsRef.add(Object.assign(Object.assign({}, payload), { createdAt: admin.firestore.FieldValue.serverTimestamp() }));
        nodeGroupMap[nodeId] = createdRef.id;
        created++;
    }
    let removed = 0;
    for (const g of existing) {
        if (g.botId === botId && g.autoManaged && g.botNodeId && !seenNodeIds.has(String(g.botNodeId))) {
            await groupsRef.doc(g.id).delete();
            removed++;
        }
    }
    await db.doc(tenantPath).set({
        kanbanBotSyncId: botId,
        kanbanBotSyncName: botName || null,
        kanbanBotSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    return { botId, created, updated, linked, removed, nodeGroupMap };
}
async function syncCardToBotNodeAdmin(params) {
    var _a, _b;
    const { db, tenantPath, cardId, currentGroupId, botId, nodeId } = params;
    if (!nodeId || !botId || !cardId || !currentGroupId)
        return null;
    let targetGroupId;
    if (params.nodeGroupMap) {
        targetGroupId = params.nodeGroupMap.get(String(nodeId));
    }
    if (!targetGroupId) {
        const snap = await db
            .collection(`${tenantPath}/kanban-groups`)
            .where('botId', '==', botId)
            .where('botNodeId', '==', String(nodeId))
            .limit(1)
            .get();
        if (snap.empty)
            return null;
        targetGroupId = snap.docs[0].id;
    }
    if (!targetGroupId || targetGroupId === currentGroupId)
        return targetGroupId || null;
    const destGroupSnap = await db.doc(`${tenantPath}/kanban-groups/${targetGroupId}`).get();
    if (!destGroupSnap.exists || ((_a = destGroupSnap.data()) === null || _a === void 0 ? void 0 : _a.boardType) === 'manual' || ((_b = destGroupSnap.data()) === null || _b === void 0 ? void 0 : _b.autoManaged) === false) {
        return currentGroupId;
    }
    await moveKanbanCardAdmin(db, tenantPath, cardId, currentGroupId, targetGroupId);
    return targetGroupId;
}
async function relocateAllCardsToBotNodesAdmin(params) {
    const { db, tenantPath, botId, flow } = params;
    const syncResult = await syncKanbanGroupsFromBotAdmin({ db, tenantPath, botId, flow });
    const nodeGroupMap = new Map(Object.entries(syncResult.nodeGroupMap));
    const startNode = ((flow === null || flow === void 0 ? void 0 : flow.nodes) || []).find((n) => n.type === 'startNode' || n.type === 'start');
    const startNodeId = startNode ? String(startNode.id) : null;
    const groupsSnap = await db.collection(`${tenantPath}/kanban-groups`).get();
    let moved = 0;
    let skipped = 0;
    for (const groupDoc of groupsSnap.docs) {
        const cardsSnap = await groupDoc.ref.collection('cards').get();
        for (const cardDoc of cardsSnap.docs) {
            const data = cardDoc.data();
            const nodeId = (0, botNodeGroups_1.resolveCardBotNodeId)(data);
            const cardBotId = (0, botNodeGroups_1.resolveCardBotId)(data, botId) || botId;
            if (!nodeId || cardBotId !== botId) {
                skipped++;
                continue;
            }
            let targetGroupId = nodeGroupMap.get(String(nodeId));
            if (!targetGroupId || targetGroupId === groupDoc.id) {
                skipped++;
                continue;
            }
            await moveKanbanCardAdmin(db, tenantPath, cardDoc.id, groupDoc.id, targetGroupId);
            moved++;
        }
    }
    return { moved, skipped, startNodeId };
}
//# sourceMappingURL=kanbanBotSync.js.map