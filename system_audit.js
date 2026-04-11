const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
    console.log("--- SYSTEM HEALTH AUDIT ---");
    
    // 1. Check for recent Webhook Logs
    const users = await db.collection('users').limit(1).get();
    if (users.empty) { console.log("No users found."); return; }
    
    const u = users.docs[0];
    const ents = await u.ref.collection('entities').limit(1).get();
    if (ents.empty) { console.log("No entities found."); return; }
    
    const e = ents.docs[0];
    const entityPath = `users/${u.id}/entities/${e.id}`;
    
    console.log(`Auditing Entity: ${e.id} (${entityPath})`);

    // 2. Recent Logs
    const logs = await db.collection(`${entityPath}/system_logs`)
        .orderBy('timestamp', 'desc')
        .limit(10)
        .get();
        
    console.log("\n[Recent Logs]");
    logs.forEach(doc => {
        const d = doc.data();
        console.log(`- ${d.timestamp?.toDate()?.toISOString() || 'N/A'}: ${d.type} | Sender: ${d.senderId}`);
    });

    // 3. Check Channel Connections
    const ints = await db.collection(`${entityPath}/integrations`).get();
    console.log("\n[Active Channels]");
    ints.forEach(doc => {
        const d = doc.data();
        console.log(`- ${doc.id.toUpperCase()}: Status=${d.status || 'Active'} | Info=${d.gmailAddress || d.phoneNumber || d.pageId || d.botToken || 'Connected'}`);
    });

    // 4. Check for 'Locked' cards (Potential Deadlocks)
    const cards = await db.collectionGroup('cards')
        .where('botLock', '!=', null)
        .get();
    
    console.log("\n[Locked Sessions (Potential issues if old)]");
    cards.forEach(doc => {
        const d = doc.data();
        const lockTime = d.botLock.toDate?.() || new Date(d.botLock);
        const age = (Date.now() - lockTime.getTime()) / 1000;
        console.log(`- Card ${doc.id}: Locked ${age}s ago | Source: ${d.source}`);
    });
}
run().catch(console.error);
