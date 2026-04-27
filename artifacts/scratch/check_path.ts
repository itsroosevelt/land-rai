import { db } from '../../src/lib/firebase-admin';

async function findPath() {
    console.log("🔍 BUSCANDO RUTA REAL DE LAS TARJETAS...");
    
    // Buscamos la tarjeta "Mey Titu" que aparece en tu pantalla
    const snapshot = await db.collectionGroup('cards')
        .where('contactName', '==', 'Mey Titu')
        .get();

    if (snapshot.empty) {
        console.log("❌ No encontré a 'Mey Titu'. ¿Quizás el nombre es exacto?");
        return;
    }

    const card = snapshot.docs[0];
    const fullPath = card.ref.path;
    console.log(`✅ ¡ENCONTRADA! Ruta completa: ${fullPath}`);
    
    // De esa ruta extraemos el userId y el entityId
    // Ejemplo: users/USER_ID/entities/ENTITY_ID/kanban-groups/GROUP_ID/cards/CARD_ID
    const parts = fullPath.split('/');
    const userId = parts[1];
    const entityId = parts[3];

    console.log(`\n--- DATOS DE CONEXIÓN REALES ---`);
    console.log(`User ID: ${userId}`);
    console.log(`Entity ID: ${entityId}`);
}

findPath().catch(console.error);
