const { admin, db } = require('./src/lib/firebase-admin');

async function checkIntegrations() {
    console.log("--- INTEGRATION STATUS CHECK ---");
    const snap = await db.collectionGroup('integrations').get();
    if (snap.empty) {
        console.log("No integrations found.");
        return;
    }

    snap.docs.forEach(doc => {
        const data = doc.data();
        console.log(`Path: ${doc.ref.path}`);
        console.log(`  Provider: ${data.provider || 'unknown'}`);
        console.log(`  Status: ${data.status}`);
        console.log(`  PageName: ${data.pageName || data.instagramName || 'N/A'}`);
        if (data.lastError) console.log(`  LastError: ${data.lastError}`);
        console.log("---------------------------------");
    });
}

checkIntegrations().catch(console.error);
