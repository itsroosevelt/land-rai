const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();
const entityPath = 'users/g02IGViHitZjPKlOuCG7j5J3uK33/entities/roosevelt';

async function check() {
    console.log('--- BUSCANDO MENSAJES REALES EN ROOSEVELT ---');
    const tenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
    const contactSnap = await db.collection(`${entityPath}/contacts`).where('updatedAt', '>', tenMinAgo).get();
    
    if (contactSnap.empty) {
        console.log('No han llegado mensajes en los últimos 15 minutos.');
        return;
    }

    contactSnap.forEach(doc => {
        const data = doc.data();
        console.log(`\n✅ ¡LLEGÓ! Contacto: ${data.name}`);
        console.log(`Mensaje: "${data.lastMessage}"`);
        console.log(`Plataforma: ${data.origin}`);
        console.log(`Hora: ${data.updatedAt.toDate()}`);
    });
}

check().catch(console.error);
