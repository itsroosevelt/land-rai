
const admin = require('firebase-admin');
const fs = require('fs');
const dotenv = require('dotenv');

// Cargar variables de entorno
if (fs.existsSync('.env')) {
    const envConfig = dotenv.parse(fs.readFileSync('.env'));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.error('❌ Error: No se encontró FIREBASE_SERVICE_ACCOUNT en .env');
    process.exit(1);
}

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (sa.private_key) {
    sa.private_key = sa.private_key.replace(/\\n/g, '\n');
}
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

async function audit() {
    console.log('🚀 Iniciando Auditoría de Instagram...');
    
    // 1. Buscar en la Raíz (Lo que NO debería existir)
    console.log('\n--- REVISANDO RAÍZ (INTEGRATIONS GLOBAL) ---');
    const rootSnap = await db.collection('integrations').get();
    rootSnap.docs.forEach(doc => {
        const d = doc.data();
        if (d.provider === 'instagram' || d.instagramId) {
            console.log(`⚠️ ENCONTRADO EN RAÍZ: ${doc.id} | InstagramId: ${d.instagramId}`);
        }
    });

    // 2. Buscar en Colección Group (Multi-tenant)
    console.log('\n--- REVISANDO MULTI-TENANT (ENTITY BÓVEDAS) ---');
    const groupSnap = await db.collectionGroup('integrations').get();
    groupSnap.docs.forEach(doc => {
        if (doc.ref.path.includes('users/')) {
            const d = doc.data();
            if (d.provider === 'instagram' || d.instagramId) {
                console.log(`✅ ENCONTRADO EN ENTIDAD: ${doc.ref.path}`);
                console.log(`   InstagramId: ${d.instagramId}`);
                console.log(`   Provider: ${d.provider}`);
            }
        }
    });

    process.exit(0);
}

audit().catch(console.error);
