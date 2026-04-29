const { db } = require('./src/lib/firebase-admin');

async function diag() {
  // Use a more direct approach: listen to recent updates or just search deeper
  const usersSnap = await db.collection('users').get();
  for (const userDoc of usersSnap.docs) {
    const entitiesSnap = await db.collection(`users/${userDoc.id}/entities`).get();
    for (const entityDoc of entitiesSnap.docs) {
      const groupsSnap = await db.collection(`users/${userDoc.id}/entities/${entityDoc.id}/kanban-groups`).get();
      for (const groupDoc of groupsSnap.docs) {
        const cardsSnap = await groupDoc.ref.collection('cards').where('channel', '==', 'telegram').get();
        cardsSnap.forEach(c => {
          console.log(`USER: ${userDoc.id} | ENTITY: ${entityDoc.id} | CARD: ${c.id}`);
          console.log(`  botState: ${JSON.stringify(c.data().botState)}`);
          console.log(`  variables: ${JSON.stringify(c.data().variables)}`);
        });
      }
    }
  }
}
diag();
