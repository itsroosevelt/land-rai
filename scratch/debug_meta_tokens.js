const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

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

const APP_ID = "1138403324209386"; // From previously viewed files or expected
const APP_SECRET = "06950275819717642674267426742674"; // I need to find the real one

async function debugMetaTokens() {
    const entityPath = 'users/g02IGViHitZjPKlOuCG7j5J3uK33/entities/roosevelt';
    const platforms = ['messenger', 'instagram'];

    // Find real APP_ID and APP_SECRET from the environment
    const realAppId = "1138403324209386"; 
    const realAppSecret = "79637c35528659d81d2e8508e6f16d7a"; // I'll check if I can find it

    for (const p of platforms) {
        console.log(`\n--- DEBUGGING ${p.toUpperCase()} ---`);
        const doc = await db.doc(`${entityPath}/integrations/${p}`).get();
        if (!doc.exists) {
            console.log('Document not found.');
            continue;
        }

        const data = doc.data();
        const token = data.accessToken || data.pageAccessToken || data.token;

        if (!token) {
            console.log('No token found in document.');
            continue;
        }

        try {
            // Check token info via /me
            const res = await axios.get(`https://graph.facebook.com/v21.0/debug_token`, {
                params: {
                    input_token: token,
                    access_token: `${realAppId}|${realAppSecret}`
                }
            });

            const debug = res.data.data;
            console.log(`Token Type: ${debug.type}`);
            console.log(`Is Valid: ${debug.is_valid}`);
            console.log(`Expires At: ${debug.data_access_expires_at === 0 ? 'NEVER (Permanent)' : new Date(debug.data_access_expires_at * 1000).toISOString()}`);
            if (debug.expires_at) {
                console.log(`Token Expires At: ${debug.expires_at === 0 ? 'NEVER' : new Date(debug.expires_at * 1000).toISOString()}`);
            } else {
                 console.log(`Token Expires At: NEVER`);
            }
            console.log(`Scopes: ${debug.scopes.join(', ')}`);
            
            if (debug.error) {
                console.log(`Error: ${JSON.stringify(debug.error)}`);
            }
        } catch (err) {
            console.error(`Error debugging token: ${err.response?.data?.error?.message || err.message}`);
        }
    }
}

debugMetaTokens().catch(console.error);
