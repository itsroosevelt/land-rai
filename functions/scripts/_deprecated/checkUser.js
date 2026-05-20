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
    const userId = 'g0ZlGVjHtZjPKl0uCG7j5J3uK33';
    
    console.log('Verificando usuario:', userId);
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (userDoc.exists) {
      console.log('✓ Usuario encontrado');
      console.log('Datos:', JSON.stringify(userDoc.data(), null, 2));
    } else {
      console.log('❌ Usuario no encontrado en collection "users"');
      
      console.log('\n📋 Listando primeros 3 usuarios...');
      const snapshot = await db.collection('users').limit(3).get();
      console.log(`Total usuarios encontrados: ${snapshot.size}`);
      snapshot.forEach(doc => {
        console.log('\nID:', doc.id);
        console.log('Email:', doc.data().email);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
