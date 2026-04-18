const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
    console.log("Searching for Messenger cards...");
    const cards = await db.collectionGroup('cards')
        .where('source', '==', 'MESSENGER')
        .get();
        
    cards.forEach(doc => {
        const d = doc.data();
        if (d.botState?.lastError) {
             console.log(`\nCard ID: ${doc.id} (${d.contactName})`);
             console.log(`LastError: ${d.botState.lastError}`);
             console.log(`LastErrorAt: ${d.botState.lastErrorAt?.toDate()}`);
        }
    });

    const ints = await db.collectionGroup('integrations').where('provider', '==', 'messenger').get();
    ints.forEach(doc => {
       console.log(`\nIntegration: ${doc.id}`);
       console.log(`pageId:`, doc.data().pageId);
       console.log(`status:`, doc.data().status);
       console.log(`token length:`, doc.data().accessToken?.length);
    });
}
run().catch(console.error);
