
const admin = require('firebase-admin');
const dotenv = require('dotenv');
dotenv.config();

let serviceAccount;
try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} catch (e) {
    console.error('Error parsing FIREBASE_SERVICE_ACCOUNT:', e.message);
}

if (!admin.apps.length && serviceAccount) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
    });
} else if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'roosevelt-491004'
    });
}

const db = admin.firestore();

async function deleteCollection(collectionPath) {
    const collectionRef = db.collection(collectionPath);
    const query = collectionRef.limit(50);

    return new Promise((resolve, reject) => {
        deleteQueryBatch(db, query, resolve).catch(reject);
    });
}

async function deleteQueryBatch(db, query, resolve) {
    const snapshot = await query.get();

    const batchSize = snapshot.size;
    if (batchSize === 0) {
        resolve();
        return;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });
    await batch.commit();

    process.nextTick(() => {
        deleteQueryBatch(db, query, resolve);
    });
}

async function cleanupForbiddenRoots() {
    console.log('--- 🧹 LIMPIEZA DE RAÍCES PROHIBIDAS (REGLA 7) ---');
    
    console.log('Borrando integrations/instagram/accounts...');
    await deleteCollection('integrations/instagram/accounts');
    
    console.log('Borrando integrations/messenger/pages...');
    await deleteCollection('integrations/messenger/pages');

    console.log('--- ✅ LIMPIEZA COMPLETADA ---');
}

cleanupForbiddenRoots().catch(console.error);
