import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    const keys = Object.keys(process.env);
    const metaKeys = keys.filter(k => k.includes('META'));
    
    return NextResponse.json({
        message: "Diagnostic Route",
        totalKeys: keys.length,
        metaKeysFound: metaKeys,
        hasAppId: !!process.env.NEXT_PUBLIC_META_APP_ID,
        hasAppSecret: !!process.env.META_APP_SECRET,
        // Mostramos solo los primeros 3 caracteres por seguridad
        appIdPreview: process.env.NEXT_PUBLIC_META_APP_ID ? process.env.NEXT_PUBLIC_META_APP_ID.substring(0, 3) + '...' : 'null',
        secretPreview: process.env.NEXT_PUBLIC_META_APP_SECRET ? process.env.NEXT_PUBLIC_META_APP_SECRET.substring(0, 3) + '...' : 'null'
    });
}
