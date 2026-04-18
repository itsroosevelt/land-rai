const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
    console.log("Searching for 'Mey Titu'...");
    const cards = await db.collectionGroup('cards').get();
    
    let found = false;
    for (const doc of cards.docs) {
        const d = doc.data();
        if (d.contactName && d.contactName.toLowerCase().includes('mey titu')) {
            found = true;
            console.log(`\n--- ANALYSIS FOR CARD: ${doc.id} ---`);
            console.log(`Path: ${doc.ref.path}`);
            console.log(`Source: ${d.source}`);
            console.log(`Platform IDs:`, JSON.stringify(d.platform_ids));
            console.log(`Bot Status: ${d.botState?.status}`);
            console.log(`Current Node: ${d.botState?.currentNodeId}`);
            console.log(`Waiting for Input: ${d.botState?.waitingForInput}`);
            console.log(`Queue Size: ${d.botState?.messageQueue?.length}`);
            console.log(`Queue Contents:`, JSON.stringify(d.botState?.messageQueue));
            console.log(`Last Error: ${d.botState?.lastError}`);
            console.log(`Last Error At: ${d.botState?.lastErrorAt?.toDate ? d.botState?.lastErrorAt?.toDate() : d.botState?.lastErrorAt}`);
            console.log(`Bot Lock: ${d.botLock ? 'LOCKED at ' + (d.botLock.toDate ? d.botLock.toDate() : d.botLock) : 'UNLOCKED'}`);
            
            // Check if there are messages that were not processed
            const messages = d.messages || [];
            console.log(`Total Messages: ${messages.length}`);
            if (messages.length > 0) {
               const lastMsg = messages[messages.length - 1];
               console.log(`Last Recorded Message:`, JSON.stringify(lastMsg));
            }
        }
    }
    if (!found) console.log("Contact 'Mey Titu' not found in any card.");
}
run().catch(console.error);
