
require('ts-node').register({ transpileOnly: true });
const { sendMetaMessage } = require('./src/lib/sendProviders.ts');

(async () => {
    try {
        const u = 'g02IGViHitZjPKlOuCG7j5J3uK33';
        const e = 'roosevelt';
        const recipientId = '26060639373637589';

        console.log('Testing sendMetaMessage...');
        const res = await sendMetaMessage(recipientId, 'Prueba desde script bot', {
            userId: u,
            entityId: e,
            provider: 'messenger'
        });
        console.log('Success:', res);
    } catch (err) {
        console.error('Send Error:', err.message);
    }
})();
