
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const env = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
const lines = env.split('\n');
const saLine = lines.find(l => l.startsWith('FIREBASE_SERVICE_ACCOUNT='));
const saJson = saLine.split('FIREBASE_SERVICE_ACCOUNT=')[1].trim().replace(/^['"]|['"]$/g, '').replace(/\\\\n/g, '\\n');
const serviceAccount = JSON.parse(saJson);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkBots() {
    const userId = 'PfwSF6yPmee21HGeuLsi4jmERI3';
    const entityId = 'bs_hlzzpfn';
    
    console.log(`Checking bots for ${entityId}...`);
    
    const botsSnap = await db.collection(`users/${userId}/entities/${entityId}/chatbots`).get();
        
    if (botsSnap.empty) {
        console.log('No bots found for this entity.');
        return;
    }
    
    botsSnap.forEach(doc => {
        const d = doc.data();
        console.log(`Bot: ${d.name} (${doc.id})`);
        console.log(`  isActive: ${d.isActive}`);
        console.log(`  platforms: ${JSON.stringify(d.targetPlatforms || [])}`);
        console.log(`  hasFlow: ${!!(d.flow && d.flow.nodes)}`);
    });
}

checkBots().catch(console.error);
