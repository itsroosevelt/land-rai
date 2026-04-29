
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'roosevelt-platform'
    });
}

const db = admin.firestore();

async function diagnoseInstagram() {
    console.log('--- 🔍 DIAGNÓSTICO DE INTEGRACIONES INSTAGRAM ---');
    
    // 1. Buscar en Colecciones Globales (Prohibido pero puede existir)
    console.log('\n1. Buscando en raíz (Prohibido):');
    const rootSnap = await db.collection('integrations').doc('instagram').collection('accounts').get();
    rootSnap.forEach(doc => {
        console.log(`[ROOT] ID: ${doc.id} | Data:`, doc.data());
    });

    // 2. Buscar vía Collection Group (Lo que usa el Webhook)
    console.log('\n2. Buscando vía Collection Group "integrations":');
    const groupSnap = await db.collectionGroup('integrations').get();
    groupSnap.forEach(doc => {
        const data = doc.data();
        if (data.instagramId || data.pageId) {
            console.log(`[GROUP] Path: ${doc.ref.path} | IG_ID: ${data.instagramId} | PageID: ${data.pageId}`);
        }
    });

    console.log('\n--- FIN DEL DIAGNÓSTICO ---');
}

diagnoseInstagram().catch(console.error);
