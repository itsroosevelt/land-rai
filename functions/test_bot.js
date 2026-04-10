
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
const { tryTriggerBot } = require('./lib/helpers/botEngine.js');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

(async () => {
    try {
        const u = 'g02IGViHitZjPKlOuCG7j5J3uK33';
        const e = 'roosevelt';

        // This is testing with the facebook PSID and messenger platform
        const externalId = '26060639373637589';
        const text = 'hola';
        console.log(`Executing tryTriggerBot for ${externalId} on messenger...`);

        await tryTriggerBot(u, e, 'messenger', externalId, text);
        console.log('Execute finished!');
    } catch (e) {
        console.log('Execute Bot Flow Error:', e);
    }
})();
