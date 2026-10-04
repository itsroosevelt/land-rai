# Roosevelt (Land-RAI)

Plataforma SaaS multi-tenant con IA. Modelo B2B **y B2C**: cada usuario, desde `/home`, crea perfiles empresariales (`type: 'empresa'`) y personales (`type: 'persona'`) y gestiona su vida personal y empresarial. UI, docs y commits en español. Repo: github.com/admluxorsys/land-rai.

## Stack
Next.js 16 (App Router, webpack en dev), React 18, TypeScript, Tailwind 3, Radix/shadcn, Framer Motion, Zustand, ReactFlow · API routes de Next + Cloud Functions mínimas (`functions/`, Node 20) · Firebase (Firestore, Auth, Storage) · IA: Gemini (+ SDKs Anthropic/OpenAI/Vertex) · Pagos: Stripe y Solana · Integraciones: WhatsApp Cloud API, Meta/Instagram, Gmail, Telegram, X, GitHub · Deploy: Vercel + Firebase (`roosevelt-491004`).

## Comandos
`npm run dev` (0.0.0.0:3000) · `npm run build` · `npx tsc --noEmit` · `npm run deploy:functions` · `firebase deploy --only firestore`. Copiar `.env.example` a `.env.local`; nunca commitear secretos.

## Arquitectura
- **Tenancy:** todo dato de cliente vive bajo `users/{userId}/entities/{entityId}/...`. Regla de oro: nunca crear colecciones raíz con datos de cliente ni consultas `collectionGroup` sin filtro de tenant.
- **Rutas:** todo bajo `/home/[entityId]/...`. `EntityRouteResolver` resuelve slug → id de Firestore (`useEntityRoute()`). `/home` lista y crea perfiles; `entityType 'persona'` abre `PersonaDashboard`, `'empresa'` abre la órbita de suites (`Carousel`).
- **Suites ejecutivas:** `/home/[entityId]/<rol>` redirige a `/workspace?role=<rol>` (plano cartesiano). Fuente de verdad: `DEPARTMENTS_DATA` en `workspace/page.tsx`; cada capa enlaza a `/<rol>/<path>`. Al agregar una sección: crear la carpeta y registrar la capa con el mismo nombre. Todos los roles están activos (sin gating).
- **Molde de entidad** (`src/lib/mold/`, versión en `ENTITY_MOLD_VERSION`, hoy 21): aprovisiona estructuras de datos de forma idempotente (`merge`). Se aplica al iniciar sesión (`ensureEntityMoldUpToDate`) o globalmente con `POST api/admin/migrate-mold` (header `x-migration-secret`). Para propagar un cambio estructural: implementarlo en el molde, subir la versión, desplegar y correr la migración. Hay copias en `entityMold.ts`, `entityMoldAdmin.ts` y `functions/src/helpers/` que deben mantenerse sincronizadas.
- **Webhooks:** la lógica vive en rutas Next (`api/whatsapp|meta|telegram|twitter/webhook`). La Cloud Function `whatsappWebhook` (us-west3) solo hace proxy a Vercel. `functions/lib/` es salida compilada, ignorada por git.
- **Barra "Ask Roosevelt"** (`components/floating-bars/AskRooseveltBar.tsx`): hoy solo diseño. Objetivo: interfaz del orquestador de la entidad.
- Docs detalladas en `docs/`.

## Decisiones importantes
- `/nucleo` eliminado; todo es `/home`. No crear rutas ni imports con `nucleo`.
- `/cto/automation/chatbots` → `/whatsappbots` (redirect permanente). Bots de WhatsApp libres por `phoneNumberId`.
- Broadcast omnicanal segmentado por tableros Kanban; slugs de entidad normalizados.
- Diseño: fondo negro, partículas azul eléctrico, frosted glass, fuente Outfit.
- Build Vercel: conexión Solana lazy; `AppWalletProvider` sin SSR.
- `next.config.mjs` reescribe `/socket.io` y `/api/internal` a `localhost:4000` (servidor externo, no incluido en el repo).

## Estado de las suites
Reales: **CTO** (automation/whatsappbots, integrations, web-builder, voice-center, meet-agents, orchestrator como maqueta), **COO** (omnichannel, kamban → workspace/hub), **CMO** (crm, broadcast/list), **CFO** (revenue, con datos demo de respaldo). Comparten información ordenadamente (Kanban ↔ bots ↔ CRM ↔ broadcast): no romper esos flujos. El resto de capas son plantillas `DepartmentPageShell`. Hecho además: login multi-proveedor, Stripe + Solana, landing, perfil personal (`PersonaDashboard`).

## Pendiente (por prioridad)
1. **Aislamiento de datos (crítico):** (a) `firestore.rules`: eliminar el catch-all `/{document=**}` y el `if true` en `/cards` y `/chatbots`; dejar acceso solo al dueño en `users/{uid}/entities/**`; probar en emulador; (b) migrar `contacts`, `kanban-groups` (PropertyValue) y `web-projects` a rutas por entidad; (c) CRM `cmo/crm/page.tsx:245`: reemplazar `collectionGroup('cards')` sin filtro por consultas bajo el tenant; (d) OAuth de GitHub: llevar `entityId` en `state` en lugar de `/home/roosevelt`; (e) `roosevelt_active_entity` en localStorage → atarlo a `uid`. **Antes: export/respaldo de Firestore.**
2. Organigrama por entidad (icono en la órbita): empleados humanos y agentes IA asignados a suites, con permisos por rol.
3. Orquestador de entidad (servidor) + conectar la barra Ask Roosevelt para informes.
4. Webhook de Stripe: `api/subscriptions/stripe-webhook` devuelve 503 (TODO).
5. Implementar las capas plantilla, empezando por CFO/CEO.
6. Unificar las 3 copias de la lógica del molde; agregar `dry-run` a `migrate-mold`.
7. Completar `.env.example` (Gmail, Solana, GitHub, `MOLD_MIGRATION_SECRET`); documentar o remover los rewrites a `:4000`.
8. Sin tests automatizados.
