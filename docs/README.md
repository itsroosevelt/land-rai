# 📚 Documentación Oficial de Roosevelt (Land-RAI)

Bienvenido a la documentación técnica y operativa de **Roosevelt**, una plataforma SaaS Multi-Tenant impulsada por Inteligencia Artificial diseñada como centro de mando operativo y estratégico para negocios y ecosistemas Web3.

---

## 📑 Índice de Documentos

1. **[Arquitectura y Modelo del Sistema](ARQUITECTURA.md)**
   - Estructura general (Next.js 16 App Router, Tailwind CSS, Firebase, Google Cloud).
   - Modelo Multi-Tenant por Entidades (`users/{uid}/entities/{entityId}`).
   - Módulos ejecutivos de la plataforma: **CEO**, **COO**, **CMO**, **CTO**.
   - Arquitectura serverless con Cloud Functions.

2. **[Guía de Variables de Entorno](VARIABLES_ENTORNO.md)**
   - Listado completo de variables necesarias para desarrollo local (`.env.local`) y producción en **Vercel**.
   - Explicación de cada clave: Firebase, Gemini AI, Meta/WhatsApp, Stripe, Gmail OAuth, Supabase.

3. **[Integraciones y APIs](INTEGRACIONES_Y_APIS.md)**
   - **WhatsApp Cloud API & Baileys**: Configuración de webhooks y chat multicanal.
   - **Gmail API & Google OAuth**: Flujo OAuth 2.0, ámbitos sensibles, permisos y resolución de la verificación de Google.
   - **Stripe**: Pasarela de pago y suscripciones multi-tenant.
   - **Solana Web3**: Conexión con Phantom y gestión de wallets.

4. **[Despliegue y Mantenimiento](DESPLIEGUE_Y_MANTENIMIENTO.md)**
   - Despliegue de frontend en **Vercel**.
   - Despliegue de backend en **Firebase Cloud Functions**.
   - Despliegue de reglas de seguridad e índices de **Firestore** y **Storage**.
   - Scripts de mantenimiento, compilación y limpieza.
