import * as admin from 'firebase-admin';
import path from 'path';

require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}')),
        databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
    });
}
const db = admin.firestore();

import { sendMetaMessage } from './src/lib/sendProviders';

async function run() {
    // We just need a dummy recipient and the ACTUAL entity config to see if it throws an error.
    try {
        const snap = await db.collectionGroup('integrations').where('pageId', '!=', null).limit(1).get();
        if (snap.empty) {
            console.log("No messenger integrations found in DB.");
            return;
        }
        const doc = snap.docs[0];
        const entityPath = doc.ref.path.split('/integrations')[0];
        const [_, users, userId, entities, entityId] = entityPath.split('/');
        
        console.log(`Testing Meta Send for Entity: ${entityId}, User: ${userId}`);
        
        // 123456789 is a fake recipient. Meta API will throw an error like "No matching user found", 
        // BUT it will tell us if authentication or URL endpoint is correct.
        await sendMetaMessage("123456789", "Hola prueba desde server", {
            userId: userId,
            entityId: entityId,
            provider: 'messenger'
        });
        console.log("SEND SUCCESS");
    } catch (e: any) {
        console.error("SEND FAILED:", e.message);
    }
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
