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
    const email = 'admluxorsys@gmail.com';
    
    console.log('Buscando usuario por email:', email);
    const snapshot = await db.collection('users').where('email', '==', email).get();
    
    if (!snapshot.empty) {
      console.log('✓ Usuario encontrado\n');
      snapshot.forEach(doc => {
        console.log('ID:', doc.id);
        console.log('Email:', doc.data().email);
        console.log('Nombre:', doc.data().name);
        console.log('Creado:', doc.data().createdAt);
      });
    } else {
      console.log('❌ Usuario no encontrado con ese email');
      console.log('\nListando todos los usuarios para verificar...');
      const allUsers = await db.collection('users').get();
      console.log(`Total de usuarios: ${allUsers.size}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
