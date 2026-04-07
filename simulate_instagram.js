const axios = require('axios');

async function simulate() {
  console.log('--- Simulando Mensaje de Instagram a Producción ---');
  const payload = {
    "object": "instagram",
    "entry": [
      {
        "id": "17841466494261834",
        "time": Date.now(),
        "messaging": [
          {
            "sender": { "id": "TEST_USER_IG" },
            "recipient": { "id": "17841466494261834" },
            "timestamp": Date.now(),
            "message": {
              "mid": "mid.test_ig_" + Date.now(),
              "text": "SIMULACION INSTAGRAM"
            }
          }
        ]
      }
    ]
  };

  try {
    const res = await axios.post('https://byroosevelt.com/api/meta/webhook', payload);
    console.log('Status:', res.status);
    console.log('Response:', JSON.stringify(res.data));
  } catch (err) {
    console.log('Error Status:', err.response?.status);
    console.log('Error Data:', JSON.stringify(err.response?.data));
  }
}

simulate();
