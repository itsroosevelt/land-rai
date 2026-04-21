import { NextResponse } from 'next/server';
import axios from 'axios';

/**
 * POST /api/meta/exchange-token
 * 
 * Converts a short-lived User Access Token (from FB.login, expires in ~1-2h)
 * into a PERMANENT Page Access Token using the App Secret.
 *
 * Flow:
 * 1. Short-lived User Token  →  Long-lived User Token (60 days)
 * 2. Long-lived User Token   →  Page Access Token (PERMANENT — never expires)
 */
export async function POST(req: Request) {
    try {
        const { userAccessToken, pageId } = await req.json();

        if (!userAccessToken || !pageId) {
            return NextResponse.json({ error: 'Missing userAccessToken or pageId' }, { status: 400 });
        }

        const APP_ID = process.env.NEXT_PUBLIC_META_APP_ID;
        const APP_SECRET = process.env.META_APP_SECRET;

        if (!APP_ID || !APP_SECRET) {
            console.error('[exchange-token] Missing META_APP_ID or META_APP_SECRET env vars');
            return NextResponse.json({ error: 'Server misconfiguration: missing Meta app credentials' }, { status: 500 });
        }

        // STEP 1: Exchange short-lived user token → long-lived user token (60 days)
        const exchangeUrl = `https://graph.facebook.com/v21.0/oauth/access_token`;
        const exchangeRes = await axios.get(exchangeUrl, {
            params: {
                grant_type: 'fb_exchange_token',
                client_id: APP_ID,
                client_secret: APP_SECRET,
                fb_exchange_token: userAccessToken
            }
        });

        const longLivedUserToken = exchangeRes.data.access_token;
        if (!longLivedUserToken) {
            return NextResponse.json({ error: 'Failed to get long-lived token' }, { status: 500 });
        }
        console.log('[exchange-token] ✅ Got long-lived user token');

        // STEP 2: Get Page Access Token from long-lived user token
        // Page tokens obtained from a long-lived user token are PERMANENT
        const accountsRes = await axios.get(`https://graph.facebook.com/v21.0/me/accounts`, {
            params: { access_token: longLivedUserToken }
        });

        const pages = accountsRes.data?.data || [];
        const targetPage = pages.find((p: any) => p.id === pageId);

        if (!targetPage) {
            console.warn('[exchange-token] Page not found in accounts:', pages.map((p: any) => p.id));
            return NextResponse.json({ error: `Page ${pageId} not found in user accounts` }, { status: 404 });
        }

        // This is the permanent Page Access Token 🎉
        const permanentPageToken = targetPage.access_token;
        console.log(`[exchange-token] ✅ Got PERMANENT page token for page ${pageId} (${targetPage.name})`);

        // STEP 3: ENFORCE WEBHOOK SUBSCRIPTION (The "Fix")
        // This tells Meta to start sending messages to our webhook for this page
        try {
            await axios.post(`https://graph.facebook.com/v21.0/${pageId}/subscribed_apps`, {
                subscribed_fields: [
                    'messages', 
                    'messaging_postbacks', 
                    'message_deliveries', 
                    'message_reads', 
                    'messaging_optins',
                    'instagram_manage_messages',
                    'instagram_manage_comments',
                    'feed'
                ]
            }, {
                params: { access_token: permanentPageToken }
            });
            console.log(`[exchange-token] 🔔 Webhook subscription confirmed for page ${pageId}`);
        } catch (subError: any) {
            console.warn(`[exchange-token] ⚠️ Failed to auto-subscribe page ${pageId}:`, subError.response?.data || subError.message);
            // We don't fail the whole request because we have the token, but we log it.
        }

        return NextResponse.json({
            success: true,
            pageToken: permanentPageToken,
            pageName: targetPage.name,
            pageId: targetPage.id
        });

    } catch (error: any) {
        const metaError = error.response?.data?.error;
        console.error('[exchange-token] ❌ Error:', metaError || error.message);
        return NextResponse.json(
            { error: 'Token exchange failed', details: metaError || error.message },
            { status: 500 }
        );
    }
}
