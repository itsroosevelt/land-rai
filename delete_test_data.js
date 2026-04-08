const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function clean() {
    const rootPath = 'users/g02IGViHitZjPKlOuCG7j5J3uK33/entities/roosevelt';
    const testSenders = ['TEST_USER_ANTIGRAVITY', 'TEST_FINAL_STABILIZATION', 'TEST_BASE64'];
    
    // Clean Contacts
    for (const sender of testSenders) {
        const snaps = await db.collection(`${rootPath}/contacts`).where('metaSenderId', '==', sender).get();
        for (const doc of snaps.docs) {
             console.log(`Deleting Contact: ${doc.id}`);
             await doc.ref.delete();
        }
    }

    // Clean Kanban Cards
    const groups = await db.collection(`${rootPath}/kanban-groups`).get();
    for (const g of groups.docs) {
        const cards = await g.ref.collection('cards').get();
        for (const c of cards.docs) {
             const data = c.data();
             if (testSenders.includes(data.metaSenderId) || data.lastMessage?.includes('PRUEBA DESDE EL SISTEMA') || data.lastMessage?.includes('BASE64') || data.lastMessage?.includes('FINAL STABILIZATION')) {
                  console.log(`Deleting Card: ${c.id}`);
                  await c.ref.delete();
             }
        }
    }
    console.log('Test messages deleted successfully.');
}
clean().catch(console.error);
