const admin = require('firebase-admin');
const path = require('path');

const serviceAccountPath = path.join(__dirname, '../../serviceAccountKey.json');
const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

(async () => {
  try {
    const userId = 'g02IGViHitZjPKlOuCG7j5J3uK33';
    
    console.log('Verificando suscripción de Luxor...\n');
    const subscriptionRef = db.collection('users').doc(userId).collection('subscriptions').doc('current');
    const subscriptionDoc = await subscriptionRef.get();
    
    if (subscriptionDoc.exists) {
      const data = subscriptionDoc.data();
      console.log('✅ SUSCRIPCIÓN VERIFICADA EN BD:\n');
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log('❌ Suscripción no encontrada');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
