const fetch = require('node-fetch'); // Asumiendo que node-fetch está instalado o usando fetch nativo en Node 18+

async function runTest() {
    console.log("🚀 Iniciando prueba de simulación de Webhook de WhatsApp...");

    const payload = {
        "object": "whatsapp_business_account",
        "entry": [{
            "id": "676837795516836",
            "changes": [{
                "value": {
                    "messaging_product": "whatsapp",
                    "metadata": {
                        "display_phone_number": "1234567890",
                        "phone_number_id": "676837795516836"
                    },
                    "contacts": [{
                        "profile": { "name": "Test User" },
                        "wa_id": "593963142795"
                    }],
                    "messages": [{
                        "from": "593963142795",
                        "id": "wamid.HBgLNTkzOTYzMTQyNzk1FQIAEhgWMUVCQjQ4RThDQzQ0NEQwQzhEMjY5AA==",
                        "timestamp": Math.floor(Date.now() / 1000).toString(),
                        "text": { "body": "hola prueba bot" },
                        "type": "text"
                    }]
                },
                "field": "messages"
            }]
        }]
    };

    try {
        // Enviar al webhook local
        const url = 'http://localhost:3000/api/whatsapp/webhook?u=g02IGViHitZjPKlOuCG7j5J3uK33&e=roosevelt';
        console.log(`📡 Enviando a: ${url}`);
        
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const text = await response.text();
        console.log(`\n🎯 Respuesta del Servidor (Status: ${response.status}):\n${text}`);

    } catch (error) {
        console.error("❌ Error conectando al servidor local:", error.message);
        console.log("Asegúrate de que 'npm run dev' esté corriendo en el puerto 3000.");
    }
}

runTest();
