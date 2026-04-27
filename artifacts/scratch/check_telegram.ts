import { db } from '../../src/lib/firebase-admin';
import axios from 'axios';

async function checkTelegram() {
    console.log('--- 🔍 REVISIÓN DE CONEXIÓN TELEGRAM ---');
    
    // 1. Buscar integraciones de Telegram activas
    const integrationsSnap = await db.collectionGroup('integrations')
        .where('provider', '==', 'telegram')
        .get();

    if (integrationsSnap.empty) {
        console.log('❌ No se encontraron integraciones de Telegram en la base de datos.');
        return;
    }

    for (const doc of integrationsSnap.docs) {
        const data = doc.data();
        const path = doc.ref.path;
        console.log(`\nFound Integration: ${path}`);
        console.log(`Status: ${data.status}`);
        console.log(`Bot Name: ${data.botName}`);
        
        const token = data.botToken;
        if (!token) {
            console.log('⚠️ No hay token guardado.');
            continue;
        }

        // 2. Consultar Webhook Info en Telegram
        try {
            const res = await axios.get(`https://api.telegram.org/bot${token}/getWebhookInfo`);
            const info = res.data;
            if (info.ok) {
                console.log('✅ Telegram Webhook Status:');
                console.log(`   URL: ${info.result.url}`);
                console.log(`   Pending Updates: ${info.result.pending_update_count}`);
                console.log(`   Last Error Date: ${info.result.last_error_date ? new Date(info.result.last_error_date * 1000) : 'None'}`);
                console.log(`   Last Error: ${info.result.last_error_message || 'None'}`);
            } else {
                console.log('❌ Error consultando Telegram API');
            }
        } catch (err: any) {
            console.log(`❌ Error API: ${err.message}`);
        }
    }

    // 3. Ver últimas tarjetas creadas por Telegram
    console.log('\n--- 📥 ÚLTIMOS MENSAJES RECIBIDOS (CARDS) ---');
    const cardsSnap = await db.collectionGroup('cards')
        .where('source', '==', 'TELEGRAM')
        .orderBy('updatedAt', 'desc')
        .limit(5)
        .get();

    if (cardsSnap.empty) {
        console.log('📭 No hay mensajes de Telegram registrados aún.');
    } else {
        cardsSnap.forEach(c => {
            const d = c.data();
            console.log(`- [${d.updatedAt?.toDate().toLocaleString()}] ${d.contactName}: "${d.lastMessage}"`);
        });
    }
}

checkTelegram().catch(console.error);
