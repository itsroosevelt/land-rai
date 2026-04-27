import { db } from '../../src/lib/firebase-admin';

async function diagnose() {
    const userId = 'g02IGViHitZjPKlOuCG7j5J3uK33';
    console.log(`Diagnosing User: ${userId}`);
    
    const entitiesSnap = await db.collection(`users/${userId}/entities`).get();
    console.log(`Found ${entitiesSnap.size} entities:`);
    entitiesSnap.forEach(doc => {
        console.log(`- ID: ${doc.id} | Name: ${doc.data().name}`);
    });

    const entityId = 'roosevelt';
    const path = `users/${userId}/entities/${entityId}`;
    console.log(`Checking path: ${path}`);
    
    const integrationsSnap = await db.collection(`${path}/integrations`).get();
    console.log(`Integrations at this path: ${integrationsSnap.size}`);
    integrationsSnap.forEach(doc => {
        console.log(`  - ${doc.id}: status=${doc.data().status}`);
    });

    const groupsSnap = await db.collection(`${path}/kanban-groups`).get();
    console.log(`Kanban Groups at this path: ${groupsSnap.size}`);
    groupsSnap.forEach(doc => {
        console.log(`  - ${doc.id}: ${doc.data().name}`);
    });

    console.log('\n--- 🔍 RECENT TELEGRAM SYSTEM LOGS ---');
    const logsSnap = await db.collection('system_logs')
        .where('type', '==', 'telegram_webhook_raw')
        .orderBy('timestamp', 'desc')
        .limit(5)
        .get();

    if (logsSnap.empty) {
        console.log('❌ NO WEBHOOK LOGS FOUND. Telegram is NOT hitting Roosevelt.');
    } else {
        logsSnap.forEach(doc => {
            const data = doc.data();
            console.log(`- [${data.timestamp?.toDate().toLocaleString()}] Body: ${JSON.stringify(data.body).substring(0, 100)}...`);
        });
    }
}

diagnose().catch(console.error);
