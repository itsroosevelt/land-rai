# Roosevelt (Land-RAI)

Plataforma SaaS multi-tenant con IA. Modelo B2B **y B2C**: cada usuario, desde `/home`, crea perfiles empresariales (`type: 'empresa'`) y personales (`type: 'persona'`) y gestiona su vida personal y empresarial. UI, docs y commits en español. Repo: github.com/admluxorsys/land-rai.

## Stack
Next.js 16 (App Router, webpack en dev), React 18, TypeScript, Tailwind 3, Radix/shadcn, Framer Motion, Zustand, ReactFlow · API routes de Next + Cloud Functions mínimas (`functions/`, Node 20) · Firebase (Firestore, Auth, Storage) · IA: Gemini (+ SDKs Anthropic/OpenAI/Vertex) · Pagos: Stripe y Solana · Integraciones: WhatsApp Cloud API, Meta/Instagram, Gmail, Telegram, X, GitHub · Deploy: Vercel + Firebase (`roosevelt-491004`).

## Entorno de desarrollo (leer antes de iniciar el servidor)
- El código corre en una VM de Google Cloud (`luxor-the-intelligence-of-vale`, zona `us-west3-a`, proyecto `excelsior1`). El navegador del usuario está en su PC: `localhost:3000` solo funciona con un túnel/reenvío de puerto.
- **No reiniciar `npm run dev` repetidas veces:** cada reinicio puede soltar el reenvío automático de la app. Hacer cambios con hot reload; reiniciar solo si es imprescindible, y avisar al usuario. Para detenerlo no usar `pkill -f` ni `pgrep -f "next..."` (matan la propia shell); usar el PID exacto.
- El usuario inicia el servidor desde el panel Terminal de la app (`npm run dev`); el agente no puede abrir pestañas nuevas ahí. Si el reenvío automático falla, túnel manual desde Windows PowerShell: `Start-Process ssh -WindowStyle Hidden -ArgumentList '-N','-L','3000:localhost:3000','-i',"$HOME\.ssh\google_compute_engine",'josep@34.22.36.96'` (cerrar con `Stop-Process -Name ssh`; no usarlo a la vez que el automático).
- `.env.local` apunta a **producción** (Firebase real). Tratar el entorno local con cuidado: no ejecutar scripts de escritura sin respaldo.
- Herramientas locales fuera del repo: `~/backups/` (respaldo Firestore del 2026-10-04 y reglas anteriores), `~/tools/` (JRE para el emulador de Firestore).
- Git: `origin` = github.com/itsroosevelt/land-rai; un push a `main` despliega a producción en Vercel. Probar con `npx tsc --noEmit` y `npm run build` antes de subir.

## Comandos
`npm run dev` (0.0.0.0:3000) · `npm run build` · `npx tsc --noEmit` · `npm run deploy:functions` · `firebase deploy --only firestore`. Copiar `.env.example` a `.env.local`; nunca commitear secretos.

## Arquitectura
- **Tenancy:** todo dato de cliente vive bajo `users/{userId}/entities/{entityId}/...`. Regla de oro: nunca crear colecciones raíz con datos de cliente ni consultas `collectionGroup` sin filtro de tenant.
- **Seguridad (aislamiento entre clientes):**
  - `firestore.rules`: solo el dueño accede a `users/{uid}/**`; todo lo demás está denegado al SDK web (el servidor usa Admin SDK). Validado con el emulador (19 casos) y desplegado en producción el 2026-10-04 (reglas anteriores en `~/backups/`; revertir con `git show d1878be:firestore.rules`). Para probar reglas: JRE en `~/tools/` + `firebase emulators:exec --only firestore`. **Prohibido** agregar `/{document=**}` o `allow ...: if true`. Las consultas `collectionGroup` desde el navegador quedan denegadas: hacerlas en una ruta API (ejemplo: `api/integrations/check-unique`).
  - Rutas API (Admin SDK, ignoran las reglas): todo handler privado empieza con `const denied = await guardApi(req); if (denied) return denied;` (`src/lib/apiAuth.ts`). Verifica el ID token de Firebase y que `userId`/`u`/`uid` coincida con el token. El cliente adjunta el token solo (`installApiAuthFetch`, instalado en `AuthContext`). Modo por defecto `enforce`; interruptor de emergencia: `API_AUTH_MODE=log` (solo registra) en Vercel.
  - Rutas públicas por diseño (sin guard): webhooks (`whatsapp|meta|telegram|twitter|gmail/webhook`), `subscriptions/stripe-webhook`, callbacks OAuth (`gmail/callback`, `auth/github*`), `admin/migrate-mold` (secreto), `web-builder/cdn-proxy` (lista blanca de CDNs).
  - Si creas una ruta nueva privada: agrega `guardApi`; si es un webhook: verifica firma/token del proveedor.
  - Respaldos: `~/backups/` (fuera del repo, contiene datos de clientes). Script de respaldo de solo lectura con Admin SDK; repetir antes de cambios riesgosos.
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
1. **Seguridad restante:** (a) los webhooks no validan firma del proveedor (Meta `X-Hub-Signature-256`, Telegram `secret_token`, Pub/Sub de Gmail): cualquiera que conozca la URL puede inyectar mensajes; (b) el candado de suscripción en cliente (`localStorage roosevelt_entity_unlocked_*`) es evadible: validar el plan en servidor/reglas; (c) cookie `github_token` es por navegador, no por usuario: atarla al uid y borrarla al cerrar sesión; (d) `storage.rules` no cubre las rutas que usa la app (`cards/`, `applications/`, `avatars/`) y permite escritura a cualquier autenticado en `chatbot_media/` y `profile-data/`: alinear con rutas por uid; (e) `solana/airdrop` y `referrals/claim` requieren sesión pero conviene limitar por usuario (anti-abuso).
2. Organigrama por entidad (icono en la órbita): empleados humanos y agentes IA asignados a suites, con permisos por rol. Datos en `users/{uid}/entities/{id}/org/*`.
3. Orquestador de entidad (servidor, autenticado con `guardApi`) + conectar la barra Ask Roosevelt para informes, leyendo solo datos de la entidad activa.
4. Rotar la clave `sk_live` de Stripe (estuvo en `.env.example`, queda en el historial git; actualizar en Vercel y `.env.local`). Webhook de Stripe ya hecho y verificado en producción el 2026-10-04: destino `we_1UMtdcGcUkvsBZd6wfI4zFuV` → `https://www.itsroosevelt.com/api/subscriptions/stripe-webhook` (usar `www`: el dominio sin `www` redirige 308 y Stripe no sigue redirects); eventos `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`; secret en `STRIPE_WEBHOOK_SECRET` (Vercel).
5. Implementar las capas plantilla (CEO, CFO resto, Board, CHRO, CSO, CISO, CLO, CPO, CDO).
6. Unificar las 3 copias de la lógica del molde; agregar `dry-run` a `migrate-mold`.
7. `next.config.mjs` reescribe `/socket.io` y `/api/internal` a `localhost:4000` (servidor externo, no incluido): documentar o remover.
8. Sin tests automatizados (las pruebas de reglas con el emulador se hicieron ad hoc; convertirlas en `npm test`).
9. Typo heredado: `kamban_VERIFY_TOKEN`. No renombrar sin migrar Vercel y Meta.
