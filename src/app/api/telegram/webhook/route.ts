import { NextResponse } from 'next/server';
import { db, admin } from '@/lib/firebase-admin';

export async function GET(req: Request) {
    return new Response('Telegram Webhook Active', { status: 200 });
}

export async function POST(req: Request) {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('u');
    const entityId = searchParams.get('e');

    if (!userId || !entityId) {
        return NextResponse.json({ success: false, error: 'Missing tenant context' }, { status: 400 });
    }

    try {
        const body = await req.json();
        
        // Telegram update object
        const message = body.message;
        if (!message || !message.text) {
            return NextResponse.json({ success: true, ignored: 'not_a_text_message' });
        }

        const telegramChatId = String(message.chat.id);
        const text = message.text;
        const firstName = message.from?.first_name || 'Usuario';
        const lastName = message.from?.last_name || '';
        const fullName = `${firstName} ${lastName}`.trim() || 'Usuario Telegram';

        const entityPath = `users/${userId}/entities/${entityId}`;

        // 1. Find or Create Contact
        const contactSnap = await db.collection(`${entityPath}/contacts`)
            .where('telegramChatId', '==', telegramChatId)
            .limit(1)
            .get();

        let cardId: string | null = null;
        let groupId: string | null = null;
        let contactId: string | null = null;

        const newMessage = {
            sender: 'user',
            text: text,
            timestamp: new Date(),
            messageId: `tg_${message.message_id}`,
            platform: 'telegram'
        };

        if (!contactSnap.empty) {
            const contactDoc = contactSnap.docs[0];
            const contactData = contactDoc.data();
            contactId = contactDoc.id;
            cardId = contactData.kanbanCardId;
            groupId = contactData.kanbanGroupId;

            if (cardId && groupId) {
                const cardRef = db.doc(`${entityPath}/kanban-groups/${groupId}/cards/${cardId}`);
                await cardRef.update({
                    lastMessage: text.length > 50 ? text.substring(0, 47) + '...' : text,
                    updatedAt: new Date(),
                    unreadCount: admin.firestore.FieldValue.increment(1),
                    messages: admin.firestore.FieldValue.arrayUnion(newMessage),
                    status: 'open'
                });
            }
        } else {
            // Create New Contact & Card
            const contactId = String(Date.now()).slice(-10);
            const groupsRef = db.collection(`${entityPath}/kanban-groups`);
            const groupsSnapshot = await groupsRef.get();
            
            const fallbackGroup = groupsSnapshot.docs.find(g => (g.data().name || '').toLowerCase().includes('inbox')) || groupsSnapshot.docs[0];
            const destinationGroupId = fallbackGroup ? fallbackGroup.id : 'default_inbox';

            if (destinationGroupId === 'default_inbox' && !fallbackGroup) {
                await db.collection(`${entityPath}/kanban-groups`).doc('default_inbox').set({
                    name: 'Inbox', order: 0, color: '#3B82F6', createdAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            }

            const newCardRef = db.collection(`${entityPath}/kanban-groups/${destinationGroupId}/cards`).doc();
            
            await newCardRef.set({
                crmId: contactId,
                contactName: fullName,
                contactNumber: telegramChatId,
                telegramChatId: telegramChatId,
                lastMessage: text.length > 50 ? text.substring(0, 47) + '...' : text,
                updatedAt: new Date(),
                createdAt: new Date(),
                messages: [newMessage],
                unreadCount: 1,
                status: 'open',
                source: 'telegram',
                primary_channel: 'telegram'
            });

            await db.collection(`${entityPath}/contacts`).doc(contactId).set({
                crmId: contactId,
                name: fullName,
                telegramChatId: telegramChatId,
                kanbanGroupId: destinationGroupId,
                kanbanCardId: newCardRef.id,
                origin: 'telegram',
                updatedAt: new Date().toISOString(),
                createdAt: new Date().toISOString()
            }, { merge: true });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[Telegram Webhook Error]', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
