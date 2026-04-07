const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function check() {
    console.log('--- Checking for PRUEBA_IG_VAL ---');
    const cardsSnap = await db.collectionGroup('cards').get();
    cardsSnap.forEach(doc => {
        const data = doc.data();
        if (data.lastMessage === 'PRUEBA_IG_VAL') {
            console.log(`[GOT IT!] Message: ${data.lastMessage} in ${doc.ref.path}`);
        }
    });
}
check();
