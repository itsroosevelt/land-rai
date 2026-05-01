const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(sa)
    });
}

const db = admin.firestore();

async function checkLogs() {
    const userId = 'g02IGViHitZjPKlOuCG7j5J3uK33';
    const entityId = 'roosevelt';

    try {
        console.log(`\n2️⃣ Buscando en system_logs del entity...`);
        const sysLogsSnap = await db.collection(`users/${userId}/entities/${entityId}/system_logs`)
            .orderBy('timestamp', 'desc')
            .limit(5)
            .get();

        sysLogsSnap.forEach(doc => {
            const d = doc.data();
            const date = d.timestamp?.toDate ? d.timestamp.toDate().toISOString() : d.timestamp;
            // The webhook writes 'type' and 'raw', or 'action' and 'details'
            console.log(`[${date}] ${d.type || d.action}: ${typeof d.raw === 'string' ? d.raw.substring(0, 100) : (d.details || d.raw)}`);
        });
        
    } catch (err) {
        console.error(`Error:`, err.message);
    }
    process.exit();
}

checkLogs();
