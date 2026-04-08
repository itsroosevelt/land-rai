const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function check() {
    const rootPath = 'users/g02IGViHitZjPKlOuCG7j5J3uK33/entities/roosevelt';
    const snap = await db.collection(`${rootPath}/contacts`).where('origin', '==', 'messenger').get();
    
    snap.forEach(doc => {
       const d = doc.data();
       console.log('Contact FB:', d.name, d.kanbanGroupId, d.kanbanCardId, d.updatedAt);
    });

    const groups = await db.collection(`${rootPath}/kanban-groups`).get();
    for (const g of groups.docs) {
        console.log(`Group: ${g.id} - ${g.data().name}`);
        const cards = await g.ref.collection('cards').where('source', '==', 'messenger').get();
        cards.forEach(c => console.log('  -> Card:', c.id, c.data().lastMessage));
    }
}
check().catch(console.error);
