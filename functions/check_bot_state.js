
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

async function checkBotState() {
    const cardId = 'HNHCkxJn5G0t7S57GUp3';
    const cardRef = db.doc(`users/g02IGViHitZjPKlOuCG7j5J3uK33/entities/roosevelt/kanban-groups/pmEXQBM3nCrR4KRLpjlc/cards/${cardId}`);
    const snap = await cardRef.get();

    if (!snap.exists) {
        console.log('Card not found');
        return;
    }

    const data = snap.data();
    console.log('Bot State:', JSON.stringify(data.botState || data.chatbotState, null, 2));
    console.log('Bot Lock:', data.botLock);
}

checkBotState().catch(console.error);
