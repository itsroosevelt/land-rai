const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    });
}

const db = admin.firestore();

async function checkIntegrations() {
    console.log("--- DETAILED INTEGRATION CHECK ---");
    const snap = await db.collectionGroup('integrations').get();
    
    if (snap.empty) {
        console.log("No integrations found.");
        return;
    }

    const now = Date.now();
    snap.docs.forEach(doc => {
        const data = doc.data();
        const updatedAt = data.updatedAt?.toDate()?.getTime() || 0;
        
        // Only show integrations updated in the last hour to focus on active work
        if (now - updatedAt < 3600000) {
            console.log(`Path: ${doc.ref.path}`);
            console.log(`  Provider: ${data.provider}`);
            console.log(`  Status: ${data.status}`);
            console.log(`  Token Length: ${data.accessToken?.length || data.token?.length || 0}`);
            console.log(`  Has PageId: ${!!data.pageId}`);
            console.log(`  PageId: ${data.pageId}`);
            console.log(`  Last Error: ${data.lastError || 'None'}`);
            console.log("---------------------------------");
        }
    });
}

checkIntegrations().catch(console.error);
