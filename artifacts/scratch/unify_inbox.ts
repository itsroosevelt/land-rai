import { db, admin } from '../../src/lib/firebase-admin';

async function unifyTelegramInbox() {
  const userId = 'g02IGViHitZjPKlOuCG7j5J3uK33';
  const entityId = 'roosevelt';
  const entityPath = `users/${userId}/entities/${entityId}`;

  console.log(`Unifying Telegram Inbox for ${entityPath}...`);

  const groupsSnap = await db.collection(`${entityPath}/kanban-groups`).get();
  let mainInboxId = '';
  let telegramInboxId = '';

  groupsSnap.forEach(doc => {
    const name = (doc.data().name || '').toLowerCase();
    if (name === 'inbox') mainInboxId = doc.id;
    if (name === 'telegram inbox' || doc.id === 'inbox_telegram') telegramInboxId = doc.id;
  });

  if (!mainInboxId) {
    console.log('Main Inbox not found by name, looking for default_inbox...');
    const defaultInbox = groupsSnap.docs.find(d => d.id === 'default_inbox');
    if (defaultInbox) mainInboxId = 'default_inbox';
  }

  if (!mainInboxId) {
    console.error('Could not find main Inbox group!');
    return;
  }

  if (!telegramInboxId) {
    console.log('Telegram Inbox group not found. Maybe already unified?');
    return;
  }

  console.log(`Main Inbox ID: ${mainInboxId}`);
  console.log(`Telegram Inbox ID: ${telegramInboxId}`);

  if (mainInboxId === telegramInboxId) {
    console.log('IDs are the same. Nothing to do.');
    return;
  }

  // Move cards
  const cardsSnap = await db.collection(`${entityPath}/kanban-groups/${telegramInboxId}/cards`).get();
  console.log(`Moving ${cardsSnap.size} cards...`);

  for (const cardDoc of cardsSnap.docs) {
    const cardData = cardDoc.data();
    await db.collection(`${entityPath}/kanban-groups/${mainInboxId}/cards`).doc(cardDoc.id).set({
      ...cardData,
      groupId: mainInboxId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    await cardDoc.ref.delete();
    console.log(`Moved card ${cardDoc.id}`);
  }

  // Delete the telegram inbox group
  await db.collection(`${entityPath}/kanban-groups`).doc(telegramInboxId).delete();
  console.log(`Deleted group ${telegramInboxId}`);

  console.log('Done!');
}

unifyTelegramInbox().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
