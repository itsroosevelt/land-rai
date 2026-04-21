const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

function loadEnvLocal() {
    const envPath = path.join(process.cwd(), '.env.local');
    const content = fs.readFileSync(envPath, 'utf8');
    const env = {};
    const lines = content.split('\n');
    let inMultiline = false;
    let currentKey = null;
    let currentValue = '';

    for (let line of lines) {
        if (!inMultiline) {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                let value = match[2].trim();
                if (value.startsWith("'") && !value.endsWith("'")) {
                    inMultiline = true;
                    currentKey = key;
                    currentValue = value.slice(1) + '\n';
                } else if (value.startsWith("'") && value.endsWith("'")) {
                    env[key] = value.slice(1, -1);
                } else {
                    env[key] = value;
                }
            }
        } else {
            if (line.trim().endsWith("'")) {
                currentValue += line.trim().slice(0, -1);
                env[currentKey] = currentValue;
                inMultiline = false;
            } else {
                currentValue += line + '\n';
            }
        }
    }
    return env;
}

const env = loadEnvLocal();
const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function findLastGmailLog() {
    const entityPath = 'users/g02IGViHitZjPKlOuCG7j5J3uK33/entities/roosevelt';
    console.log(`Searching for any Gmail logs in ${entityPath}...`);
    
    // We can't use orderBy without index for multiple fields, 
    // but we can query by type and then sort locally.
    const logsSnap = await db.collection(`${entityPath}/system_logs`)
        .where('type', '>=', 'gmail')
        .where('type', '<=', 'gmail\uf8ff')
        .get();
    
    console.log(`Found ${logsSnap.size} Gmail logs total.`);
    if (logsSnap.size > 0) {
        const sorted = logsSnap.docs.map(d => d.data()).sort((a, b) => b.timestamp?.toMillis() - a.timestamp?.toMillis());
        console.log(`Last Gmail Log: [${sorted[0].timestamp?.toDate().toISOString()}] ${sorted[0].type}`);
    }

    const logsSnapIngested = await db.collection(`${entityPath}/system_logs`)
        .where('type', '==', 'webhook_ingested_gmail')
        .get();

    console.log(`Found ${logsSnapIngested.size} ingested Gmail logs total.`);
    if (logsSnapIngested.size > 0) {
        const sorted = logsSnapIngested.docs.map(d => d.data()).sort((a, b) => b.timestamp?.toMillis() - a.timestamp?.toMillis());
        console.log(`Last Ingested Gmail Log: [${sorted[0].timestamp?.toDate().toISOString()}] ${sorted[0].type}`);
    }
}

findLastGmailLog().catch(console.error);
