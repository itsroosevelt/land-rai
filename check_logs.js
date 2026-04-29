const { db } = require('./src/lib/firebase-admin');

async function check() {
  const entityPath = 'users/7Yn0I7v8e1U8f7r8e1U8f7r8e1U8/entities/life'; // Guessing entityId from user's mention of "life"
  // Wait, I don't know the userId.
  // Let me search for recent entities in the system.
  const usersSnap = await db.collection('users').limit(5).get();
  for (const userDoc of usersSnap.docs) {
    const entitiesSnap = await db.collection(`users/${userDoc.id}/entities`).get();
    for (const entityDoc of entitiesSnap.docs) {
       const logsSnap = await db.collection(`users/${userDoc.id}/entities/${entityDoc.id}/internal_logs`)
         .orderBy('timestamp', 'desc').limit(10).get();
       if (!logsSnap.empty) {
         console.log(`Logs for ${userDoc.id} / ${entityDoc.id}:`);
         logsSnap.forEach(d => console.log(JSON.stringify(d.data())));
       }
    }
  }
}
check();
