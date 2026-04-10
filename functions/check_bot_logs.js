
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

async function checkBotLogs() {
    const userId = 'g02IGViHitZjPKlOuCG7j5J3uK33';
    const entityId = 'roosevelt';

    // Check the card directly
    const cardId = 'HNHCkxJn5G0t7S57GUp3'; // Card for "Usuario FB"
    const cardRef = db.doc(`users/${userId}/entities/${entityId}/kanban-groups/pmEXQBM3nCrR4KRLpjlc/cards/${cardId}`);
    const snap = await cardRef.get();

    if (!snap.exists) {
        console.log('Card not found');
        return;
    }

    const data = snap.data();
    console.log(`\nCard Messages for ${data.contactName}:`);
    data.messages?.slice(-5).forEach(m => {
        console.log(`[${m.sender}] ${m.text.substring(0, 50)}...`);
    });
}

checkBotLogs().catch(console.error);
