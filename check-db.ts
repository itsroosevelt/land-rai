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

async function run() {
    try {
        console.log("Checking recent integrations for Instagram...");
        const igSnap = await db.collectionGroup('integrations').where('instagramId', '!=', null).get();
        igSnap.forEach(doc => {
            console.log(`- Entity: ${doc.ref.path}, IG ID: ${doc.data().instagramId}, Page ID: ${doc.data().pageId}`);
        });

        console.log("\nChecking recent cards (omnichannel messages)...");
        const cardsSnap = await db.collectionGroup('cards')
            .orderBy('updatedAt', 'desc').limit(5).get();
        
        cardsSnap.forEach(doc => {
            const d = doc.data();
            console.log(`- Card [${d.platform}]: lastMessage=${d.lastMessage?.substring(0,30)}, updatedAt=${d.updatedAt?.toDate()}`);
        });
        
    } catch (e: any) {
        console.error("DB Check Failed:", e.message);
    }
}
run().then(() => process.exit(0));
