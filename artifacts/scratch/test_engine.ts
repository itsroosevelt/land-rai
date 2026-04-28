
import { processChatbotFlow, ChatbotContext } from '../../src/lib/chatbotEngine';

async function test() {
  const ctx: ChatbotContext = {
    userId: 'g02IGViHitZjPKlOuCG7j5J3uK33',
    entityId: 'roosevelt',
    groupId: 'pmEXQBM3nCrR4KRLpjlc',
    cardId: 'tg_7421651198',
    platform: 'telegram',
    from: '7421651198',
    text: '/clear',
    messageId: 'tg_71'
  };
  
  console.log('Starting manual trigger...');
  try {
    await processChatbotFlow(ctx);
    console.log('Manual trigger finished successfully');
  } catch (err) {
    console.error('Manual trigger CRASHED:', err);
  }
}

test();
