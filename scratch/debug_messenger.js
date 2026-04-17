
const admin = require('firebase-admin');
const dotenv = require('dotenv');
const fs = require('fs');

// Load .env.local
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
for (const k in envConfig) {
  process.env[k] = envConfig[k];
}

// Extract service account if present in env or look for a file
let serviceAccount;
try {
    // Check if there is a JSON in the env (next-firebase-auth usually does this)
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
} catch (e) {}

if (!serviceAccount || Object.keys(serviceAccount).length === 0) {
    // Try to find any .json file in root
    const rootFiles = fs.readdirSync('.');
    const jsonFile = rootFiles.find(f => f.endsWith('.json') && f !== 'package.json' && f !== 'tsconfig.json');
    if (jsonFile) {
        console.log(`Found JSON file: ${jsonFile}`);
        serviceAccount = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
    }
}

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    });
}

const db = admin.firestore();

async function debugMessenger() {
    console.log('--- ROOSEVELT MULTI-TENANT DEBUGGER ---');
    try {
        const entityId = 'roosevelt'; // From URL localhost:3000/nucleo/roosevelt
        console.log(`Checking integrations for entity: ${entityId}`);
        
        const integrationsSnap = await db.collectionGroup('integrations')
            .where('status', 'in', ['Connected', 'Disconnected'])
            .get();
        
        console.log(`Found ${integrationsSnap.size} total integrations in system.`);
        
        integrationsSnap.forEach(doc => {
            const data = doc.data();
            const path = doc.ref.path;
            if (path.includes(entityId) || data.pageId || data.instagramId) {
                console.log(`\n[Integration] ${path}`);
                console.log(`  - Provider ID: ${doc.id}`);
                console.log(`  - Status: ${data.status}`);
                console.log(`  - PageId: ${data.pageId}`);
                console.log(`  - InstagramId: ${data.instagramId}`);
                console.log(`  - IsActive: ${data.isActive}`);
            }
        });

        // Check recent cards for this entity
        console.log(`\nChecking recent cards in 'roosevelt' collections...`);
        const cardsSnap = await db.collectionGroup('cards')
            .orderBy('updatedAt', 'desc')
            .limit(3)
            .get();
            
        cardsSnap.forEach(doc => {
            const data = doc.data();
            if (doc.ref.path.includes(entityId)) {
                console.log(`\n[Card] ${doc.ref.path}`);
                console.log(`  - contactName: ${data.contactName}`);
                console.log(`  - lastMessage: ${data.lastMessage}`);
                console.log(`  - updatedAt: ${data.updatedAt?.toDate().toISOString()}`);
            }
        });
    } catch (err) {
        console.error('Debug failed:', err.message);
    }
}

debugMessenger();
