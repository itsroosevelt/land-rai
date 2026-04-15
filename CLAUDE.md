# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Frontend (Next.js)
npm run dev          # Start dev server on port 3000
npm run build        # Production build
npm run lint         # Lint src/ with ESLint

# Firebase Functions
npm run deploy:functions   # Deploy to Firebase

# WhatsApp Microservice (separate process)
cd whatsapp-service && npm run dev   # Start with tsx watch on its own port
```

## Architecture Overview

Roosevelt is a **multi-tenant SaaS platform** built on Next.js 15 + Firebase, with three deployable services:

### 1. Next.js Frontend (`src/`)
The main app. Authentication state and the active entity are managed globally via `AuthContext` (`src/contexts/AuthContext.tsx`). On login, Firestore documents are seeded under `users/{uid}/entities/` with two default entities: a `persona` (personal OS) and a random `empresa` (business OS).

**Routing convention:**
- `/nucleo/[entityId]` — entity dashboard; reads `entityType` from Firestore to render either `PersonaDashboard` or the business carousel
- `/nucleo/[entityId]/ceo|cfo|cto|cso|cmo|coo|cpo|cdo|chro|ciso|clo` — C-suite "offices", each a self-contained module
- `/nucleo/[entityId]/cto/automation/chatbots` — visual chatbot builder (ReactFlow canvas)
- `/nucleo/[entityId]/board` — Kanban board

**State:**
- `src/lib/store.ts` — Zustand store for the ReactFlow chatbot canvas (nodes/edges)
- Firebase `onAuthStateChanged` drives `AuthContext`; `activeEntity` is derived from the URL path and persisted to `localStorage`

### 2. Firebase Functions (`functions/src/`)
Serverless backend. Entry point is `functions/src/index.ts`. Two main categories:

- **Webhooks** (`webhooks/`) — inbound messages from WhatsApp (Cloud API), Meta (Messenger/Instagram), Telegram, X, TikTok, WebChat, Google Forms, and Baileys. Each webhook routes to the shared bot engine.
- **Callable functions** (`callable/`) — client-invoked functions (e.g., Kanban card actions)
- **`helpers/botEngine.ts`** — server-side bot runner with a Firestore-based lock system to prevent duplicate processing when messages arrive rapidly
- **`helpers/tenantResolver.ts`** — resolves `userId`/`entityId` from webhook URL params for multi-tenant dispatch

### 3. WhatsApp Microservice (`whatsapp-service/`)
Standalone Express + Socket.io server using the **Baileys** library (unofficial WhatsApp Web protocol). Separate from Firebase Functions — handles session persistence and QR code auth for the Baileys integration. Connects back to Firebase Admin SDK.

## Firestore Data Model

```
users/{userId}
  entities/{entityId}
    integrations/{platform}         # Credentials & config per messaging platform
    integrations/{platform}_internal  # Internal tokens (verifyToken, etc.)
    kanban-groups/{groupId}
      cards/{cardId}                # Contact/conversation card; holds botLock & botState
    system_logs/                    # Bot trace logs written by botEngine
    settings/general
```

Multi-tenant webhooks carry `?u={userId}&e={entityId}` query params so a single webhook endpoint can route to any tenant.

## Key Libraries & Integrations

- **AI providers:** `@anthropic-ai/sdk`, `openai`, `@google/generative-ai`, `@google-cloud/vertexai`, Vercel `ai` SDK
- **Messaging send:** `src/lib/sendProviders.ts` — unified wrappers for Meta, WhatsApp Cloud API, Telegram, Gmail
- **Chatbot engine (client-side runner):** `src/lib/chatbotEngine.ts` — FIFO queue with atomic Firestore lock; called from Next.js API routes
- **Bot engine (server-side):** `functions/src/helpers/botEngine.ts` — equivalent runner for Firebase Functions context
- **Solana:** `@solana/web3.js`, SPL tokens, wallet adapters (Jupiter Terminal loaded via CDN script in `layout.tsx`)
- **UI:** Tailwind CSS + shadcn/ui (Radix primitives in `src/components/ui/`), Framer Motion, MUI for charts
- **Kanban / visual builder:** ReactFlow (`src/lib/store.ts`), `@hello-pangea/dnd`, `@dnd-kit`

## Environment Variables

Firebase client config uses `NEXT_PUBLIC_FIREBASE_*` variables. Server-side code uses `firebase-admin` initialized from `serviceAccountKey.json` (present in repo root and `whatsapp-service/`). Additional platform secrets: `META_PAGE_ACCESS_TOKEN`, `NEXT_PUBLIC_META_APP_ID`, `kamban_VERIFY_TOKEN`.

## Multi-Tenant Chatbot Flow

1. Inbound message hits a webhook (`/api/whatsapp/webhook?u=X&e=Y`)
2. `tenantResolver` looks up the entity's integration config in Firestore
3. `chatbotEngine.ts` acquires a Firestore transaction lock on the contact's `cardId`
4. Bot reads the chatbot flow definition from Firestore, processes steps, sends reply via `sendProviders.ts`
5. Lock is released; `lastProcessedMessageId` is written to prevent duplicates
6. Priority commands (`reset`, `menu`, `start`) bypass existing locks atomically
