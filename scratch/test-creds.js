const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(sa)
    });
}

const db = admin.firestore();

async function testCreds() {
    const userId = 'g02IGViHitZjPKlOuCG7j5J3uK33';
    const entityId = 'roosevelt';
    
    console.log(`\n--- [DIAGNÓSTICO LOCAL] ---`);
    console.log(`Buscando en: users/${userId}/entities/${entityId}/integrations\n`);

    try {
        const integrationsPath = `users/${userId}/entities/${entityId}/integrations`;
        const intSnap = await db.collection(integrationsPath).get();
        
        if (intSnap.empty) {
            console.log(`❌ ERROR: No se encontró la colección 'integrations' en esa ruta.`);
            // Probar con casing corregido (gO2 vs g02)
            console.log(`🔍 Probando con casing alternativo...`);
            const altUserId = 'gO2IGViHitZjPKlOuCG7j5J3uK33'; // Ejemplo con O mayúscula
            const altPath = `users/${altUserId}/entities/${entityId}/integrations`;
            const altSnap = await db.collection(altPath).get();
            if (!altSnap.empty) {
                console.log(`✅ ¡ÉXITO! Encontrado en ruta con casing: ${altPath}`);
            }
        }

        let foundToken = null;
        let foundPhone = null;

        for (const doc of intSnap.docs) {
            const d = doc.data();
            console.log(`📄 Documento: [${doc.id}]`);
            
            const t = d?.accessToken || d?.token || d?.access_token || d?.pageAccessToken;
            const p = d?.phoneNumberId || d?.phone_number_id || d?.phoneId;
            
            if (t) {
                console.log(`   - ✅ Token: ${t.substring(0, 10)}... (Campo: ${d.accessToken ? 'accessToken' : 'otro'})`);
                if (!foundToken) foundToken = t;
            }
            if (p) {
                console.log(`   - ✅ PhoneID: ${p} (Campo: ${d.phoneNumberId ? 'phoneNumberId' : 'otro'})`);
                if (!foundPhone) foundPhone = p;
            }
        }

        console.log(`\n--- RESULTADO FINAL ---`);
        console.log(`Token detectado: ${foundToken ? 'SÍ' : 'NO'}`);
        console.log(`PhoneID detectado: ${foundPhone ? 'SÍ' : 'NO'}`);
        
        if (foundToken && foundPhone) {
            console.log(`\n🚀 CONCLUSIÓN: La lógica de búsqueda profunda FUNCIONARÁ.`);
        } else {
            console.log(`\n⚠️ CONCLUSIÓN: Sigue faltando información en Firebase.`);
        }
        
    } catch (err) {
        console.error(`\n❌ ERROR DE FIREBASE:`, err.message);
    }
    process.exit();
}

testCreds();
