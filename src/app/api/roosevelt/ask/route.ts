import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

function generateLocalCopilotResponse(query: string): string {
    const q = query.toLowerCase();

    if (q.includes('hola') || q.includes('hello') || q.includes('quien eres') || q.includes('quién eres')) {
        return `¡Hola! Soy **Roosevelt AI**, el copiloto inteligente y centro de mando ejecutivo de tu plataforma. 

Puedo ayudarte a:
- 📊 **Monitorear tus métricas y empresas** desde el módulo **CEO**.
- 💬 **Gestionar conversaciones multicanal y WhatsApp** en el módulo **COO**.
- 👥 **Segmentar contactos y clientes en tu CRM** en el módulo **CMO**.
- 🤖 **Construir bots y orquestar automatizaciones** en el módulo **CTO**.

¿Qué área de tu negocio te gustaría optimizar hoy?`;
    }

    if (q.includes('whatsapp') || q.includes('chat') || q.includes('mensaje')) {
        return `Para gestionar tus chats y flujos de WhatsApp:
1. Ve a **COO → WhatsApp Flows** o **Omnichannel**.
2. Puedes configurar agentes automáticos que califiquen prospectos en tiempo real.
3. Si necesitas conectar tu número oficial, ve a **CTO → Integraciones → WhatsApp Cloud API**.`;
    }

    if (q.includes('empresa') || q.includes('entidad') || q.includes('crear') || q.includes('entorno')) {
        return `Para crear o alternar entre tus empresas:
- En la pantalla actual de **Núcleo**, pulsa el botón **"+ Crear Entorno"** o usa el selector superior.
- Cada entidad cuenta con sus propios contactos, bots, Kanban e integraciones aisladas de forma segura.`;
    }

    if (q.includes('kanban') || q.includes('tarjeta') || q.includes('postulacion') || q.includes('proceso')) {
        return `El **Kanban Operativo** se encuentra en **COO → Operational Kamban**:
- Permite arrastrar prospectos y clientes entre columnas (Recepción, En Revisión, Aprobados).
- Los bots pueden mover tarjetas automáticamente según las respuestas de los clientes.`;
    }

    if (q.includes('bot') || q.includes('automatizacion') || q.includes('agente')) {
        return `En el módulo **CTO**:
- **Neural Automation / WhatsApp Bots:** Crea flujos interactivos de preguntas y respuestas.
- **AI Orchestrator:** Coordina múltiples agentes especializados para resolver tareas complejas de tu empresa.`;
    }

    return `He recibido tu consulta sobre: "${query}".

Como copiloto de **Roosevelt**, estoy preparado para asistirte en la dirección estratégica, operaciones de WhatsApp, automatizaciones de IA y finanzas de tus entidades. 

*(Nota: Para respuestas de razonamiento extendido en tiempo real, puedes recargar créditos en tu cuenta de Google AI Studio).*`;
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { message, model = 'flash', history = [] } = body;

        if (!message || typeof message !== 'string') {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 });
        }

        const apiKey = process.env.GEMINI_API_KEY?.trim();
        if (!apiKey) {
            return NextResponse.json({ reply: generateLocalCopilotResponse(message) });
        }

        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const targetModel = model === 'pro' ? 'gemini-2.5-pro' : 'gemini-2.5-flash';

            const systemInstruction = `Eres Roosevelt AI, un copiloto ejecutivo y agente inteligente de nivel mundial para la plataforma SaaS Roosevelt (Land-RAI).
Tu rol es asistir a los fundadores y equipos a gestionar sus empresas, automatizaciones, WhatsApp multicanal, CRM, Kanban y ecosistemas Web3.
Tus respuestas deben ser claras, ejecutivas, concisas y elegantes, utilizando formato markdown profesional.
Responde en el mismo idioma en que te hablen.`;

            const geminiModel = genAI.getGenerativeModel({
                model: targetModel,
                systemInstruction,
            });

            const chat = geminiModel.startChat({
                history: history.slice(-6).map((h: { role: string; content: string }) => ({
                    role: h.role === 'user' ? 'user' : 'model',
                    parts: [{ text: h.content }],
                })),
            });

            const result = await chat.sendMessage(message);
            const reply = result.response.text();

            return NextResponse.json({ reply });
        } catch (apiError: any) {
            console.warn('[Roosevelt AI] Google AI Studio credit notice or fallback triggered:', apiError?.message || apiError);
            return NextResponse.json({ reply: generateLocalCopilotResponse(message) });
        }
    } catch (error: any) {
        console.error('[Roosevelt AI Route Error]', error);
        return NextResponse.json(
            { 
                reply: `¡Hola! Soy Roosevelt AI. ¿En qué puedo asistirte con tus entidades y automatizaciones hoy?` 
            }, 
            { status: 200 }
        );
    }
}
