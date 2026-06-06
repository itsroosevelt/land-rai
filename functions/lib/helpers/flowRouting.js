"use strict";
/**
 * Shared flow routing utilities (mirrors src/lib/flowRouting.ts for Firebase Functions).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WHATSAPP_BUTTON_TITLE_MAX = exports.WHATSAPP_REPLY_ID_MAX = void 0;
exports.normalizeFlowInput = normalizeFlowInput;
exports.getButtonRouteId = getButtonRouteId;
exports.getWhatsAppReplyId = getWhatsAppReplyId;
exports.inputsMatch = inputsMatch;
exports.getButtonMatchCandidates = getButtonMatchCandidates;
exports.matchQuickReplyButton = matchQuickReplyButton;
exports.matchListRow = matchListRow;
exports.edgeHandleMatches = edgeHandleMatches;
exports.resolveEdgeForSelection = resolveEdgeForSelection;
exports.resolveQuickReplyEdge = resolveQuickReplyEdge;
exports.resolveListMessageEdge = resolveListMessageEdge;
exports.buildWhatsAppQuickReplyButtons = buildWhatsAppQuickReplyButtons;
exports.sanitizeFlowButtons = sanitizeFlowButtons;
exports.WHATSAPP_REPLY_ID_MAX = 256;
exports.WHATSAPP_BUTTON_TITLE_MAX = 20;
function normalizeFlowInput(text) {
    return (text || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}
function getButtonRouteId(button) {
    if (!button)
        return '';
    if (typeof button === 'string')
        return button.trim();
    return String(button.payload || button.id || button.title || '').trim();
}
function getWhatsAppReplyId(button) {
    var _a;
    if (!button)
        return '';
    if (typeof button === 'string')
        return button.trim().substring(0, exports.WHATSAPP_REPLY_ID_MAX);
    if ((_a = button.payload) === null || _a === void 0 ? void 0 : _a.trim()) {
        return button.payload.trim().substring(0, exports.WHATSAPP_REPLY_ID_MAX);
    }
    return getButtonRouteId(button).substring(0, exports.WHATSAPP_REPLY_ID_MAX);
}
function inputsMatch(userText, candidate) {
    if (!candidate || userText === undefined || userText === null)
        return false;
    const u = String(userText).trim();
    const c = String(candidate).trim();
    if (!u || !c)
        return false;
    if (u === c)
        return true;
    if (normalizeFlowInput(u) === normalizeFlowInput(c))
        return true;
    const uLow = u.toLowerCase();
    const cLow = c.toLowerCase();
    if (uLow.length >= 8 && (cLow.startsWith(uLow) || uLow.startsWith(cLow)))
        return true;
    return false;
}
function getButtonMatchCandidates(button) {
    if (!button)
        return [];
    if (typeof button === 'string')
        return [button];
    const raw = [
        button.payload,
        button.id,
        button.title,
        getButtonRouteId(button),
        getWhatsAppReplyId(button),
    ]
        .filter((v) => v !== undefined && v !== null && String(v).trim() !== '')
        .map(String);
    return [...new Set(raw)];
}
function matchQuickReplyButton(buttons, userText) {
    if (!(buttons === null || buttons === void 0 ? void 0 : buttons.length) || !String(userText || '').trim())
        return null;
    return (buttons.find((btn) => getButtonMatchCandidates(btn).some((candidate) => inputsMatch(userText, candidate))) || null);
}
function matchListRow(sections, userText) {
    for (const sec of sections || []) {
        const rows = sec.rows || sec.options || [];
        for (const row of rows) {
            const rowObj = typeof row === 'object' && row !== null ? row : { id: String(row), title: String(row) };
            const candidates = getButtonMatchCandidates(rowObj);
            if (candidates.some((c) => inputsMatch(userText, c))) {
                return { row: rowObj, handleCandidates: candidates };
            }
        }
    }
    return null;
}
function edgeHandleMatches(sourceHandle, candidates) {
    const handle = String(sourceHandle || '').trim();
    if (!handle)
        return false;
    return candidates.some((c) => inputsMatch(handle, c));
}
function resolveEdgeForSelection(edges, sourceNodeId, handleCandidates) {
    const outgoing = (edges || []).filter((e) => String(e.source) === String(sourceNodeId));
    if (!outgoing.length || !handleCandidates.length)
        return null;
    for (const candidate of handleCandidates) {
        const exact = outgoing.find((e) => String(e.sourceHandle || '') === candidate);
        if (exact)
            return exact;
    }
    for (const edge of outgoing) {
        if (edgeHandleMatches(edge.sourceHandle, handleCandidates))
            return edge;
    }
    return null;
}
function resolveQuickReplyEdge(edges, sourceNodeId, buttons, userText) {
    const sanitized = (buttons || []).filter((b) => { var _a; return b && (typeof b === 'string' || ((_a = b.title) === null || _a === void 0 ? void 0 : _a.trim()) || b.id || b.payload); });
    if (!sanitized.length) {
        const outgoing = (edges || []).filter((e) => String(e.source) === String(sourceNodeId));
        const defaultEdge = outgoing.find((e) => !e.sourceHandle) || outgoing[0] || null;
        return { edge: defaultEdge, matchedButton: null, invalid: false, missingEdge: false };
    }
    const matchedButton = matchQuickReplyButton(sanitized, userText);
    if (!matchedButton) {
        return { edge: null, matchedButton: null, invalid: true, missingEdge: false };
    }
    const candidates = getButtonMatchCandidates(matchedButton);
    const edge = resolveEdgeForSelection(edges, sourceNodeId, candidates);
    return {
        edge,
        matchedButton,
        invalid: false,
        missingEdge: !edge,
    };
}
function resolveListMessageEdge(edges, sourceNodeId, sections, userText) {
    const sanitized = sections || [];
    if (!sanitized.length) {
        const outgoing = (edges || []).filter((e) => String(e.source) === String(sourceNodeId));
        const defaultEdge = outgoing.find((e) => !e.sourceHandle) || outgoing[0] || null;
        return { edge: defaultEdge, matchedButton: null, invalid: false, missingEdge: false };
    }
    const match = matchListRow(sanitized, userText);
    if (!match) {
        return { edge: null, matchedButton: null, invalid: true, missingEdge: false };
    }
    const edge = resolveEdgeForSelection(edges, sourceNodeId, match.handleCandidates);
    return {
        edge,
        matchedButton: match.row,
        invalid: false,
        missingEdge: !edge,
    };
}
function buildWhatsAppQuickReplyButtons(buttons) {
    return (buttons || []).slice(0, 3).map((b) => {
        const base = typeof b === 'string' ? { title: b, payload: b } : b;
        const title = String(base.title || base).substring(0, exports.WHATSAPP_BUTTON_TITLE_MAX);
        const id = getWhatsAppReplyId(base);
        return { type: 'reply', reply: { id, title } };
    });
}
function sanitizeFlowButtons(buttons) {
    if (!Array.isArray(buttons))
        return [];
    return buttons.filter((b) => b && (typeof b === 'string' || (b.title && b.title !== 'undefined' && String(b.title).trim() !== '')));
}
//# sourceMappingURL=flowRouting.js.map