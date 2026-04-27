import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import pino from 'pino';
import * as path from 'path';
import * as fs from 'fs';
import axios from 'axios';

const app = express();
app.use(cors());
app.use(express.json());

// Multi-session support: Key is "entityId_type" (e.g., "123_personal" or "123_business")
const activeSessions: { [sessionKey: string]: { sock: any, userId: string, type: string, entityId: string } } = {};
const sessionStatus: { [sessionKey: string]: string } = {};
const latestQRs: { [sessionKey: string]: string | null } = {};

const logger = pino({ level: 'silent' });

/**
 * Helper to get the correct webhook URL
 * Defaults to local emulator if no env is provided.
 */
const getWebhookUrl = () => {
    if (process.env.BAILEYS_WEBHOOK_URL) return process.env.BAILEYS_WEBHOOK_URL;
    // Fallback to local emulator
    return 'http://127.0.0.1:5001/roosevelt-491004/us-central1/baileysWebhook';
};

app.post('/api/internal/start-session', async (req, res) => {
    const { userId, entityId, type = 'personal' } = req.body;
    if (!userId || !entityId) {
        res.status(400).json({ error: 'Falta contexto del Molde Maestro (userId o entityId)' });
        return;
    }
    
    const sessionKey = `${entityId}_${type}`;
    console.log(`[🚀] Solicitud para iniciar motor WhatsApp [${type}] - Sesión: ${sessionKey}`);
    
    if (!activeSessions[sessionKey]) {
        sessionStatus[sessionKey] = 'GENERATING';
        startWhatsAppEngine(entityId, userId, type);
    }
    res.json({ success: true, status: sessionStatus[sessionKey] });
});

app.get('/api/internal/qr/:entityId', (req, res) => {
    const entityId = req.params.entityId;
    const type = req.query.type as string || 'personal';
    const sessionKey = `${entityId}_${type}`;
    
    res.json({
        qr: latestQRs[sessionKey] || null,
        status: sessionStatus[sessionKey] || 'IDLE'
    });
});

app.post('/api/internal/logout', async (req, res) => {
    const { entityId, type = 'personal' } = req.body;
    const sessionKey = `${entityId}_${type}`;
    
    if (activeSessions[sessionKey]) {
        console.log(`[🚪] Logout solicitado para ${sessionKey}`);
        try {
            await activeSessions[sessionKey].sock.logout();
            const sessionDir = path.join(__dirname, '../sessions', sessionKey);
            if (fs.existsSync(sessionDir)) fs.rmSync(sessionDir, { recursive: true, force: true });
            delete activeSessions[sessionKey];
            sessionStatus[sessionKey] = 'IDLE';
            latestQRs[sessionKey] = null;
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: 'Error al cerrar sesión' });
        }
    } else {
        res.status(404).json({ error: 'Sesión no encontrada' });
    }
});

async function startWhatsAppEngine(entityId: string, userId: string, type: string) {
    const sessionKey = `${entityId}_${type}`;
    const sessionDir = path.join(__dirname, '../sessions', sessionKey);
    if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion();
    
    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger,
        browser: ['Roosevelt', 'Chrome', '121.0.0.0']
    });

    activeSessions[sessionKey] = { sock, userId, type, entityId };

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log(`[QR] Generado para ${sessionKey}`);
            latestQRs[sessionKey] = qr;
            sessionStatus[sessionKey] = 'READY';
        }

        if (connection === 'open') {
            const phoneNumber = sock.user?.id?.split(':')[0] || sock.user?.id?.split('@')[0] || 'Unknown';
            console.log(`[✅] Conectado: ${sessionKey} con número ${phoneNumber}`);
            sessionStatus[sessionKey] = 'CONNECTED';
            latestQRs[sessionKey] = null;

            axios.post(getWebhookUrl(), {
                userId,
                entityId,
                type,
                phoneNumber,
                event: 'connection_open'
            }).catch(e => console.error('[❌] Error avisando de conexión abierta:', e.message));
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(`[❌] Conexión cerrada para ${sessionKey}. Reintentar: ${shouldReconnect}`);
            
            if (shouldReconnect) {
                setTimeout(() => startWhatsAppEngine(entityId, userId, type), 3000);
            } else {
                axios.post(getWebhookUrl(), {
                    userId,
                    entityId,
                    type,
                    event: 'connection_closed'
                }).catch(() => {});

                try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch (e) {}
                delete activeSessions[sessionKey];
                sessionStatus[sessionKey] = 'IDLE';
                latestQRs[sessionKey] = null;
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (m) => {
        if (m.type !== 'notify') return;

        for (const msg of m.messages) {
            if (msg.key.fromMe) continue;

            const text = msg.message?.conversation || 
                         msg.message?.extendedTextMessage?.text || 
                         msg.message?.imageMessage?.caption || 
                         "";
            
            const from = msg.key.remoteJid?.split('@')[0] || '';
            const contactName = msg.pushName || 'Contacto WhatsApp';
            
            if (!text && !msg.message?.imageMessage) continue;

            console.log(`[📩] ${sessionKey} -> Mensaje de ${from}`);

            let msgType = 'text';
            if (msg.message?.imageMessage) msgType = 'image';
            if (msg.message?.videoMessage) msgType = 'video';
            if (msg.message?.audioMessage) msgType = 'audio';

            axios.post(getWebhookUrl(), {
                userId: userId,
                entityId: entityId,
                type: type,
                message: {
                    from: from,
                    contactName: contactName,
                    text: text,
                    type: msgType,
                    timestamp: (msg.messageTimestamp as number) * 1000,
                    mediaUrl: null
                }
            }).catch(error => console.error(`[❌] Webhook Error (${sessionKey}): ${error.message}`));
        }
    });
}

const PORT = 4000;
app.listen(PORT, () => {
    console.log(`[🔥] WhatsApp Service v2 (Multi-Session) volando en puerto ${PORT}`);
});
