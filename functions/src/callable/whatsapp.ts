
// src/callable/whatsapp.ts
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { sendMessage, sendMediaMessage } from '../helpers/whatsappAPI';

const db = admin.firestore();

// Common function to log any outgoing message to the Firestore card
async function logMessageInCard(userId: string, entityId: string, groupId: string, cardId: string, text: string, whatsappMessageId?: string) {
    const cardRef = db.collection(`users/${userId}/entities/${entityId}/kanban-groups`).doc(groupId).collection('cards').doc(cardId);
    await cardRef.update({
        lastMessage: text.length > 40 ? text.substring(0, 37) + '...' : text,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        messages: admin.firestore.FieldValue.arrayUnion({
            sender: 'agent', // Represents a human agent, not the bot
            text: text,
            timestamp: new Date(),
            whatsappMessageId: whatsappMessageId || null,
        }),
    });
}

// Function to handle sending TEXT messages
export const sendWhatsappMessage = functions.https.onCall(async (data: any, context: functions.https.CallableContext) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }

    const userId = context.auth.uid;
    const { cardId, groupId, message, toNumber, entityId } = data;
    
    if (!cardId || !groupId || !message || !toNumber || !entityId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required data (cardId, groupId, entityId, message, toNumber).');
    }

    try {
        const response = await sendMessage(toNumber, message);
        const wa_id = response?.messages?.[0]?.id;

        await logMessageInCard(userId, entityId, groupId, cardId, message, wa_id);
        return { success: true, messageId: wa_id };
    } catch (error: any) {
        functions.logger.error(`Error in sendWhatsappMessage for card ${cardId}:`, error.message);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

// Function to handle sending MEDIA messages (images, documents, etc.)
export const sendWhatsappMediaMessage = functions.https.onCall(async (data: any, context: functions.https.CallableContext) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }

    const userId = context.auth.uid;
    const { cardId, groupId, fileUrl, toNumber, fileName, entityId } = data;
    
    if (!cardId || !groupId || !fileUrl || !toNumber || !fileName || !entityId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required data (cardId, groupId, entityId, fileUrl, fileName, toNumber).');
    }

    try {
        const response = await sendMediaMessage(toNumber, fileUrl, fileName);
        const wa_id = response?.messages?.[0]?.id;

        const logText = `Archivo enviado: ${fileName}`;
        await logMessageInCard(userId, entityId, groupId, cardId, logText, wa_id);

        return { success: true, messageId: wa_id };
    } catch (error: any) {
        functions.logger.error(`Error in sendWhatsappMediaMessage for card ${cardId}:`, error.message);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
