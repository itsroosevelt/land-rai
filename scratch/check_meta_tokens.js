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

async function checkMetaTokens() {
    const entityPath = 'users/g02IGViHitZjPKlOuCG7j5J3uK33/entities/roosevelt';
    
    const platforms = ['messenger', 'instagram'];
    
    for (const p of platforms) {
        console.log(`\n--- ${p.toUpperCase()} ---`);
        const doc = await db.doc(`${entityPath}/integrations/${p}`).get();
        if (doc.exists) {
            const data = doc.data();
            console.log(`Status: ${data.status || 'N/A'}`);
            console.log(`Last Error: ${data.lastError || 'None'}`);
            console.log(`Token Prefix: ${ (data.accessToken || data.pageAccessToken || data.token)?.substring(0, 10) }...`);
            console.log(`Updated At: ${data.updatedAt?.toDate().toISOString() || 'N/A'}`);
        } else {
            console.log(`Integration document not found.`);
        }
    }
}

checkMetaTokens().catch(console.error);
