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
    console.log('--- Diagnosis:Checking for messages in the last 3 hours ---');
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000); 
    const contactSnap = await db.collection(`${entityPath}/contacts`).where('updatedAt', '>', threeHoursAgo).get();
    
    if (contactSnap.empty) {
        console.log('RESULT: No messages found.');
    } else {
        contactSnap.forEach(doc => {
            const data = doc.data();
            console.log(`RESULT: [FOUND] Contact: ${data.name}, Msg: "${data.lastMessage}", Time: ${data.updatedAt.toDate()}`);
        });
    }
}
check().catch(console.error);
