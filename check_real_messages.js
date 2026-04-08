const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function check() {
    const rootPath = 'users/g02IGViHitZjPKlOuCG7j5J3uK33/entities/roosevelt';
    console.log('--- BUSCANDO MENSAJES REALES RECIENTES ---');
    
    // Check Kanban Cards (which hold messages)
    const groups = await db.collection(`${rootPath}/kanban-groups`).get();
    let found = false;
    for (const g of groups.docs) {
        const cards = await g.ref.collection('cards').orderBy('updatedAt', 'desc').limit(5).get();
        cards.forEach(c => {
             const data = c.data();
             if (data.source === 'messenger' || data.source === 'instagram') {
                 console.log(`[EXITO] Grupo: ${g.data().name} | Contacto: ${data.contactName} | Último Mensaje: "${data.lastMessage}" | Plataforma: ${data.source} | Fecha: ${data.updatedAt.toDate()}`);
                 found = true;
             }
        });
    }
    if (!found) console.log('❌ No hay mensajes reales en los tableros Kanban.');
}
check().catch(console.error);
