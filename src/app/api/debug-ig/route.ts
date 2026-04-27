import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const snap = await db.collectionGroup('integrations').get();
        const data = snap.docs
            .filter(d => d.ref.path.includes('roosevelt'))
            .map(d => {
                const dbData = d.data();
                return {
                    id: d.id,
                    path: d.ref.path,
                    pageId: dbData.pageId || null,
                    instagramId: dbData.instagramId || null,
                    active: dbData.isActive
                };
            });
        return NextResponse.json({ success: true, count: data.length, data });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message });
    }
}
