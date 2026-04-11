const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
    const users = await db.collection('users').get();
    for (const u of users.docs) {
        const ents = await u.ref.collection('entities').get();
        for (const e of ents.docs) {
            const kgs = await e.ref.collection('kanban-groups').get();
            for (const kg of kgs.docs) {
                const cards = await kg.ref.collection('cards').get();
                cards.forEach(card => {
                    const d = card.data();
                    if (d.source === 'MESSENGER' || d.source === 'messenger' || (d.platform_ids && d.platform_ids.messenger)) {
                         if (d.botState?.lastError) {
                            console.log(`\nCard ID: ${card.id} (${d.contactName})`);
                            console.log(`LastError: ${d.botState.lastError}`);
                            console.log(`LastErrorAt: ${d.botState.lastErrorAt?.toDate()}`);
                         }
                    }
                });
            }
        }
    }
}
run().catch(console.error);
