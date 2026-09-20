# 🔐 Guía de Variables de Entorno

Este documento describe todas las variables de entorno necesarias para ejecutar **Roosevelt** en local (`.env.local`) y en producción (**Vercel**).

---

## 1. Firebase (Frontend & Autenticación)

Estas variables permiten al cliente conectarse al proyecto Firebase (`roosevelt-491004`):

| Variable | Descripción | Dónde obtenerla |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Clave API pública del proyecto Firebase | Firebase Console → Configuración del proyecto → Web Apps |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Dominio de autenticación (ej. `roosevelt-491004.firebaseapp.com`) | Firebase Console → Configuración del proyecto |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | ID del proyecto (`roosevelt-491004`) | Firebase Console → Configuración del proyecto |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`| Bucket de Storage (`roosevelt-491004.firebasestorage.app`) | Firebase Console → Storage |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Sender ID para notificaciones Push | Firebase Console → Cloud Messaging |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Identificador único de la aplicación Web | Firebase Console → Configuración del proyecto |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | ID de Google Analytics (G-XXXXXXX) | Firebase Console → Google Analytics |

---

## 2. Inteligencia Artificial (Gemini)

| Variable | Descripción | Dónde obtenerla |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | Clave de acceso para la API de Google Gemini | [Google AI Studio](https://aistudio.google.com/) |

---

## 3. Meta / WhatsApp Cloud API

| Variable | Descripción | Dónde obtenerla |
| :--- | :--- | :--- |
| `kamban_VERIFY_TOKEN` | Token de verificación de webhooks en Meta Developers | Inventado por ti y colocado en Meta Webhooks |
| `NEXT_PUBLIC_META_APP_ID` | App ID de tu aplicación de Meta (Facebook Developers) | [developers.facebook.com](https://developers.facebook.com/) |
| `META_APP_SECRET` | Clave secreta de la app en Meta Developers | Meta Developers → Configuración básica |

---

## 4. Google / Gmail API (Integración de Correo)

> [!IMPORTANT]
> Estas variables deben configurarse en **Vercel → Project Settings → Environment Variables** para que la integración de Gmail funcione sin mostrar el error `Ensure GMAIL_CLIENT_ID is set`.

| Variable | Descripción | Dónde obtenerla |
| :--- | :--- | :--- |
| `GMAIL_CLIENT_ID` | Client ID de OAuth 2.0 en Google Cloud Console | [Google Cloud Console](https://console.cloud.google.com/) → APIs y servicios → Credenciales |
| `GMAIL_CLIENT_SECRET` | Client Secret de OAuth 2.0 | Google Cloud Console → Credenciales |
| `GMAIL_REDIRECT_URI` | URL de callback autorizada (ej. `https://roosevelt-two.vercel.app/api/gmail/callback`) | Google Cloud Console → URI de redirección autorizados |
| `GMAIL_PUBSUB_TOPIC` | *(Opcional)* Tópico de Google Cloud Pub/Sub para notificaciones push de correos entrantes | Google Cloud Console → Pub/Sub |

---

## 5. Stripe (Pagos y Suscripciones)

| Variable | Descripción | Dónde obtenerla |
| :--- | :--- | :--- |
| `STRIPE_SECRET_KEY` | Clave secreta de Stripe (`sk_live_...` o `sk_test_...`) | [Stripe Dashboard](https://dashboard.stripe.com/) → Claves de API |
| `STRIPE_WEBHOOK_SECRET` | Secreto para validar eventos de Webhook (`whsec_...`) | Stripe Dashboard → Webhooks |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Clave publicable de Stripe (`pk_live_...` o `pk_test_...`) | Stripe Dashboard → Claves de API |

---

## 6. Supabase

| Variable | Descripción | Dónde obtenerla |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL de la instancia de Supabase | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anónima pública de Supabase | Supabase Dashboard → Settings → API |
