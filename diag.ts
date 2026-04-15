import { admin, db } from './src/lib/firebase-admin';

async function run() {
    const logsSnap = await db.collectionGroup('system_logs')
        .orderBy('timestamp', 'desc')
        .limit(5)
        .get();

    console.log("--- RECENT SYSTEM LOGS ---");
    logsSnap.forEach(doc => {
        console.log(doc.id, doc.data());
    });

    const cardsSnap = await db.collectionGroup('cards')
        .where('platform_ids.messenger', '!=', null)
        .limit(3)
        .get();

    console.log("\n--- RECENT MESSENGER CARDS ---");
    cardsSnap.forEach(doc => {
        const d = doc.data();
        console.log("Card ID:", doc.id);
        console.log("botState:", JSON.stringify(d.botState, null, 2));
    });
    
    process.exit(0);
}

run().catch(console.error);
