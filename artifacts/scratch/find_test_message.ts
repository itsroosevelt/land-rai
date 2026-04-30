import { db } from '../../src/lib/firebase-admin';

async function findTest() {
    console.log("🔍 RASTREANDO MENSAJE DE 'SOPORTE ANTIGRAVITY'...");
    
    const snapshot = await db.collectionGroup('cards')
        .where('contactName', '==', 'SOPORTE ANTIGRAVITY')
        .get();

    if (snapshot.empty) {
        console.log("❌ MI MENSAJE NO SE GUARDÓ. Hay un error en el código del Webhook.");
        return;
    }

    snapshot.forEach(doc => {
        console.log(`✅ ¡LO ENCONTRÉ!`);
        console.log(`Ruta: ${doc.ref.path}`);
        console.log(`Datos: ${JSON.stringify(doc.data())}`);
    });
}

findTest().catch(console.error);
