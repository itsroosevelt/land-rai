const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();
const userId = 'g02IGViHitZjPKlOuCG7j5J3uK33';

async function findMessages() {
    const entitiesSnap = await db.collection(`users/${userId}/entities`).get();
    console.log(`Scanning ${entitiesSnap.size} entities for user ${userId}...`);

    for (const entityDoc of entitiesSnap.docs) {
        const entityId = entityDoc.id;
        console.log(`\n--- Checking Entity: ${entityId} ---`);
        
        // Search contacts
        const contactsSnap = await db.collection(`users/${userId}/entities/${entityId}/contacts`).get();
        contactsSnap.forEach(c => {
            const data = c.data();
            console.log(`  Contact: ${data.name} (SenderId: ${data.metaSenderId || 'N/A'})`);
        });

        // Search messages in cards
        const groupsSnap = await db.collection(`users/${userId}/entities/${entityId}/kanban-groups`).get();
        for (const groupDoc of groupsSnap.docs) {
            const cardsSnap = await groupDoc.ref.collection('cards').get();
            cardsSnap.forEach(card => {
                const data = card.data();
                if (data.lastMessage === '123' || data.lastMessage === 'sda' || data.lastMessage === 'HOLA') {
                    console.log(`  [MATCH] Found message "${data.lastMessage}" in Entity: ${entityId}, Group: ${groupDoc.id}`);
                }
            });
        }
    }
}

findMessages().catch(console.error);
