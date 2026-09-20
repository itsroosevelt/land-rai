# 🚀 Despliegue y Mantenimiento

Esta guía detalla los comandos y procedimientos necesarios para compilar, mantener y desplegar **Roosevelt**.

---

## 1. Comandos de Desarrollo Local

```bash
# Iniciar servidor de desarrollo en http://localhost:3000
npm run dev

# Iniciar servidor limpiando cachés previas
npm run dev:clean

# Compilar proyecto para producción
npm run build

# Limpiar todas las carpetas de caché y artefactos (.next, .turbo, tsconfig.tsbuildinfo)
npm run clean
```

---

## 2. Despliegue de Frontend (Vercel)

El proyecto está configurado para desplegarse automáticamente en **Vercel** conectado a la rama `main` de GitHub (`https://github.com/admluxorsys/land-rai.git`).

### Pasos Clave en Vercel:
1. Asegurar que todas las **Variables de Entorno** (ver [VARIABLES_ENTORNO.md](VARIABLES_ENTORNO.md)) estén registradas en **Settings → Environment Variables**.
2. Verificar que el comando de compilación sea `npm run build`.
3. Para forzar un nuevo despliegue manual, puedes hacer un push a la rama `main` o usar el botón **Redeploy** en el panel de Vercel.

---

## 3. Despliegue de Backend (Firebase Cloud Functions)

El backend en [`functions/`](../functions) se gestiona mediante Firebase CLI:

```bash
# Desplegar solo las Cloud Functions
npm run deploy:functions

# Desplegar reglas e índices de Firestore
firebase deploy --only firestore

# Desplegar reglas de Storage
firebase deploy --only storage
```

---

## 4. Dominios Autorizados en Firebase Auth

Para que el inicio de sesión y registro con Google funcionen sin errores en producción:
1. Abre [Firebase Console](https://console.firebase.google.com).
2. Ve a **Authentication** → pestaña **Settings** → **Authorized domains**.
3. Añade:
   - `roosevelt-two.vercel.app`
   - Tu dominio personalizado en producción (ej. `byroosevelt.com`).
   - `localhost` (para pruebas locales).
