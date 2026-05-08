import axios from 'axios';
import { db } from './firebase-admin';

const CLIENT_ID = process.env.GMAIL_CLIENT_ID?.trim();
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET?.trim();
const REDIRECT_URI = process.env.GMAIL_REDIRECT_URI?.trim();

export async function getGoogleAuthUrl(userId: string, entityId: string) {
    const scopes = [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile'
    ];
    
    const state = Buffer.from(JSON.stringify({ userId, entityId })).toString('base64');
    const url = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${CLIENT_ID}&` +
        `redirect_uri=${encodeURIComponent(REDIRECT_URI!)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent(scopes.join(' '))}&` +
        `access_type=offline&` +
        `prompt=consent&` +
        `state=${state}`;
    
    console.log(`[GoogleAuth Lib] Generating URL. ClientID: ${CLIENT_ID?.substring(0, 5)}... RedirectURI: ${REDIRECT_URI}`);
    return url;
}

export async function exchangeCodeForTokens(code: string) {
    const response = await axios.post('https://oauth2.googleapis.com/token', {
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code'
    });
    
    return response.data; // access_token, refresh_token, expires_in
}

export async function refreshGoogleToken(refreshToken: string) {
    const response = await axios.post('https://oauth2.googleapis.com/token', {
        refresh_token: refreshToken,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'refresh_token'
    });
    
    return response.data; // new access_token, expires_in
}

export async function getGmailAccessToken(userId: string, entityId: string) {
    const docRef = db.doc(`users/${userId}/entities/${entityId}/integrations/gmail_internal`);
    const docSnap = await docRef.get();
    
    if (!docSnap.exists) throw new Error('Gmail not connected');
    
    const data = docSnap.data()!;
    const now = Date.now();
    
    if (data.expiresAt && data.expiresAt > now + 300000) { // 5 mins buffer
        return data.accessToken;
    }
    
    if (!data.refreshToken) throw new Error('No refresh token available');
    
    const refreshed = await refreshGoogleToken(data.refreshToken);
    const newAccessToken = refreshed.access_token;
    const expiresAt = Date.now() + (refreshed.expires_in * 1000);
    
    await docRef.update({
        accessToken: newAccessToken,
        expiresAt: expiresAt
    });
    
    return newAccessToken;
}
