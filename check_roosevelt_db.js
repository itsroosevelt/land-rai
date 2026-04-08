const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function check() {
    const rootPath = 'users/g02IGViHitZjPKlOuCG7j5J3uK33/entities/roosevelt';
    console.log(`Checking ${rootPath}/contacts`);
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const snap = await db.collection(`${rootPath}/contacts`).where('updatedAt', '>', threeHoursAgo.toISOString()).get();
    
    if (snap.empty) {
        console.log('No recent contacts in Roosevelt entity within 3 hrs.');
        
        // Let's also check if maybe date is stored differently
        const any = await db.collection(`${rootPath}/contacts`).orderBy('updatedAt', 'desc').limit(2).get();
        any.forEach(d => console.log('Latest contact:', d.id, d.data().updatedAt, d.data().name));
    } else {
        snap.forEach(doc => console.log('FOUND:', doc.data().name, doc.data().lastMessage));
    }
}
check().catch(console.error);
