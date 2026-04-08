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
        
        // 1. Exchange Code for Tokens
        const response = await axios.post('https://oauth2.googleapis.com/token', {
            code,
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            redirect_uri: REDIRECT_URI,
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

        // 4. Redirect back to Roosevelt
        const redirectUrl = `https://royalty-udreamms-platform-1.us-central1.hosted.app/nucleo/${entityId}/cto/integrations?gmail=success`;
        return NextResponse.redirect(redirectUrl);

    } catch (err: any) {
        console.error('[Gmail Callback Error]', err.response?.data || err.message);
        return new Response(`Error: ${err.message}`, { status: 500 });
    }
}
