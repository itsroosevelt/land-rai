
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

async function checkIntegrations() {
    const u = 'g02IGViHitZjPKlOuCG7j5J3uK33';
    const e = 'roosevelt';

    const mSnap = await db.doc(`users/${u}/entities/${e}/integrations/messenger`).get();
    console.log('Messenger Integration:', mSnap.exists ? mSnap.data() : 'NotFound');

    const iSnap = await db.doc(`users/${u}/entities/${e}/integrations/instagram`).get();
    console.log('Instagram Integration:', iSnap.exists ? iSnap.data() : 'NotFound');
}

checkIntegrations().catch(console.error);
