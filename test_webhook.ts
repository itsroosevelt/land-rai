import { POST } from './src/app/api/meta/webhook/route';

async function test() {
    const req = new Request("http://localhost:3000/api/meta/webhook", {
        method: "POST",
        body: JSON.stringify({
          "object": "page",
          "entry": [
            {
              "id": "520950477768651",
              "time": 1712000000000,
              "messaging": [
                {
                  "sender": { "id": "123456789" },
                  "recipient": { "id": "520950477768651" },
                  "timestamp": 1712000000000,
                  "message": {
                    "text": "MENSAJE DE PRUEBA DESDE EL SISTEMA"
                  }
                }
              ]
            }
          ]
        })
    });
    
    const res = await POST(req);
    console.log(res.status);
    console.log(await res.json());
}

test().catch(console.error);
