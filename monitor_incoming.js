const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();
const entityPath = 'users/g02IGViHitZjPKlOuCG7j5J3uK33/entities/roosevelt';

async function monitor() {
    console.log('--- Monitoring for New Inbound Messages (Meta) ---');
    const contactsSnap = await db.collection(`${entityPath}/contacts`).orderBy('updatedAt', 'desc').limit(5).get();
    
    contactsSnap.forEach(doc => {
        const data = doc.data();
        console.log(`\nContact: ${data.name}`);
        console.log(`  Last Message: ${data.lastMessage}`);
        console.log(`  Platform: ${data.origin || 'unknown'}`);
        console.log(`  Updated At: ${data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt}`);
    });
}

monitor().catch(console.error);
