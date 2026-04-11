const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
    console.log("Searching for Messenger/Instagram integrations across all users...");
    const snaps = await db.collectionGroup('integrations').get();
    
    snaps.forEach(doc => {
        const d = doc.data();
        if (d.provider === 'messenger' || d.provider === 'instagram' || d.pageId) {
            console.log(`\nDoc: ${doc.ref.path}`);
            console.log(`Provider: ${d.provider} | Status: ${d.status}`);
            console.log(`PageID: ${d.pageId} | InstaID: ${d.instagramId}`);
        }
    });
}
run().catch(console.error);
