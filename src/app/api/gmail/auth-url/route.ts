import { NextResponse } from 'next/server';

const CLIENT_ID = process.env.GMAIL_CLIENT_ID?.replace(/\"/g, '').trim();
const REDIRECT_URI = process.env.GMAIL_REDIRECT_URI?.replace(/\"/g, '').trim();

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('u');
    const entityId = searchParams.get('e');

    if (!userId || !entityId) {
        return NextResponse.json({ error: 'Missing context' }, { status: 400 });
    }

    if (!CLIENT_ID || !REDIRECT_URI) {
        console.error('[Gmail Auth Error] Missing configuration in environment variables (GMAIL_CLIENT_ID or GMAIL_REDIRECT_URI)');
        return NextResponse.json({ 
            error: 'Missing Gmail configuration', 
            details: 'Required environment variables are not set on the server.',
            missing: { CLIENT_ID: !CLIENT_ID, REDIRECT_URI: !REDIRECT_URI }
        }, { status: 500 });
    }

    const scopes = [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile'
    ];
    
    const state = Buffer.from(JSON.stringify({ userId, entityId })).toString('base64');
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${CLIENT_ID}&` +
        `redirect_uri=${encodeURIComponent(REDIRECT_URI!)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent(scopes.join(' '))}&` +
        `access_type=offline&` +
        `prompt=consent&` +
        `state=${state}`;

    console.log(`[Gmail Auth] Generated URL for ${entityId}. Redirecting to: ${REDIRECT_URI}`);
    
    return NextResponse.json({ url: authUrl });
}
