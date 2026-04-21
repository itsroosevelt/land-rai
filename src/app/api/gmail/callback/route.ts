import { NextResponse } from 'next/server';
import { google } from 'googleapis';
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

    const oauth2Client = new google.auth.OAuth2(
        process.env.GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET,
        `${process.env.NEXT_PUBLIC_APP_URL}/api/gmail/callback`
    );

    try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
        const profile = await gmail.users.getProfile({ userId: 'me' });
        const email = profile.data.emailAddress;

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

        // Register Watch for real-time notifications
        try {
            await gmail.users.watch({
                userId: 'me',
                requestBody: {
                    labelIds: ['INBOX'],
                    topicName: process.env.GMAIL_PUBSUB_TOPIC
                }
            });
        } catch (watchError) {
            console.error('Gmail Watch Error:', watchError);
            // Even if watch fails, we keep the connection but mark it with warning
            await db.doc(`users/${userId}/entities/${entityId}/integrations/gmail`).update({
                status: 'Error',
                lastError: 'Fallo al activar tiempo real (Watch API)'
            });
        }

        // Return a success page that closes the popup and notifies the opener
        return new NextResponse(`
            <html>
                <body>
                    <script>
                        window.opener.postMessage('gmail-auth-success', '*');
                        window.close();
                    </script>
                    <div style="font-family: sans-serif; text-align: center; padding: 50px;">
                        <h2 style="color: #4CAF50;">¡Conexión Exitosa!</h2>
                        <p>Puedes cerrar esta ventana ahora.</p>
                    </div>
                </body>
            </html>
        `, { headers: { 'Content-Type': 'text/html' } });

    } catch (error) {
        console.error('Gmail Callback Error:', error);
        return NextResponse.json({ error: 'Failed to exchange token' }, { status: 500 });
    }
}
