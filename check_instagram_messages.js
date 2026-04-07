const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkMessages() {
    console.log('--- Searching for Instagram test messages: "123", "kasldas", "jgf" ---');
    const cardsSnap = await db.collectionGroup('cards').get();
    
    let found = false;
    cardsSnap.forEach(doc => {
        const data = doc.data();
        if (data.lastMessage === '123' || data.lastMessage === 'kasldas' || data.lastMessage === 'jgf') {
            console.log(`\n[FOUND] Message: "${data.lastMessage}"`);
            console.log(`Path: ${doc.ref.path}`);
            console.log(`UpdatedAt: ${data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt}`);
            found = true;
        }
    });

    if (!found) {
        console.log('No matching messages found in any card.');
    }
}

checkMessages().catch(console.error);
