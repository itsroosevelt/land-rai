const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Helper to parse .env.local
function loadEnvLocal() {
    const envPath = path.join(process.cwd(), '.env.local');
    if (!fs.existsSync(envPath)) return {};
    const content = fs.readFileSync(envPath, 'utf8');
    const lines = content.split('\n');
    const env = {};
    let currentKey = null;
    let currentValue = '';
    let inMultiline = false;

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
const serviceAccountRaw = env.FIREBASE_SERVICE_ACCOUNT;

if (!serviceAccountRaw) {
    console.error('FIREBASE_SERVICE_ACCOUNT not found in .env.local');
    process.exit(1);
}

const serviceAccount = JSON.parse(serviceAccountRaw);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function audit() {
    console.log('--- AUDIT START ---');
    
    // 1. Check all integrations
    const integrationsSnap = await db.collectionGroup('integrations').get();
    console.log(`Found ${integrationsSnap.size} integrations total.`);
    
    for (const doc of integrationsSnap.docs) {
        const data = doc.data();
        const path = doc.ref.path;
        console.log(`\nIntegration: ${path}`);
        console.log(`- Platform: ${data.provider || 'unknown'}`);
        console.log(`- IsActive: ${data.isActive}`);
        console.log(`- InstagramId: ${data.instagramId || 'N/A'}`);
        console.log(`- PageId: ${data.pageId || 'N/A'}`);
        console.log(`- GmailAddress: ${data.gmailAddress || 'N/A'}`);
        console.log(`- Has Token: ${!!(data.accessToken || data.token)}`);
    }

    // 2. Check recent system logs
    console.log('\n--- RECENT SYSTEM LOGS ---');
    const logsSnap = await db.collectionGroup('system_logs')
        .orderBy('timestamp', 'desc')
        .limit(10)
        .get();
    
    for (const doc of logsSnap.docs) {
        const data = doc.data();
        console.log(`[${data.timestamp?.toDate().toISOString() || 'N/A'}] ${data.type} | Sender: ${data.senderId || 'N/A'}`);
    }

    console.log('\n--- AUDIT END ---');
}

audit().catch(err => {
    console.error('Audit failed:', err);
});
