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
    console.log('--- Diagnosis:Checking for "PRUEBA FINAL" at 6:02 PM ---');
    const tenMinAgo = new Date(Date.now() - 30 * 60 * 1000); // 30 mins to be sure
    const contactSnap = await db.collection(`${entityPath}/contacts`).where('updatedAt', '>', tenMinAgo).get();
    
    if (contactSnap.empty) {
        console.log('RESULT: No messages found in the last 30 minutes.');
    } else {
        contactSnap.forEach(doc => {
            const data = doc.data();
            console.log(`RESULT: [FOUND] Contact: ${data.name}, Message: "${data.lastMessage}", Time: ${data.updatedAt.toDate()}`);
        });
    }
}
check().catch(console.error);
