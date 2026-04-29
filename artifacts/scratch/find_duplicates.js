
const admin = require('firebase-admin');
const dotenv = require('dotenv');
dotenv.config();

let serviceAccount;
try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    // Fix private key newlines
    if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
} catch (e) {
    console.error('Error parsing FIREBASE_SERVICE_ACCOUNT');
}

if (!admin.apps.length && serviceAccount) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
    });
}

const db = admin.firestore();

async function findDuplicateNumber(targetId) {
    console.log(`--- 🔍 BUSCANDO NÚMERO DUPLICADO: ${targetId} ---`);
    
    // Lista de colecciones sospechosas
    const collections = ['integrations', 'whatsapp-integrations', 'whatsapp_internal', 'accounts'];
    
    for (const collName of collections) {
        console.log(`Buscando en Collection Group: ${collName}...`);
        const snap = await db.collectionGroup(collName).get();
        snap.forEach(doc => {
            const data = doc.data();
            // Check for various possible field names
            const found = 
                String(data.phoneNumberId) === String(targetId) || 
                String(data.id) === String(targetId) ||
                String(data.phone).includes(targetId) ||
                String(data.displayPhoneNumber).includes(targetId);
                
            if (found) {
                console.log(`✅ ¡ENCONTRADO!`);
                console.log(`Path: ${doc.ref.path}`);
                console.log(`Data:`, data);
            }
        });
    }
    console.log('--- FIN DE LA BÚSQUEDA ---');
}

// Check for the specific phone ID from the screenshot
const target = '676837795516836'; 
findDuplicateNumber(target).catch(console.error);
