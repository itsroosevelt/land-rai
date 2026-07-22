"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENTITY_MOLD_VERSION = void 0;
exports.provisionEntityMoldAdmin = provisionEntityMoldAdmin;
exports.ensureEntityMoldUpToDateAdmin = ensureEntityMoldUpToDateAdmin;
const admin = require("firebase-admin");
const manualKanbanColumns_1 = require("./mold/manualKanbanColumns");
/** Mantener alineado con src/lib/mold/entityMold.ts */
exports.ENTITY_MOLD_VERSION = 11;
const ENTITY_MOLD_FEATURES = {
    workspaceHub: true,
    botKanban: true,
    manualKanban: true,
    whatsappOutbound: true,
    whatsappBroadcast: true,
    whatsappMultiNumber: true,
    geminiIntegration: true,
    stripeIntegration: true,
    gmailMultiAccount: true,
    gmailGoogleLoginBootstrap: true,
    integrationsHubV2: true,
    chatbotRulesExport: true,
    chatbotJsonImportExport: true,
};
const MOLD_INTEGRATIONS_INIT = {
    encrypted: false,
    catalogVersion: 2,
    available: ['whatsapp', 'telegram', 'messenger', 'instagram', 'gmail', 'stripe', 'gemini', 'x_twitter'],
    connectable: ['whatsapp', 'messenger', 'instagram', 'telegram', 'x_twitter', 'gmail', 'stripe', 'gemini'],
};
const MOLD_WHATSAPP_MESSAGING = {
    blockOutboundAfter24h: false,
    outboundTemplateName: 'hello_world',
    outboundTemplateLanguage: 'en_US',
    outboundTemplateUsesBodyParam: false,
};
function tenantPath(userId, entityId) {
    return `users/${userId}/entities/${entityId}`;
}
async function ensureManualKanbanInitializedAdmin(db, path) {
    var _a, _b;
    const boardRef = db.doc(`${path}/workspaces/manual_kanban`);
    const columnsCol = boardRef.collection('columns');
    const existingSnap = await columnsCol.get();
    const existing = new Set(existingSnap.docs.map((d) => d.id));
    const batch = db.batch();
    for (const col of manualKanbanColumns_1.MANUAL_KANBAN_COLUMNS) {
        const payload = Object.assign(Object.assign({}, col), { id: col.slug, fixed: true, boardType: 'manual', updatedAt: admin.firestore.FieldValue.serverTimestamp(), sequenceContext: (_a = col.sequenceContext) !== null && _a !== void 0 ? _a : admin.firestore.FieldValue.delete(), actionLogic: (_b = col.actionLogic) !== null && _b !== void 0 ? _b : admin.firestore.FieldValue.delete() });
        if (!existing.has(col.slug)) {
            payload.createdAt = admin.firestore.FieldValue.serverTimestamp();
        }
        batch.set(columnsCol.doc(col.slug), payload, { merge: true });
    }
    await batch.commit();
    await boardRef.set({
        columnOrder: manualKanbanColumns_1.MANUAL_KANBAN_COLUMNS.map((c) => c.slug),
        initialized: true,
        boardType: 'manual',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
}
async function provisionEntityMoldAdmin(db, userId, entityId) {
    const path = tenantPath(userId, entityId);
    await ensureManualKanbanInitializedAdmin(db, path);
    await db.doc(`${path}/integrations/_init`).set(Object.assign(Object.assign({}, MOLD_INTEGRATIONS_INIT), { updatedAt: admin.firestore.FieldValue.serverTimestamp() }), { merge: true });
    await db.doc(path).set({
        moldVersion: exports.ENTITY_MOLD_VERSION,
        features: ENTITY_MOLD_FEATURES,
        whatsappMessaging: MOLD_WHATSAPP_MESSAGING,
        moldProvisionedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
}
async function ensureEntityMoldUpToDateAdmin(db, userId, entityId) {
    var _a, _b;
    const snap = await db.doc(tenantPath(userId, entityId)).get();
    const currentVersion = (_b = (_a = snap.data()) === null || _a === void 0 ? void 0 : _a.moldVersion) !== null && _b !== void 0 ? _b : 0;
    if (currentVersion >= exports.ENTITY_MOLD_VERSION)
        return;
    await provisionEntityMoldAdmin(db, userId, entityId);
}
//# sourceMappingURL=entityMold.js.map