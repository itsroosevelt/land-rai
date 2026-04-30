const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const saPath = path.resolve(__dirname, '../../functions/serviceAccountKey.json');
const sa = require(saPath);
admin.initializeApp({
    credential: admin.credential.cert(sa)
});

const db = admin.firestore();

async function finalCleanup() {
  const userId = 'g02IGViHitZjPKlOuCG7j5J3uK33';
  const entityId = 'roosevelt';
  const entityPath = `users/${userId}/entities/${entityId}`;

  console.log('Performing final Telegram cleanup...');

  // 1. Delete all Telegram contacts
  const contactsSnap = await db.collection(`${entityPath}/contacts`).get();
  for (const doc of contactsSnap.docs) {
    if (doc.id.startsWith('tg_') || doc.data().telegramChatId || doc.data().source === 'TELEGRAM') {
      console.log(`Deleting contact ${doc.id}`);
      await doc.ref.delete();
    }
  }

  // 2. Delete all Telegram cards in all groups
  const groupsSnap = await db.collection(`${entityPath}/kanban-groups`).get();
  for (const groupDoc of groupsSnap.docs) {
    const cardsSnap = await groupDoc.ref.collection('cards').get();
    for (const cardDoc of cardsSnap.docs) {
      if (cardDoc.id.startsWith('tg_') || cardDoc.data().telegramChatId || cardDoc.data().source === 'TELEGRAM') {
        console.log(`Deleting card ${cardDoc.id} from group ${groupDoc.id}`);
        await cardDoc.ref.delete();
      }
    }
  }

  // 3. Delete Telegram chat histories
  const chatsSnap = await db.collection(`${entityPath}/chats`).get();
  for (const doc of chatsSnap.docs) {
    // If ID is numeric (Telegram chat IDs are numeric) or starts with tg_
    if (doc.id.startsWith('tg_') || /^\d+$/.test(doc.id)) {
      console.log(`Deleting chat history ${doc.id}`);
      await doc.ref.delete();
    }
  }

  console.log('Cleanup complete! Everything is fresh.');
}

finalCleanup().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
