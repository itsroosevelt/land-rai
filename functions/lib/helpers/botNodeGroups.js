"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBotNodeLabel = getBotNodeLabel;
exports.getKanbanEligibleNodes = getKanbanEligibleNodes;
exports.orderNodesForKanban = orderNodesForKanban;
exports.getGroupColorForIndex = getGroupColorForIndex;
exports.isInboxLikeGroupName = isInboxLikeGroupName;
exports.resolveCardBotNodeId = resolveCardBotNodeId;
exports.resolveCardBotId = resolveCardBotId;
const TYPE_LABELS = {
    startNode: 'Inicio',
    endNode: 'Fin',
    textMessageNode: 'Mensaje',
    mediaMessageNode: 'Multimedia',
    quickReplyNode: 'Respuesta rápida',
    listMessageNode: 'Lista',
    captureInputNode: 'Capturar entrada',
    conditionNode: 'Condición',
    delayNode: 'Espera',
    humanHandoffNode: 'Agente humano',
    generativeAINode: 'IA',
    setVariableNode: 'Variable',
    webhookNode: 'Webhook',
    locationNode: 'Ubicación',
    templateNode: 'Plantilla',
};
const GROUP_COLORS = [
    'bg-blue-900/40',
    'bg-emerald-900/40',
    'bg-purple-900/40',
    'bg-amber-900/40',
    'bg-cyan-900/40',
    'bg-pink-900/40',
    'bg-indigo-900/40',
    'bg-orange-900/40',
    'bg-teal-900/40',
    'bg-rose-900/40',
];
function getBotNodeLabel(node) {
    const d = node.data || {};
    if (typeof d.label === 'string' && d.label.trim())
        return d.label.trim();
    if (typeof d.kanbanGroupName === 'string' && d.kanbanGroupName.trim())
        return d.kanbanGroupName.trim();
    const text = d.content || d.text || d.body || d.bodyText || d.caption || '';
    if (typeof text === 'string' && text.trim()) {
        const clean = text.trim().replace(/\s+/g, ' ');
        return clean.length > 42 ? `${clean.slice(0, 42)}…` : clean;
    }
    if (node.type === 'captureInputNode' && d.variableName) {
        return `Captura: ${d.variableName}`;
    }
    if (node.type === 'endNode') {
        return d.outcomeLabel || d.label || 'Fin de flujo';
    }
    return TYPE_LABELS[node.type] || node.type;
}
/** Every flow node gets a kanban column so cards track exact bot position. */
function getKanbanEligibleNodes(nodes) {
    return (nodes || []).filter((n) => (n === null || n === void 0 ? void 0 : n.id) && (n === null || n === void 0 ? void 0 : n.type));
}
function orderNodesForKanban(nodes, edges) {
    const nodeMap = new Map(nodes.map((n) => [String(n.id), n]));
    const start = nodes.find((n) => n.type === 'startNode' || n.type === 'start');
    const adj = new Map();
    (edges || []).forEach((edge) => {
        const src = String(edge.source);
        const tgt = String(edge.target);
        if (!adj.has(src))
            adj.set(src, []);
        adj.get(src).push(tgt);
    });
    const visited = new Set();
    const ordered = [];
    const queue = start ? [String(start.id)] : [];
    while (queue.length) {
        const id = queue.shift();
        if (visited.has(id))
            continue;
        visited.add(id);
        const node = nodeMap.get(id);
        if (node)
            ordered.push(node);
        for (const next of adj.get(id) || []) {
            if (!visited.has(next))
                queue.push(next);
        }
    }
    const rest = nodes
        .filter((n) => !visited.has(String(n.id)))
        .sort((a, b) => { var _a, _b; return (((_a = a.position) === null || _a === void 0 ? void 0 : _a.y) || 0) - (((_b = b.position) === null || _b === void 0 ? void 0 : _b.y) || 0) || String(a.id).localeCompare(String(b.id)); });
    return [...ordered, ...rest];
}
function getGroupColorForIndex(index) {
    return GROUP_COLORS[index % GROUP_COLORS.length];
}
function isInboxLikeGroupName(name) {
    const lower = (name || '').toLowerCase();
    return lower.includes('inbox') || lower.includes('bandeja') || lower === 'inicio' || lower.includes('entrada');
}
function resolveCardBotNodeId(cardData) {
    var _a, _b, _c;
    if (!cardData)
        return null;
    const fromState = (_b = (_a = cardData.botState) === null || _a === void 0 ? void 0 : _a.currentNodeId) !== null && _b !== void 0 ? _b : (_c = cardData.chatbotState) === null || _c === void 0 ? void 0 : _c.currentNodeId;
    if (fromState)
        return String(fromState);
    return null;
}
function resolveCardBotId(cardData, fallbackBotId) {
    var _a, _b;
    if (!cardData)
        return fallbackBotId || null;
    return (((_a = cardData.botState) === null || _a === void 0 ? void 0 : _a.botId) ||
        ((_b = cardData.chatbotState) === null || _b === void 0 ? void 0 : _b.botId) ||
        cardData.activeBotId ||
        fallbackBotId ||
        null);
}
//# sourceMappingURL=botNodeGroups.js.map