/** Rutas del molde multitenant — usar `{entity}` o `entityId` según contexto. */

export const MOLD_WORKSPACE_ROUTES = {
    diagram: (entityId: string, role = 'coo') => `/nucleo/${entityId}/workspace?role=${role}`,
    hub: (entityId: string) => `/nucleo/${entityId}/workspace/hub`,
    botKanban: (entityId: string) => `/nucleo/${entityId}/workspace/bot`,
    manualKanban: (entityId: string) => `/nucleo/${entityId}/workspace/manual`,
    /** Lámina COO en el diagrama (fullPath relativo a /nucleo/{entityId}/) */
    kambanLayerFullPath: 'workspace/hub',
} as const;

export const MOLD_NAV_HREFS = {
    kambanLeads: '/nucleo/{entity}/workspace/hub',
    cooWorkspace: '/nucleo/{entity}/workspace?role=coo',
} as const;
