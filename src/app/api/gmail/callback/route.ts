import { NextResponse } from 'next/server';
import { db, admin } from '@/lib/firebase-admin';
import axios from 'axios';

const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const REDIRECT_URI = process.env.GMAIL_REDIRECT_URI;

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code || !state) {
        return new Response('Invalid Request', { status: 400 });
    }

    try {
        const { userId, entityId } = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
        
        const host = req.headers.get('host');
        const protocol = req.headers.get('x-forwarded-proto') || (host?.includes('localhost') ? 'http' : 'https');
        const dynamicRedirect = host ? `${protocol}://${host}/api/gmail/callback` : REDIRECT_URI;

        // 1. Exchange Code for Tokens
        const response = await axios.post('https://oauth2.googleapis.com/token', {
            code,
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            redirect_uri: dynamicRedirect,
            grant_type: 'authorization_code'
        });

        const { access_token, refresh_token, expires_in } = response.data;
        const expiresAt = Date.now() + (expires_in * 1000);

        // 2. Get User Info (Email)
        const userRes = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${access_token}` }
        });
        const gmailAddress = userRes.data.email;

        // 3. Save to Firestore
        const internalPath = `users/${userId}/entities/${entityId}/integrations/gmail_internal`;
        const publicPath = `users/${userId}/entities/${entityId}/integrations/gmail`;

        await Promise.all([
            db.doc(internalPath).set({
                accessToken: access_token,
                refreshToken: refresh_token || null,
                expiresAt,
                gmailAddress,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true }),
            db.doc(publicPath).set({
                gmailAddress,
                status: 'Connected',
                provider: 'gmail',
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true })
        ]);

        // 4. INITIATE REAL-TIME SYNC (Watch API)
        const topicName = process.env.GMAIL_PUBSUB_TOPIC;
        if (topicName) {
            try {
                console.log(`[Gmail Callback] Initiating Watch for ${gmailAddress} on topic ${topicName}`);
                const watchRes = await axios.post('https://gmail.googleapis.com/gmail/v1/users/me/watch', {
                    topicName,
                    labelIds: ['INBOX'],
                    labelFilterAction: 'include'
                }, {
                    headers: { Authorization: `Bearer ${access_token}` }
                });
                
                // Save meta-data so we can confirm it's alive in our audits
                await db.doc(`users/${userId}/entities/${entityId}/integrations/gmail`).update({
                    watchExpiry: watchRes.data.expiration,
                    historyId: watchRes.data.historyId,
                    lastWatchRefresh: admin.firestore.FieldValue.serverTimestamp()
                });
                console.log(`[Gmail Callback] ✅ Watch successfully registered for ${gmailAddress}`);
            } catch (watchErr: any) {
                const errMsg = watchErr.response?.data ? JSON.stringify(watchErr.response.data) : watchErr.message;
                console.error('[Gmail Callback] ⚠️ Watch Registration Failed:', errMsg);
                
                await db.doc(`users/${userId}/entities/${entityId}/integrations/gmail`).update({
                    status: 'Error',
                    watchError: errMsg,
                    lastWatchAttempt: admin.firestore.FieldValue.serverTimestamp()
                });
                // We DON'T fail the whole flow, as the user is already authenticated. 
            }
        } else {
            console.warn('[Gmail Callback] ⚠️ GMAIL_PUBSUB_TOPIC not configured. Real-time sync will not work.');
        }

        // 5. Success Page (Instead of Redirect)
        // This script will close the popup and notify the parent window
        return new Response(`
            <html>
                <body style="background: #0a0a0a; color: white; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0;">
                    <div style="text-align: center; padding: 40px; border: 1px solid rgba(255,255,255,0.1); border-radius: 40px; background: rgba(255,255,255,0.03); backdrop-blur: 20px;">
                        <div style="width: 80px; height: 80px; background: #EA4335; border-radius: 24px; display: flex; items-center: center; justify-content: center; margin: 0 auto 24px;">
                            <svg style="width: 40px; height: 40px; color: white; margin-top: 20px;" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                            </svg>
                        </div>
                        <h1 style="font-size: 24px; font-weight: 200; letter-spacing: -0.05em; margin-bottom: 8px; text-transform: uppercase; font-style: italic;">Conexión Exitosa</h1>
                        <p style="font-size: 10px; color: rgba(255,255,255,0.3); text-transform: uppercase; letter-spacing: 0.3em; font-weight: 700;">El nodo Gmail ha sido sincronizado</p>
                        <p style="font-size: 12px; color: rgba(255,255,255,0.6); margin-top: 20px;">Esta ventana se cerrará automáticamente...</p>
                    </div>
                    <script>
                        setTimeout(() => {
                            if (window.opener) {
                                window.opener.postMessage({ type: 'GMAIL_SUCCESS', entityId: '${entityId}' }, '*');
                            }
                            window.close();
                        }, 2000);
                    </script>
                </body>
            </html>
        `, {
            headers: { 'Content-Type': 'text/html' }
        });

    } catch (err: any) {
        console.error('[Gmail Callback Error]', err.response?.data || err.message);
        return new Response(`Error: ${err.message}`, { status: 500 });
    }
}
