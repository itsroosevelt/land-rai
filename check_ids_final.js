const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();
const entityPath = 'users/g02IGViHitZjPKlOuCG7j5J3uK33/entities/roosevelt';

async function check() {
    console.log('--- Verificando IDs en Roosevelt ---');
    const integrationsSnap = await db.collection(`${entityPath}/integrations`).get();
    
    integrationsSnap.forEach(doc => {
        const data = doc.data();
        console.log(`\nIntegración: ${data.provider}`);
        console.log(`  pageId: ${data.pageId}`);
        console.log(`  instagramId: ${data.instagramId}`);
    });
}

check().catch(console.error);
