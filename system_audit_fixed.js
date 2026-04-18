const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
    console.log("--- SYSTEM PERFORMANCE AUDIT ---");
    
    const entityPath = `users/g02IGViHitZjPKlOuCG7j5J3uK33/entities/roosevelt`;
    
    // 1. Webhook Logs Check
    const logs = await db.collection(`${entityPath}/system_logs`)
        .orderBy('timestamp', 'desc')
        .limit(15)
        .get();
        
    console.log("\n[Recent Webhook Activity]");
    logs.forEach(doc => {
        const d = doc.data();
        console.log(`- ${d.timestamp?.toDate()?.toLocaleTimeString()}: ${d.type} | From: ${d.senderId}`);
    });

    // 2. Integration Status
    const ints = await db.collection(`${entityPath}/integrations`).get();
    console.log("\n[Channel Status]");
    ints.forEach(doc => {
        const d = doc.data();
        console.log(`- ${doc.id.toUpperCase()}: ${d.status || 'Connected'} | ${d.gmailAddress || d.phoneNumber || 'Ready'}`);
    });

    // 3. Queue & Lock Health (Manual Iteration)
    console.log("\n[Chatbot Session Health]");
    const groups = await db.collection(`${entityPath}/kanban-groups`).get();
    for (const group of groups.docs) {
        const cards = await group.ref.collection('cards').limit(20).get();
        cards.forEach(card => {
            const d = card.data();
            const queueSize = d.botState?.messageQueue?.length || 0;
            if (queueSize > 0 || d.botLock) {
                const lockStatus = d.botLock ? '🔒 LOCKED' : '✅ READY';
                console.log(`- Contact: ${d.contactName} (${d.source}) | Queue: ${queueSize} | ${lockStatus}`);
                if (d.botState?.lastError) console.log(`  └─ Error: ${d.botState.lastError.substring(0, 100)}`);
            }
        });
    }
}
run().catch(console.error);
