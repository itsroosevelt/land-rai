import { NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import { db } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code || !state) {
        return NextResponse.json({ error: 'Missing code or state' }, { status: 400 });
    }

    const { entityId, userId } = JSON.parse(Buffer.from(state, 'base64').toString());

    // Rebuild the same redirect_uri used in auth-url/route.ts so Google accepts the exchange
    const host = req.headers.get('host');
    const protocol = req.headers.get('x-forwarded-proto') || (host?.includes('localhost') ? 'http' : 'https');
    const redirectUri = host
        ? `${protocol}://${host}/api/gmail/callback`
        : process.env.GMAIL_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/gmail/callback`;

    const oauth2Client = new OAuth2Client(
        process.env.GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET,
        redirectUri
    );

    try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        // Get profile using fetch and access token (leaner than googleapis)
        const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
            headers: { Authorization: `Bearer ${tokens.access_token}` }
        });
        const profileData = await profileRes.json();
        const email = profileData.emailAddress;

        // Save tokens and info in Firestore
        const integrationData = {
            email,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiryDate: tokens.expiry_date,
            status: 'Connected',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        // 1. Save in entity (for UI)
        await db.doc(`users/${userId}/entities/${entityId}/integrations/gmail`).set(integrationData);

        // 2. Save in public integrations (for Pub/Sub workers)
        await db.doc(`integrations/gmail/users/${userId}_${entityId}`).set({
            ...integrationData,
            entityId,
            userId
        });

        // Register Watch for real-time notifications via fetch
        try {
            await fetch('https://gmail.googleapis.com/gmail/v1/users/me/watch', {
                method: 'POST',
                headers: { 
                    Authorization: `Bearer ${tokens.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    labelIds: ['INBOX'],
                    topicName: process.env.GMAIL_PUBSUB_TOPIC
                })
            });
        } catch (watchError) {
            console.error('Gmail Watch Error:', watchError);
            // Even if watch fails, we keep the connection but mark it with warning
            await db.doc(`users/${userId}/entities/${entityId}/integrations/gmail`).update({
                status: 'Error',
                lastError: 'Fallo al activar tiempo real (Watch API)'
            });
        }

        // Return a success page — handles both popup and main-window redirect flows
        return new NextResponse(`
            <html>
                <head><meta charset="utf-8"></head>
                <body style="font-family:sans-serif;text-align:center;padding:50px;background:#111;color:#fff;">
                    <script>
                        if (window.opener) {
                            window.opener.postMessage('gmail-auth-success', '*');
                            window.close();
                        } else {
                            window.location.href = '/nucleo/${entityId}/cto/integrations';
                        }
                    </script>
                    <h2 style="color:#4CAF50;">Conexion Exitosa</h2>
                    <p>Redirigiendo...</p>
                </body>
            </html>
        `, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });

    } catch (error: any) {
        const errMsg = error?.message || error?.toString() || 'Unknown error';
        const errDetail = error?.response?.data ? JSON.stringify(error.response.data) : '';
        console.error('Gmail Callback Error:', errMsg, errDetail);
        return new NextResponse(`
            <html>
                <head><meta charset="utf-8"></head>
                <body style="font-family:sans-serif;text-align:center;padding:50px;background:#111;color:#fff;">
                    <script>
                        if (window.opener) window.opener.postMessage('gmail-auth-error', '*');
                    </script>
                    <h2 style="color:#EA4335;">Error de Conexion con Gmail</h2>
                    <p>No se pudo completar la autenticacion.</p>
                    <pre style="background:#222;padding:16px;border-radius:8px;text-align:left;font-size:12px;color:#f87171;white-space:pre-wrap;word-break:break-all;">${errMsg}${errDetail ? '\n' + errDetail : ''}</pre>
                    <p style="color:#888;font-size:12px;">Puedes cerrar esta ventana.</p>
                </body>
            </html>
        `, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
}
