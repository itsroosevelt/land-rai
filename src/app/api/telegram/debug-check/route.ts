import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { db } from '@/lib/firebase-admin';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('u');
    const entityId = searchParams.get('e');

    if (!userId || !entityId) return NextResponse.json({ error: 'Missing params' });

    try {
        const path = `users/${userId}/entities/${entityId}`;
        const resetCardId = searchParams.get('resetCard');

        if (resetCardId) {
            const groupsSnap = await db.collection(`${path}/kanban-groups`).get();
            for (const gDoc of groupsSnap.docs) {
                const cardRef = gDoc.ref.collection('cards').doc(resetCardId);
                const snap = await cardRef.get();
                if (snap.exists) {
                    await cardRef.update({
                        'botState.messageQueue': [],
                        'botState.lastProcessedMessageId': null,
                        'botState.status': 'active',
                        'botState.currentNodeId': null,
                        'botState.waitingForInput': false,
                        botLock: admin.firestore.FieldValue.delete()
                    });
                }
            }
        }

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
                    rawKeys: Object.keys(c.data()),
                    botLock: c.data().botLock || null,
                    ...c.data()
                });
            });
        }

        // 1. Fetch Integration Data
        const integrationSnap = await db.doc(`${path}/integrations/telegram`).get();
        const integrationData = integrationSnap.exists ? integrationSnap.data() : null;
        const botToken = integrationData?.botToken;

        let telegramApiStatus = "No token found";
        if (botToken) {
            try {
                const res = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
                telegramApiStatus = await res.json();
            } catch (e: any) {
                telegramApiStatus = `Error connecting to Telegram: ${e.message}`;
            }
        }

        // 2. Fetch Active Chatbots
        let activeChatbots: any[] = [];
        try {
            const botsSnap = await db.collection(`${path}/chatbots`)
                .get();
            botsSnap.forEach(doc => {
                activeChatbots.push({ id: doc.id, ...doc.data() });
            });
        } catch (e) {
            console.error("Error fetching chatbots", e);
        }

        // 3. Fetch recent webhook logs
        let webhookLogs: any[] = [];
        try {
            const logsSnap = await db.collection(`${path}/internal_logs`)
                .orderBy('timestamp', 'desc')
                .limit(20)
                .get();
            logsSnap.forEach(doc => {
                webhookLogs.push({ id: doc.id, ...doc.data() });
            });
        } catch (e) {
            console.error("Error fetching logs", e);
        }

        return NextResponse.json({
            status: 'Diagnostic Report',
            entityPath: path,
            telegramConfig: {
                hasToken: !!botToken,
                maskedToken: botToken ? `${botToken.substring(0, 6)}...${botToken.substring(botToken.length - 4)}` : null,
                data: integrationData,
                telegramApiStatus
            },
            botState: {
                activeChatbots,
                count: activeChatbots.length
            },
            activeChatbots,
            groupsFound: groups,
            totalCards: allCards.length,
            allTelegramCards: allCards.filter(c => (c.source === 'TELEGRAM' || c.channel === 'telegram')),
            recentCards: allCards.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0)).slice(0, 5),
            recentWebhookLogs: webhookLogs
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message });
    }
}
