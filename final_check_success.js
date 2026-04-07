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
    console.log('--- Checking for REAL Messages in roosevelt ---');
    const contactSnap = await db.collection(`${entityPath}/contacts`).orderBy('updatedAt', 'desc').get();
    
    if (contactSnap.empty) {
        console.log('No contacts found.');
        return;
    }

    contactSnap.forEach(doc => {
        const data = doc.data();
        console.log(`\nContact: ${data.name} [ID: ${doc.id}]`);
        console.log(`  Last Message: "${data.lastMessage}"`);
        console.log(`  Source: ${data.origin || 'unknown'}`);
        console.log(`  UpdatedAt: ${data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt}`);
    });
}

check().catch(console.error);
