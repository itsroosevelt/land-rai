const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const saPath = path.resolve(__dirname, '../../functions/serviceAccountKey.json');
const sa = require(saPath);
admin.initializeApp({
    credential: admin.credential.cert(sa)
});

const db = admin.firestore();

async function fixContactReferences() {
  const userId = 'g02IGViHitZjPKlOuCG7j5J3uK33';
  const entityId = 'roosevelt';
  const entityPath = `users/${userId}/entities/${entityId}`;

  console.log(`Fixing contact references for ${entityPath}...`);

  // Find the main inbox ID
  const groupsSnap = await db.collection(`${entityPath}/kanban-groups`).get();
  let mainInboxId = '';
  groupsSnap.forEach(doc => {
    const name = (doc.data().name || '').toLowerCase();
    if (name === 'inbox' || name === 'bandeja de entrada') mainInboxId = doc.id;
  });

  if (!mainInboxId) {
    console.error('Main Inbox not found!');
    return;
  }
  console.log('Main Inbox ID:', mainInboxId);

  const contactsSnap = await db.collection(`${entityPath}/contacts`).get();
  for (const contactDoc of contactsSnap.docs) {
    const data = contactDoc.data();
    if (data.kanbanGroupId === 'inbox_telegram') {
      console.log(`Fixing contact ${contactDoc.id}...`);
      await contactDoc.ref.update({
        kanbanGroupId: mainInboxId
      });
    }
  }

  console.log('Done!');
}

fixContactReferences().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
