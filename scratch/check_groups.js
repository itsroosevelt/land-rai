const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function check() {
  const entityPath = 'users/l3P12W2Zp4e5O1cO0Y447b8SjRj2/entities/ry_1';
  const groups = await db.collection(`${entityPath}/kanban-groups`).get();
  groups.forEach(g => console.log(g.id, g.data().name));
  process.exit(0);
}
check();
