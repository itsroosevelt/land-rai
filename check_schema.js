const { db } = require('./src/lib/firebase-admin');

async function check() {
  try {
    const usersSnap = await db.collection('users').get();
    for (const userDoc of usersSnap.docs) {
      const entitiesSnap = await db.collection(`users/${userDoc.id}/entities`).get();
      for (const entityDoc of entitiesSnap.docs) {
        console.log(`Checking Entity: ${userDoc.id} / ${entityDoc.id}`);
        
        const chatbotsSnap = await db.collection(`users/${userDoc.id}/entities/${entityDoc.id}/chatbots`).get();
        console.log(`  - /chatbots count: ${chatbotsSnap.size}`);
        chatbotsSnap.forEach(d => console.log(`    * Bot: ${d.id} | Name: ${d.data().name} | Active: ${d.data().isActive}`));

        const integrationBotsSnap = await db.collection(`users/${userDoc.id}/entities/${entityDoc.id}/integrations/chatbot/bots`).get();
        console.log(`  - /integrations/chatbot/bots count: ${integrationBotsSnap.size}`);
        integrationBotsSnap.forEach(d => console.log(`    * Bot: ${d.id} | Name: ${d.data().name} | Status: ${d.data().status}`));
      }
    }
  } catch (err) {
    console.error(err);
  }
}
check();
