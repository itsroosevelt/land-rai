
import { processChatbotFlow } from '../../src/lib/chatbotEngine';

async function diagnose() {
  const ctx = {
    userId: 'g02IGViHitZjPKlOuCG7j5J3uK33',
    entityId: 'roosevelt',
    groupId: 'pmEXQBM3nCrR4KRLpjlc',
    cardId: 'tg_7421651198',
    platform: 'telegram' as any,
    from: '7421651198',
    text: '/clear',
    messageId: 'tg_72_local'
  };
  
  console.log('--- DIAGNOSTIC START ---');
  await processChatbotFlow(ctx);
  console.log('--- DIAGNOSTIC END ---');
}

diagnose();
