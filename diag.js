const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

// Minimal init, assuming env vars match
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = getFirestore();

async function run() {
    const logsSnap = await db.collectionGroup('system_logs')
        .orderBy('timestamp', 'desc')
        .limit(5)
        .get();

    console.log("--- RECENT SYSTEM LOGS ---");
    logsSnap.forEach(doc => {
        const d = doc.data();
        console.log("Time:", d.timestamp?.toDate(), "Type:", d.type);
    });

    const cardsSnap = await db.collectionGroup('cards')
        .where('platform_ids.messenger', '!=', null)
        .limit(2)
        .get();

    console.log("\n--- RECENT CARDS ---");
    cardsSnap.forEach(doc => {
        const d = doc.data();
        console.log("Card:", doc.id, "Name:", d.contactName);
        console.log("Status:", d.botState?.status, "Q len:", d.botState?.messageQueue?.length);
    });
    
    process.exit(0);
}

run().catch(console.log);
