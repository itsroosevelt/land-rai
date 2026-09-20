# 🔌 Integraciones y APIs

Esta sección documenta el funcionamiento de las principales integraciones externas en **Roosevelt**.

---

## 1. WhatsApp Omnichannel & Cloud API

La plataforma soporta recepción y envío de mensajes en tiempo real mediante WhatsApp.

### Flujo de Funcionamiento:
1. **Recepción:** El webhook configurado en Meta apunta a las Cloud Functions (`/whatsappWebhook` o `/api/whatsapp/webhook-config`).
2. **Validación:** Meta envía un token de verificación mediante `GET` que se valida contra `kamban_VERIFY_TOKEN`.
3. **Procesamiento de Mensajes:** Los mensajes entrantes (`POST`) se guardan en la colección de la entidad correspondiente (`users/{userId}/entities/{entityId}/coo/whatsapp/conversations`) y disparan los bots de IA configurados si están activos.
4. **Respuesta en Tiempo Real:** La interfaz del Núcleo utiliza listeners de Firestore y Socket.IO para actualizar el chat instantáneamente.

---

## 2. Google / Gmail Integration

Permite conectar cuentas de correo corporativas o personales a la entidad activa para que la IA lea y redacte emails.

### Permisos Solicitados (OAuth 2.0 Scopes):
* `https://www.googleapis.com/auth/gmail.readonly`: Lectura de correos entrantes.
* `https://www.googleapis.com/auth/gmail.send`: Envío de correos desde la plataforma.
* `https://www.googleapis.com/auth/userinfo.email`: Identificación de la cuenta conectada.
* `https://www.googleapis.com/auth/userinfo.profile`: Perfil del usuario.

### Resolución de la pantalla "Google no ha verificado esta app"
Dado que `gmail.readonly` y `gmail.send` son ámbitos clasificados por Google como **Restricted Scopes (Ámbitos Restringidos)**:
1. **En fase de desarrollo / pruebas:** En [Google Cloud Console](https://console.cloud.google.com) → *Pantalla de consentimiento de OAuth*, añade los correos de prueba en **"Usuarios de prueba" (Test users)**. Los usuarios pueden hacer clic en *"Avanzado"* → *"Ir a Roosevelt (no seguro)"* para conectar su correo.
2. **En producción:** Es necesario solicitar la verificación de la aplicación en Google Cloud Console aportando política de privacidad pública, video de demostración y completando la autoevaluación de seguridad de CASA.

---

## 3. Stripe (Suscripciones y Facturación)

- **Gestión de Planes:** Permite a los clientes seleccionar y actualizar planes de suscripción (`/planes`).
- **Webhooks de Facturación:** Escucha eventos como `checkout.session.completed`, `invoice.payment_succeeded` y `customer.subscription.deleted` para actualizar automáticamente el estado de la entidad en Firestore.

---

## 4. Solana Web3 (Gestión Cripto)

- Integración mediante `@solana/wallet-adapter-react` y `@solana/web3.js`.
- Soporte para conexión de billeteras populares como **Phantom Wallet**.
- Lectura de saldos de SOL y tokens SPL.
