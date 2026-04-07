const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkIntegrations() {
    console.log('--- FULL INTEGRATIONS DATA ---');
    const snapshot = await db.collectionGroup('integrations').get();
    
    snapshot.forEach(doc => {
        if (!doc.ref.path.includes('_init')) {
            console.log(`Path: ${doc.ref.path}`);
            console.log(doc.data());
        }
    });
}

checkIntegrations().catch(console.error);
