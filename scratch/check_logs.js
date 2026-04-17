
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // I'll assume it exists or use default

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault()
    });
}

const db = admin.firestore();

async function checkLogs() {
    console.log('Searching for recent Meta Webhook logs...');
    // We don't know the entityPath, so we'll use collectionGroup if possible, or search for users
    try {
        const snap = await db.collectionGroup('system_logs')
            .orderBy('timestamp', 'desc')
            .limit(10)
            .get();
        
        if (snap.empty) {
            console.log('No logs found in any system_logs collectionGroup.');
            return;
        }

        snap.forEach(doc => {
            console.log(`--- Log ${doc.id} [${doc.ref.path}] ---`);
            console.log(JSON.stringify(doc.data(), null, 2));
        });
    } catch (err) {
        console.error('Error fetching logs:', err.message);
        console.log('Trying alternative search for entities...');
        const usersSnap = await db.collection('users').limit(1).get();
        if (!usersSnap.empty) {
            const userId = usersSnap.docs[0].id;
            const entitiesSnap = await db.collection(`users/${userId}/entities`).limit(1).get();
            if (!entitiesSnap.empty) {
                const entityId = entitiesSnap.docs[0].id;
                console.log(`Checking logs for User: ${userId}, Entity: ${entityId}`);
                const logsSnap = await db.collection(`users/${userId}/entities/${entityId}/system_logs`)
                    .orderBy('timestamp', 'desc')
                    .limit(5)
                    .get();
                logsSnap.forEach(doc => {
                    console.log(`--- Log ${doc.id} ---`);
                    console.log(JSON.stringify(doc.data(), null, 2));
                });
            }
        }
    }
}

checkLogs();
