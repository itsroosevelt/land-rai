const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();
const entityPath = 'users/g02IGViHitZjPKlOuCG7j5J3uK33/entities/roosevelt';

async function checkRecent() {
    console.log('--- Checking Cards in Roosevelt ---');
    const groupsRef = db.collection(`${entityPath}/kanban-groups`);
    const groupsSnap = await groupsRef.get();
    
    for (const groupDoc of groupsSnap.docs) {
        console.log(`\nGroup: ${groupDoc.id} (${groupDoc.data().name})`);
        const cardsSnap = await groupDoc.ref.collection('cards').orderBy('updatedAt', 'desc').limit(5).get();
        cardsSnap.forEach(cardDoc => {
            const data = cardDoc.data();
            console.log(`  Card: ${data.contactName} (${data.source || 'unknown'}) - Last Msg: ${data.lastMessage}`);
            console.log(`  Updated At: ${data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt}`);
        });
    }

    console.log('\n--- Checking Contacts ---');
    const contactsSnap = await db.collection(`${entityPath}/contacts`).orderBy('updatedAt', 'desc').limit(5).get();
    contactsSnap.forEach(doc => {
        const data = doc.data();
        console.log(`  Contact: ${data.name} (Origin: ${data.origin}) - Created: ${data.createdAt}`);
    });
}

checkRecent().catch(console.error);
