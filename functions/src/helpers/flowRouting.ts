/**
 * Shared flow routing utilities (mirrors src/lib/flowRouting.ts for Firebase Functions).
 */

export const WHATSAPP_REPLY_ID_MAX = 256;
export const WHATSAPP_BUTTON_TITLE_MAX = 20;

export function normalizeFlowInput(text: string): string {
    return (text || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

export function getButtonRouteId(button: any): string {
    if (!button) return '';
    if (typeof button === 'string') return button.trim();
    return String(button.payload || button.id || button.title || '').trim();
}

export function getWhatsAppReplyId(button: any): string {
    if (!button) return '';
    if (typeof button === 'string') return button.trim().substring(0, WHATSAPP_REPLY_ID_MAX);
    if (button.payload?.trim()) {
        return button.payload.trim().substring(0, WHATSAPP_REPLY_ID_MAX);
    }
    return getButtonRouteId(button).substring(0, WHATSAPP_REPLY_ID_MAX);
}

export function inputsMatch(userText: string, candidate: string): boolean {
    if (!candidate || userText === undefined || userText === null) return false;

    const u = String(userText).trim();
    const c = String(candidate).trim();
    if (!u || !c) return false;

    if (u === c) return true;
    if (normalizeFlowInput(u) === normalizeFlowInput(c)) return true;

    const uLow = u.toLowerCase();
    const cLow = c.toLowerCase();

    if (uLow.length >= 8 && (cLow.startsWith(uLow) || uLow.startsWith(cLow))) return true;

    return false;
}

export function getButtonMatchCandidates(button: any): string[] {
    if (!button) return [];
    if (typeof button === 'string') return [button];

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

export function matchQuickReplyButton(buttons: any[], userText: string): any | null {
    if (!buttons?.length || !String(userText || '').trim()) return null;

    return (
        buttons.find((btn) =>
            getButtonMatchCandidates(btn).some((candidate) => inputsMatch(userText, candidate))
        ) || null
    );
}

export function matchListRow(
    sections: any[],
    userText: string
): { row: any; handleCandidates: string[] } | null {
    for (const sec of sections || []) {
        const rows = sec.rows || sec.options || [];
        for (const row of rows) {
            const rowObj =
                typeof row === 'object' && row !== null ? row : { id: String(row), title: String(row) };
            const candidates = getButtonMatchCandidates(rowObj);
            if (candidates.some((c) => inputsMatch(userText, c))) {
                return { row: rowObj, handleCandidates: candidates };
            }
        }
    }
    return null;
}

export function edgeHandleMatches(
    sourceHandle: string | null | undefined,
    candidates: string[]
): boolean {
    const handle = String(sourceHandle || '').trim();
    if (!handle) return false;
    return candidates.some((c) => inputsMatch(handle, c));
}

export function resolveEdgeForSelection(
    edges: any[],
    sourceNodeId: string,
    handleCandidates: string[]
): any | null {
    const outgoing = (edges || []).filter((e) => String(e.source) === String(sourceNodeId));
    if (!outgoing.length || !handleCandidates.length) return null;

    for (const candidate of handleCandidates) {
        const exact = outgoing.find((e) => String(e.sourceHandle || '') === candidate);
        if (exact) return exact;
    }

    for (const edge of outgoing) {
        if (edgeHandleMatches(edge.sourceHandle, handleCandidates)) return edge;
    }

    return null;
}

export type QuickReplyResolution = {
    edge: any | null;
    matchedButton: any | null;
    invalid: boolean;
    missingEdge: boolean;
};

export function resolveQuickReplyEdge(
    edges: any[],
    sourceNodeId: string,
    buttons: any[],
    userText: string
): QuickReplyResolution {
    const sanitized = (buttons || []).filter(
        (b) => b && (typeof b === 'string' || b.title?.trim() || b.id || b.payload)
    );

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

export function resolveListMessageEdge(
    edges: any[],
    sourceNodeId: string,
    sections: any[],
    userText: string
): QuickReplyResolution {
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

export function buildWhatsAppQuickReplyButtons(buttons: any[]) {
    return (buttons || []).slice(0, 3).map((b: any) => {
        const base = typeof b === 'string' ? { title: b, payload: b } : b;
        const title = String(base.title || base).substring(0, WHATSAPP_BUTTON_TITLE_MAX);
        const id = getWhatsAppReplyId(base);
        return { type: 'reply', reply: { id, title } };
    });
}

export function sanitizeFlowButtons(buttons: any[]): any[] {
    if (!Array.isArray(buttons)) return [];
    return buttons.filter(
        (b) => b && (typeof b === 'string' || (b.title && b.title !== 'undefined' && String(b.title).trim() !== ''))
    );
}
