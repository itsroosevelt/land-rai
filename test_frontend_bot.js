
require('ts-node').register({ transpileOnly: true });

const { processChatbotFlow } = require('./src/lib/chatbotEngine.ts');

(async () => {
    try {
        const u = 'g02IGViHitZjPKlOuCG7j5J3uK33';
        const e = 'roosevelt';

        // This is testing with the facebook PSID and messenger platform
        const externalId = '26060639373637589';
        const text = 'hola';
        const cardId = 'HNHCkxJn5G0t7S57GUp3';
        const groupId = 'pmEXQBM3nCrR4KRLpjlc';

        console.log(`Executing processChatbotFlow for Frontend...`);

        await processChatbotFlow({
            userId: u,
            entityId: e,
            groupId,
            cardId,
            platform: 'messenger',
            from: externalId,
            text
        });
        console.log('Execute finished!');
    } catch (e) {
        console.log('Execute Bot Flow Error:', e);
    }
})();
