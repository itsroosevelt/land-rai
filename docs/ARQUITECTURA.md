# 🏛️ Arquitectura y Modelo del Sistema

## 1. Visión General
**Roosevelt** es un SaaS multi-tenant concebido como centro de mando integral con IA. Combina automatizaciones, bots conversacionales, gestión de clientes (CRM / Kanban) y conectividad Web3.

### Stack Tecnológico Principal
- **Frontend / Framework:** [Next.js 16](https://nextjs.org/) (App Router con Webpack/Turbopack)
- **UI & Estilos:** React 18, [Tailwind CSS](https://tailwindcss.com/), Radix UI / Shadcn UI, Framer Motion para micro-animaciones y Lucide Icons.
- **Tipografía Global:** Google Font `Outfit`.
- **Base de Datos & Auth:** [Firebase v12 Client SDK](https://firebase.google.com/) (Firestore, Auth, Storage) y Firebase Admin v13.
- **Backend Serverless:** [Firebase Cloud Functions](functions/) (Node.js 20, TypeScript).
- **IA Generativa:** Google Gemini API (`@google/generative-ai`, `@google-cloud/vertexai`) y SDK de OpenAI / Anthropic.
- **Pagos:** Stripe API & Stripe React Elements.
- **Web3:** `@solana/web3.js` y Solana Wallet Adapter.

---

## 2. Modelo de Datos Multi-Tenant

La base de datos Firestore está estructurada bajo un esquema multi-tenant jerárquico por **Entidades** (organizaciones/empresas):

```
users/{userId}
  ├── entities/{entityId}
  │     ├── settings/general
  │     ├── integrations/
  │     │     ├── whatsapp
  │     │     ├── gmail_internal (cuentas autorizadas)
  │     │     └── stripe
  │     ├── crm/contacts/{contactId}
  │     ├── kamban/{cardId}
  │     ├── bots/{botId}
  │     └── ...
```

- **Usuarios (`users/{userId}`):** Contiene la información de cuenta y credenciales principales del usuario autenticado (email, lastLogin).
- **Entidades (`entities/{entityId}`):** Cada usuario puede crear u operar múltiples entidades independientes (empresas, sucursales o marcas).
- **Aislamiento de Datos:** Las reglas de seguridad de [`firestore.rules`](../firestore.rules) aseguran que los datos de una entidad solo sean accesibles por usuarios autorizados.

---

## 3. Estructura de Módulos Ejecutivos (`/nucleo/[entityId]/`)

La plataforma organiza sus herramientas operativas en roles ejecutivos dentro del Núcleo:

| Rol Ejecutivo | Ruta | Responsabilidades |
| :--- | :--- | :--- |
| **CEO** | `/nucleo/[entityId]/ceo` | Visión ejecutiva, métricas generales y dirección estratégica del negocio. |
| **COO** | `/nucleo/[entityId]/coo` | Operaciones en tiempo real: Bandeja Omnichannel, WhatsApp, Kanban de estados y postulaciones. |
| **CMO** | `/nucleo/[entityId]/cmo` | Marketing y Gestión de Clientes: CRM, contactos, campañas masivas y segmentación. |
| **CTO** | `/nucleo/[entityId]/cto` | Tecnología y Automatizaciones: Conexiones de APIs, WhatsApp Cloud API, Orquestador de agentes, creador de bots y Voice Center. |

---

## 4. Backend Serverless (`functions/`)

La carpeta [`functions/`](../functions) contiene el backend independiente desplegado en Google Cloud / Firebase:
- **WhatsApp Webhooks:** Procesa mensajes entrantes y actualiza chats en tiempo real.
- **Gestión de Tarjetas:** Migración y sincronización de tarjetas Kanban entre columnas.
- **Configuraciones:** Sincronización de dominios y webhooks dinámicos.
