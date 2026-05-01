
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Basic .env parser
const env = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
const lines = env.split('\n');
const saLine = lines.find(l => l.startsWith('FIREBASE_SERVICE_ACCOUNT='));
if (!saLine) {
    console.error('FIREBASE_SERVICE_ACCOUNT not found in .env');
    process.exit(1);
}

let saJson = saLine.split('FIREBASE_SERVICE_ACCOUNT=')[1].trim();
if (saJson.startsWith("'") && saJson.endsWith("'")) saJson = saJson.slice(1, -1);

// Handle the double backslashes which are common in .env files for private keys
const serviceAccount = JSON.parse(saJson.replace(/\\\\n/g, '\\n'));

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkLogs() {
    const userId = 'PfwSF6yPmee21HGeuLsi4jmERI3';
    const entityId = 'bs_hlzzpfn';
    
    console.log(`Checking logs for ${entityId}...`);
    
    const logsSnap = await db.collection(`users/${userId}/entities/${entityId}/system_logs`)
        .orderBy('timestamp', 'desc')
        .limit(20)
        .get();
        
    if (logsSnap.empty) {
        console.log('No logs found.');
        return;
    }
    
    logsSnap.forEach(doc => {
        const d = doc.data();
        const time = d.timestamp?.toDate ? d.timestamp.toDate().toISOString() : 'N/A';
        console.log(`[${time}] ${d.type}: ${d.step || ''} - ${d.status || ''}`);
        if (d.details) console.log(`  Details: ${d.details}`);
        if (d.error) console.log(`  Error: ${JSON.stringify(d.error)}`);
        if (d.platform) console.log(`  Platform: ${d.platform}`);
    });
}

checkLogs().catch(console.error);
