import { NextResponse } from 'next/server';
import { db, admin } from '@/lib/firebase-admin';
import axios from 'axios';
import { getGmailAccessToken } from '@/lib/googleAuth';
import { processChatbotFlow } from '@/lib/chatbotEngine';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const message = body.message;

        if (!message || !message.data) {
            return NextResponse.json({ success: true, ignored: 'no_data' });
        }

        // 1. Decode Pub/Sub Data
        const decodedData = JSON.parse(Buffer.from(message.data, 'base64').toString());
        const emailAddress = decodedData.emailAddress;
        
        console.log(`[Gmail Webhook] Notification for ${emailAddress}`);

        // 2. Identify Tenant
        const tenantSnap = await db.collectionGroup('integrations')
            .where('gmailAddress', '==', emailAddress)
            .limit(1)
            .get();

        if (tenantSnap.empty) return NextResponse.json({ success: false, error: 'Tenant not found' });

        const pathParts = tenantSnap.docs[0].ref.path.split('/');
        const userId = pathParts[1];
        const entityId = pathParts[3];
        const entityPath = `users/${userId}/entities/${entityId}`;

        // 3. Fetch Latest Email
        const accessToken = await getGmailAccessToken(userId, entityId);
        const listRes = await axios.get(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=1&q=is:unread`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        if (!listRes.data.messages || listRes.data.messages.length === 0) {
            return NextResponse.json({ success: true });
        }

        const msgId = listRes.data.messages[0].id;
        const msgRes = await axios.get(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        const msgData = msgRes.data;
        const fromHeader = msgData.payload.headers.find((h: any) => h.name === 'From')?.value || '';
        const subject = msgData.payload.headers.find((h: any) => h.name === 'Subject')?.value || '';
        const bodySnippet = msgData.snippet || '';

        // Extract clean email from "Name <email@gmail.com>"
        const fromEmail = fromHeader.includes('<') ? fromHeader.match(/<(.*)>/)?.[1] : fromHeader;

        if (!fromEmail) return NextResponse.json({ success: true });

        // 4. CRM Integration (Find or Create Card)
        const threadId = msgData.threadId;
        const fromName = fromHeader.split('<')[0].trim() || 'Remitente Gmail';

        const newMessage = {
            sender: 'user',
            text: bodySnippet,
            timestamp: new Date(),
            messageId: `gm_${msgId}`,
            platform: 'gmail',
            subject: subject
        };

        let targetCardDoc: any = null;
        let targetGroupId: string | null = null;
        let existingContactId: string | null = null;

        // Try to find if user exists by email in Contacts
        const contactSnap = await db.collection(`${entityPath}/contacts`)
            .where('email', '==', fromEmail)
            .limit(1)
            .get();

        if (!contactSnap.empty) {
            const contactDoc = contactSnap.docs[0];
            const contactData = contactDoc.data();
            existingContactId = contactDoc.id;
            targetGroupId = contactData.kanbanGroupId;
            const contactCardId = contactData.kanbanCardId;

            if (targetGroupId && contactCardId) {
                const cardRef = db.doc(`${entityPath}/kanban-groups/${targetGroupId}/cards/${contactCardId}`);
                const cardGet = await cardRef.get();
                if (cardGet.exists) {
                    targetCardDoc = cardGet;
                }
            }
        }

        // FALLBACK SEARCH: Deep scan across all groups for threadId
        if (!targetCardDoc) {
             console.log(`[Gmail] No card found via contact. Deep searching threadId: ${threadId}...`);
             const allMatches: any[] = [];
             const groupsRef = db.collection(`${entityPath}/kanban-groups`);
             const groupsSnapshot = await groupsRef.get();

             for (const groupDoc of groupsSnapshot.docs) {
                 const cardsSnapshot = await groupDoc.ref.collection('cards')
                     .where('platform_ids.gmail', '==', threadId)
                     .orderBy('updatedAt', 'desc')
                     .limit(1)
                     .get();

                 cardsSnapshot.forEach(doc => {
                     allMatches.push({ doc, groupId: groupDoc.id });
                 });
             }

             if (allMatches.length > 0) {
                 allMatches.sort((a, b) => {
                     const tA = (a.doc.data().updatedAt?.toDate?.() || new Date(0)).getTime();
                     const tB = (b.doc.data().updatedAt?.toDate?.() || new Date(0)).getTime();
                     return tB - tA;
                 });
                 targetCardDoc = allMatches[0].doc;
                 targetGroupId = allMatches[0].groupId;
             }
        }

        let cardId: string | null = targetCardDoc?.id || null;
        let groupId: string | null = targetGroupId || null;

        if (targetCardDoc && groupId) {
            const cardRef = targetCardDoc.ref;
            await cardRef.update({
                lastMessage: bodySnippet.substring(0, 50),
                updatedAt: new Date(),
                unreadCount: admin.firestore.FieldValue.increment(1),
                messages: admin.firestore.FieldValue.arrayUnion(newMessage),
                status: 'open',
                source: 'GMAIL'
            });
        } else {
            // Create New Contact & Card
            const finalContactId = existingContactId || String(Date.now()).slice(-10);
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
                crmId: finalContactId,
                contactName: fromName,
                email: fromEmail,
                gmailThreadId: threadId,
                lastMessage: bodySnippet.substring(0, 50),
                updatedAt: new Date(),
                createdAt: new Date(),
                messages: [newMessage],
                unreadCount: 1,
                status: 'open',
                source: 'GMAIL',
                primary_channel: 'gmail',
                platform_ids: { gmail: threadId }
            });

            await db.collection(`${entityPath}/contacts`).doc(finalContactId).set({
                crmId: finalContactId,
                name: fromName,
                email: fromEmail,
                kanbanGroupId: destinationGroupId,
                kanbanCardId: newCardRef.id,
                source: 'GMAIL',
                updatedAt: new Date().toISOString(),
                createdAt: new Date().toISOString()
            }, { merge: true });

            cardId = newCardRef.id;
            groupId = destinationGroupId;
        }

        // 5. TRIGGER UNIVERSAL CHATBOT
        if (groupId && cardId) {
            processChatbotFlow({
                userId, 
                entityId, 
                groupId, 
                cardId, 
                platform: 'gmail', 
                from: fromEmail, 
                text: bodySnippet,
                messageId: `gm_${msgId}`
            }).catch(error => {
                 console.error(`[Gmail Chatbot Error] ${error}`);
            });
        }

        return NextResponse.json({ success: true });

    } catch (err: any) {
        console.error('[Gmail Webhook Error]', err.message);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
