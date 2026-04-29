const { db } = require('./src/lib/firebase-admin');

async function diag() {
  const usersSnap = await db.collection('users').get();
  for (const userDoc of usersSnap.docs) {
    const entityId = 'life';
    const entityPath = `users/${userDoc.id}/entities/${entityId}`;
    const groupsSnap = await db.collection(`${entityPath}/kanban-groups`).get();
    if (groupsSnap.empty) continue;

    console.log(`Checking Entity: ${entityPath}`);
    for (const groupDoc of groupsSnap.docs) {
      const cardsSnap = await groupDoc.ref.collection('cards').get();
      cardsSnap.forEach(c => {
        const data = c.data();
        if (data.channel === 'telegram' || data.source === 'TELEGRAM') {
            console.log(`Card: ${c.id} | Group: ${groupDoc.id}`);
            console.log(`  botState: ${JSON.stringify(data.botState)}`);
            console.log(`  variables: ${JSON.stringify(data.variables)}`);
            console.log(`  lastMessage: ${data.lastMessage}`);
        }
      });
    }
  }
}
diag();
