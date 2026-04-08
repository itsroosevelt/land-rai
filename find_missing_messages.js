const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db = admin.firestore();

async function check() {
    console.log('--- Diagnosis: Global Search for TEST_BASE64 or PRUEBA FINAL ---');
    const contactSnap = await db.collectionGroup('contacts').orderBy('updatedAt', 'desc').limit(20).get();
    
    if (contactSnap.empty) {
        console.log('No recent contacts modified anywhere.');
    } else {
        contactSnap.forEach(doc => {
            const data = doc.data();
            console.log(`[${doc.ref.path}] | Name: ${data.name} | Msg: ${data.lastMessage} | Orig: ${data.origin || 'unknown'}`);
        });
    }
}
check().catch(console.error);
