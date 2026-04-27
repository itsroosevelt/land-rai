import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('u');
    const entityId = searchParams.get('e');

    if (!userId || !entityId) return NextResponse.json({ error: 'Missing params' });

    try {
        const path = `users/${userId}/entities/${entityId}`;
        const groupsSnap = await db.collection(`${path}/kanban-groups`).get();
        
        const groups = groupsSnap.docs.map(d => ({ id: d.id, name: d.data().name }));
        
        const allCards: any[] = [];
        for (const group of groupsSnap.docs) {
            const cardsSnap = await group.ref.collection('cards').get();
            cardsSnap.forEach(c => {
                allCards.push({
                    groupId: group.id,
                    groupName: group.data().name,
                    cardId: c.id,
                    ...c.data()
                });
            });
        }

        // Search for our test message
        const testCard = allCards.find(c => c.contactName === 'SOPORTE ANTIGRAVITY');

        return NextResponse.json({
            status: 'Diagnostic Report',
            entityPath: path,
            groupsFound: groups,
            totalCards: allCards.length,
            testCardFound: !!testCard,
            allTelegramCards: allCards.filter(c => (c.source === 'TELEGRAM' || c.channel === 'telegram')),
            recentCards: allCards.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0)).slice(0, 5)
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message });
    }
}
