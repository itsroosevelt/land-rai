const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
    const entityPath = `users/g02IGViHitZjPKlOuCG7j5J3uK33/entities/roosevelt`;
    const now = new Date();
    const fiveMinsAgo = new Date(now.getTime() - 5 * 60 * 1000);

    console.log(`Checking logs since: ${fiveMinsAgo.toISOString()}`);
    
    const logs = await db.collection(`${entityPath}/system_logs`)
        .where('timestamp', '>', fiveMinsAgo)
        .orderBy('timestamp', 'desc')
        .get();

    console.log(`Found ${logs.size} logs.`);
    logs.forEach(doc => {
        const d = doc.data();
        console.log(`\n--- Log: ${d.type} ---`);
        console.log(`Time: ${d.timestamp?.toDate()?.toLocaleTimeString()}`);
        console.log(`Sender: ${d.senderId}`);
        if (d.raw) console.log(`Raw snippet: ${d.raw.substring(0, 300)}...`);
    });

    // Check Mey Titu card specifically for lastError
    const card = await db.doc(`${entityPath}/kanban-groups/pmEXQBM3nCrR4KRLpjlc/cards/toojj5aH3zWJgLq9mlkr`).get();
    const d = card.data();
    console.log(`\n--- MEY TITU CARD STATUS ---`);
    console.log(`Queue:`, d.botState?.messageQueue?.length);
    console.log(`LastError:`, d.botState?.lastError);
    console.log(`LastErrorAt:`, d.botState?.lastErrorAt?.toDate?.() || d.botState?.lastErrorAt);
    console.log(`BotLock:`, d.botLock ? 'LOCKED' : 'UNLOCKED');
}
run().catch(console.error);
