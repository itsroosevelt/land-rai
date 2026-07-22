/** Rutas del molde multitenant — usar `{entity}` o `entityId` según contexto. */

export const MOLD_WORKSPACE_ROUTES = {
    diagram: (entityId: string, role = 'coo') => `/nucleo/${entityId}/workspace?role=${role}`,
    hub: (entityId: string) => `/nucleo/${entityId}/workspace/hub`,
    botKanban: (entityId: string) => `/nucleo/${entityId}/workspace/bot`,
    manualKanban: (entityId: string) => `/nucleo/${entityId}/workspace/manual`,
    broadcastList: (entityId: string) => `/nucleo/${entityId}/cmo/broadcast/list`,
    integrations: (entityId: string) => `/nucleo/${entityId}/cto/integrations`,
    chatbotEditor: (entityId: string, botId: string) =>
        `/nucleo/${entityId}/cto/automation/whatsappbots/${botId}`,
    /** Lámina COO en el diagrama (fullPath relativo a /nucleo/{entityId}/) */
    kambanLayerFullPath: 'workspace/hub',
} as const;

export const MOLD_NAV_HREFS = {
    kambanLeads: '/nucleo/{entity}/workspace/hub',
    cooWorkspace: '/nucleo/{entity}/workspace?role=coo',
    broadcastList: '/nucleo/{entity}/cmo/broadcast/list',
} as const;
