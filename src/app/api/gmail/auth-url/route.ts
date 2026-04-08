import { NextResponse } from 'next/server';

const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const REDIRECT_URI = process.env.GMAIL_REDIRECT_URI;

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('u');
    const entityId = searchParams.get('e');

    if (!userId || !entityId) {
        return NextResponse.json({ error: 'Missing context' }, { status: 400 });
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
    
    return NextResponse.json({ url: authUrl });
}
