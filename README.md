# Roosevelt (Land-RAI) 🚀

Plataforma SaaS Multi-Tenant impulsada por Inteligencia Artificial diseñada como centro de mando unificado para la gestión, optimización y automatización de negocios y ecosistemas Web3.

---

## 📖 Documentación del Proyecto

Toda la documentación técnica y operativa se encuentra organizada en la carpeta **[`docs/`](docs/)**:

- **[Arquitectura del Sistema](docs/ARQUITECTURA.md)**: Estructura de la aplicación, modelo multi-tenant por entidades y roles ejecutivos (CEO, COO, CMO, CTO).
- **[Variables de Entorno](docs/VARIABLES_ENTORNO.md)**: Lista completa y detallada de variables necesarias para desarrollo local y producción en Vercel.
- **[Integraciones y APIs](docs/INTEGRACIONES_Y_APIS.md)**: Configuración de WhatsApp Cloud API, Google/Gmail OAuth 2.0, Stripe y Solana Web3.
- **[Despliegue y Mantenimiento](docs/DESPLIEGUE_Y_MANTENIMIENTO.md)**: Guía paso a paso para desplegar en Vercel y Firebase Cloud Functions.

---

## 🛠️ Inicio Rápido

### Requisitos previos
- Node.js 20+
- Cuenta en Firebase y Google Cloud
- Cuenta en Vercel (para despliegue)

### Instalación y Ejecución Local

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env.local

# 3. Iniciar servidor de desarrollo
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador para ver la plataforma en funcionamiento.
