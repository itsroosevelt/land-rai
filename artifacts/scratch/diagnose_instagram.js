
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

async function diagnoseInstagram() {
    console.log('--- 🔍 DIAGNÓSTICO DE INTEGRACIONES INSTAGRAM ---');
    
    // 1. Buscar en Colecciones Globales (Prohibido pero puede existir)
    console.log('\n1. Buscando en raíz (Prohibido):');
    try {
        const rootSnap = await db.collection('integrations').doc('instagram').collection('accounts').get();
        if (rootSnap.empty) {
            console.log('No hay cuentas en la colección raíz.');
        } else {
            rootSnap.forEach(doc => {
                console.log(`[ROOT] ID: ${doc.id} | Data:`, doc.data());
            });
        }
    } catch (e) {
        console.log('Error al buscar en raíz:', e.message);
    }

    // 2. Buscar vía Collection Group (Lo que usa el Webhook)
    console.log('\n2. Buscando vía Collection Group "integrations":');
    try {
        const groupSnap = await db.collectionGroup('integrations').get();
        if (groupSnap.empty) {
            console.log('No se encontraron colecciones "integrations" vía collectionGroup.');
        } else {
            groupSnap.forEach(doc => {
                const data = doc.data();
                if (data.instagramId || data.pageId) {
                    console.log(`[GROUP] Path: ${doc.ref.path} | IG_ID: ${data.instagramId} | PageID: ${data.pageId}`);
                }
            });
        }
    } catch (e) {
        console.log('Error al buscar vía collectionGroup:', e.message);
    }

    console.log('\n--- FIN DEL DIAGNÓSTICO ---');
}

diagnoseInstagram().catch(console.error);
