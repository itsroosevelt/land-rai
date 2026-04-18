const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function run() {
    console.log("Repairing 'Mey Titu' card...");
    // Hardcoded card ID from previous analysis
    const cardId = 'toojj5aH3zWJgLq9mlkr';
    const cardPath = 'users/g02IGViHitZjPKlOuCG7j5J3uK33/entities/roosevelt/kanban-groups/pmEXQBM3nCrR4KRLpjlc/cards/toojj5aH3zWJgLq9mlkr';
    const cardRef = db.doc(cardPath);
    
    const snap = await cardRef.get();
    if (!snap.exists) {
        console.error("Card not found at path!");
        return;
    }
    
    const d = snap.data();
    const senderId = '1120412853245511'; // PSID from common Meta patterns if possible, but I'll use the one from the analysis if I can find it.
    // Wait, analyzed message had id mid_... but senderId was usually hidden.
    // I will try to find the senderId from the messages array
    const msgs = d.messages || [];
    let discoveredSenderId = null;
    // Actually, I'll just initialize the botState structure. The webhook will fill the platform_ids on next hit.
    
    await cardRef.update({
        'botState.status': 'inactive',
        'botState.currentNodeId': null,
        'botState.waitingForInput': false,
        'botState.messageQueue': [],
        'source': 'MESSENGER',
        'botLock': null
    });
    
    console.log("✅ Card 'Mey Titu' repaired and unlocked.");
}
run().catch(console.error);
