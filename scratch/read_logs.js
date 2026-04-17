const admin = require('firebase-admin');

// No need to initialize if running in environment where it's already configured
// but for a scratch script, we might need a minimal init or use the existing lib
// Since I can't easily require the lib, I'll try to use the environment variables

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    });
}

const db = admin.firestore();

async function getRecentErrors() {
    console.log("--- RECENT ERRORS IN SYSTEM LOGS ---");
    // Use collectionGroup to find system_logs across all entities
    const snap = await db.collectionGroup('system_logs')
        .orderBy('timestamp', 'desc')
        .limit(10)
        .get();

    if (snap.empty) {
        console.log("No logs found.");
        return;
    }

    snap.docs.forEach(doc => {
        const data = doc.data();
        console.log(`Path: ${doc.ref.path}`);
        console.log(`Type: ${data.type}`);
        console.log(`Error: ${JSON.stringify(data.error || data.lastError || data.errorMessage || 'N/A')}`);
        console.log(`Time: ${data.timestamp?.toDate().toISOString()}`);
        console.log("---------------------------------");
    });
}

getRecentErrors().catch(console.error);
