const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const saPath = path.resolve(__dirname, '../../functions/serviceAccountKey.json');
const sa = require(saPath);
admin.initializeApp({
    credential: admin.credential.cert(sa)
});

const db = admin.firestore();

async function restoreLizCard() {
  const userId = 'g02IGViHitZjPKlOuCG7j5J3uK33';
  const entityId = 'roosevelt';
  const entityPath = `users/${userId}/entities/${entityId}`;
  const mainInboxId = 'pmEXQBM3nCrR4KRLpjlc';

  console.log('Restoring liz card...');

  const contactId = 'tg_7421651198';
  const contactSnap = await db.doc(`${entityPath}/contacts/${contactId}`).get();
  
  if (!contactSnap.exists) {
    console.error('Contact not found!');
    return;
  }

  const contactData = contactSnap.data();
  
  // Create card
  await db.collection(`${entityPath}/kanban-groups/${mainInboxId}/cards`).doc(contactId).set({
    contactId: contactId,
    contactName: contactData.name || 'liz Telegram',
    telegramChatId: '7421651198',
    lastMessage: 'Recuperando conversación...',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: contactData.createdAt || admin.firestore.FieldValue.serverTimestamp(),
    messages: [],
    botState: {
        messageQueue: [],
        status: 'active',
        waitingForInput: false
    },
    unreadCount: 0,
    status: 'open',
    source: 'TELEGRAM',
    channel: 'telegram',
    platform_ids: { telegram: '7421651198' },
    groupId: mainInboxId
  });

  console.log('Card restored!');
}

restoreLizCard().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
