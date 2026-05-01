const admin = require('firebase-admin');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!serviceAccountEnv) {
    console.error('FIREBASE_SERVICE_ACCOUNT not found in .env');
    process.exit(1);
}

const serviceAccount = JSON.parse(serviceAccountEnv);

// Fix private key newlines if necessary (though the earlier view showed \n which is good)
if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
});

const db = admin.firestore();

async function checkUdreamsBot() {
    const userId = 'PfwSF6yPmee21HGeuLsi4jmERI3';
    const entityId = 'bs_hlzzpfn';
    const platform = 'whatsapp';

    console.log(`Checking bots for entity: ${entityId}...`);
    const botsRef = db.collection(`users/${userId}/entities/${entityId}/chatbots`);
    const botsSnapshot = await botsRef.get();
    
    console.log(`Total bots found: ${botsSnapshot.size}`);
    botsSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`- Bot: "${data.name}", ID: ${doc.id}, isActive: ${data.isActive}, targetPlatforms: ${JSON.stringify(data.targetPlatforms)}`);
    });

    const kanbanGroupId = '0VuSjzFLMq mZFQfjH owT';
    const cardId = 'ZAV7iB06jBt6c1bRVyyZ';
    const cardRef = db.doc(`users/${userId}/entities/${entityId}/kanban-groups/${kanbanGroupId}/cards/${cardId}`);
    const cardSnap = await cardRef.get();
    
    if (cardSnap.exists) {
        const cardData = cardSnap.data();
        console.log(`\nCard Data for ${cardId}:`);
        console.log(`- contactName: ${cardData.contactName}`);
        console.log(`- botLock: ${JSON.stringify(cardData.botLock)}`);
        console.log(`- botState: ${JSON.stringify(cardData.botState)}`);
        console.log(`- platform_ids: ${JSON.stringify(cardData.platform_ids)}`);
    } else {
        console.log(`\nCard ${cardId} NOT found at path: ${cardRef.path}`);
        
        // Try searching by platform_id
        const searchSnap = await db.collectionGroup('cards')
            .where('platform_ids.whatsapp', '==', '573117578716') // I'll check common numbers or search broadly
            .get();
        console.log(`\nBroad search results for WhatsApp cards: ${searchSnap.size}`);
    }
}

checkUdreamsBot().catch(console.error);
