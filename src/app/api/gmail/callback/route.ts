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
                console.error('[Gmail Callback] ⚠️ Watch Registration Failed:', watchErr.response?.data || watchErr.message);
                // We DON'T fail the whole flow, as the user is already authenticated. 
                // We'll just have missing real-time notifications until fixed.
            }
        } else {
            console.warn('[Gmail Callback] ⚠️ GMAIL_PUBSUB_TOPIC not configured. Real-time sync will not work.');
        }

        // 5. Redirect back to Roosevelt (Agnostic Rule 1)
        const redirectUrl = `${protocol}://${host}/nucleo/${entityId}/cto/integrations?gmail=success`;
        
        return NextResponse.redirect(redirectUrl);

    } catch (err: any) {
        console.error('[Gmail Callback Error]', err.response?.data || err.message);
        return new Response(`Error: ${err.message}`, { status: 500 });
    }
}
