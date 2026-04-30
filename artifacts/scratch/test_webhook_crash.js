const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Mock request body
const mockBody = {
    message: {
        message_id: 12345,
        from: { id: 7151193201, first_name: 'LUXOR' },
        chat: { id: 7151193201, type: 'private' },
        text: 'test message',
        date: Math.floor(Date.now() / 1000)
    }
};

const saPath = path.resolve(__dirname, '../../functions/serviceAccountKey.json');
const sa = require(saPath);
if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

async function testWebhook() {
    const userId = 'g02IGViHitZjPKlOuCG7j5J3uK33';
    const entityId = 'roosevelt';
    const entityPath = `users/${userId}/entities/${entityId}`;
    const finalEntityPath = entityPath;

    const body = mockBody;
    const message = body.message;
    const telegramChatId = String(message.chat.id);
    const text = message.text;

    console.log('Testing webhook for chatId:', telegramChatId);

    // Replicate logic from route.ts
    let targetCardDoc = null;
    let targetGroupId = null;
    let existingContactId = null;

    const contactSnap = await db.collection(`${entityPath}/contacts`)
        .where('telegramChatId', '==', telegramChatId)
        .limit(1)
        .get();

    if (!contactSnap.empty) {
        const contactDoc = contactSnap.docs[0];
        const contactData = contactDoc.data();
        existingContactId = contactDoc.id;
        targetGroupId = contactData.kanbanGroupId;
        const contactCardId = contactData.kanbanCardId;
        console.log('Found contact:', existingContactId, 'GroupId:', targetGroupId);

        if (targetGroupId && contactCardId) {
            const cardRef = db.doc(`${entityPath}/kanban-groups/${targetGroupId}/cards/${contactCardId}`);
            const cardGet = await cardRef.get();
            if (cardGet.exists) {
                targetCardDoc = cardGet;
                console.log('Found card via contact!');
            } else {
                console.log('Card does not exist at:', cardRef.path);
            }
        }
    }

    if (!targetCardDoc) {
        console.log('Fallback search...');
        const allMatches = [];
        const groupsRef = db.collection(`${entityPath}/kanban-groups`);
        const groupsSnapshot = await groupsRef.get();
        for (const groupDoc of groupsSnapshot.docs) {
            const cardsSnapshot = await groupDoc.ref.collection('cards')
                .where('telegramChatId', '==', telegramChatId)
                .limit(1)
                .get();
            cardsSnapshot.forEach(doc => {
                allMatches.push({ doc, groupId: groupDoc.id });
            });
        }
        if (allMatches.length > 0) {
            targetCardDoc = allMatches[0].doc;
            targetGroupId = allMatches[0].groupId;
            console.log('Found card via deep search in group:', targetGroupId);
        }
    }

    if (targetCardDoc && targetGroupId) {
        console.log('Executing transaction update...');
        // Mock transaction
        const cardRef = targetCardDoc.ref;
        const freshSnap = await cardRef.get();
        const freshData = freshSnap.data() || {};
        
        // This is where it might fail if there's a typo in the code
        console.log('Group ID is:', targetGroupId);
        console.log('Card Path:', cardRef.path);
        
        // Let's actually TRY the update
        await cardRef.update({
            lastMessage: text,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            unreadCount: admin.firestore.FieldValue.increment(1)
        });
        console.log('Update successful!');
    } else {
        console.log('Creating NEW card logic...');
        const groupsSnapshot = await db.collection(`${finalEntityPath}/kanban-groups`).get();
        const mainGroup = groupsSnapshot.docs.find(g => {
            const name = (g.data().name || '').toLowerCase();
            return name === 'inbox' || name === 'bandeja de entrada';
        });
        
        let destinationGroupId = '';
        if (mainGroup) {
            destinationGroupId = mainGroup.id;
        } else {
             console.log('Main group not found!');
        }
        console.log('Destination group:', destinationGroupId);
    }
}

testWebhook().then(() => process.exit(0)).catch(err => {
    console.error('CRASH:', err);
    process.exit(1);
});
