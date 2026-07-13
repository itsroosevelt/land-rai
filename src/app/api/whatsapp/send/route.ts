import { NextResponse } from 'next/server';
import axios from 'axios';
import { db, admin } from '@/lib/firebase-admin';

export async function POST(req: Request) {
    try {
        const bodyValue = await req.json();
        const { message, toNumber, cardId, groupId, type, template, url, filename, platform = 'kamban', userId, entityId } = bodyValue;

        if ((!message && !url) || !toNumber) {
            return NextResponse.json(
                { error: 'Missing required fields: toNumber and message or url' },
                { status: 400 }
            );
        }

        if (!userId || !entityId) {
            return NextResponse.json(
                { error: 'Missing tenant context: userId and entityId are required' },
                { status: 400 }
            );
        }

        let responseData: any = {};
        let messageId: string | undefined;
        let cleanTo = toNumber;

        // --- Platform Switching Logic ---
        const targetPlatform = platform.toLowerCase();

        let finalCardId = cardId;
        let finalGroupId = groupId;
        let apiError: any = null;

        try {
            if (targetPlatform === 'instagram' || targetPlatform === 'messenger') {
                console.log(`[Omnichannel API] Sending to ${targetPlatform} (ID: ${toNumber}) for tenant ${entityId}`);
                const { sendMetaMessage } = await import('@/lib/sendProviders');
                responseData = await sendMetaMessage(toNumber, message, {
                    type,
                    url,
                    userId,
                    entityId,
                    provider: targetPlatform as 'messenger' | 'instagram'
                });
                messageId = responseData?.message_id;
            } else if (targetPlatform === 'gmail') {
                console.log(`[Omnichannel API] Sending to Gmail (To: ${toNumber}) for tenant ${entityId} | Thread: ${bodyValue.threadId || 'New'}`);
                const { sendGmailMessage } = await import('@/lib/sendProviders');
                responseData = await sendGmailMessage(toNumber, message, {
                    userId,
                    entityId,
                    subject: bodyValue.subject || 'Re: Respuesta de soporte',
                    threadId: bodyValue.threadId
                });
                messageId = responseData?.id;
                if (responseData?.threadId) {
                    bodyValue.threadId = responseData.threadId;
                }
            } else if (targetPlatform === 'telegram') {
                console.log(`[Omnichannel API] Sending to Telegram (chatId: ${toNumber}) for tenant ${entityId}`);
                const { sendTelegramMessage } = await import('@/lib/sendProviders');
                responseData = await sendTelegramMessage(toNumber, message, { userId, entityId });
                messageId = responseData?.message_id ? `tg_${responseData.message_id}` : undefined;
            } else {
                const { sendWhatsAppMessage } = await import('@/lib/sendProviders');
                console.log(`[Omnichannel API] Attempting to send WhatsApp message to ${toNumber}...`);

                let sendOptions: any = { type, template, url, filename, userId, entityId };
                const cleanSearch = toNumber.replace(/\D/g, '');

                // MULTI-NUMBER: reply FROM the same business number the conversation is on.
                if (cleanSearch) {
                    try {
                        const groupsSnap = await db
                            .collection(`users/${userId}/entities/${entityId}/kanban-groups`)
                            .get();
                        for (const groupDoc of groupsSnap.docs) {
                            const cardSnap = await groupDoc.ref
                                .collection('cards')
                                .where('contactNumberClean', '==', cleanSearch)
                                .limit(1)
                                .get();
                            if (!cardSnap.empty) {
                                const bizNumber = cardSnap.docs[0].data()?.whatsappPhoneNumberId;
                                if (bizNumber) sendOptions.fromPhoneNumberId = String(bizNumber);
                                break;
                            }
                        }
                    } catch (numErr) {
                        console.warn('[Omnichannel API] Business number lookup skipped:', numErr);
                    }
                }

                if ((!type || type === 'text') && !template && cleanSearch) {
                    try {
                        let cardMessages: any[] = [];
                        const groupsSnap = await db
                            .collection(`users/${userId}/entities/${entityId}/kanban-groups`)
                            .get();
                        for (const groupDoc of groupsSnap.docs) {
                            const cardSnap = await groupDoc.ref
                                .collection('cards')
                                .where('contactNumberClean', '==', cleanSearch)
                                .limit(1)
                                .get();
                            if (!cardSnap.empty) {
                                cardMessages = cardSnap.docs[0].data()?.messages || [];
                                break;
                            }
                        }
                        const entitySnap = await db.doc(`users/${userId}/entities/${entityId}`).get();
                        const { resolveWhatsAppSendGuard } = await import('@/lib/whatsapp/sessionGuard');
                        const guard = resolveWhatsAppSendGuard(cardMessages, message || '', entitySnap.data());
                        if (guard.blockSend) {
                            return NextResponse.json({ error: guard.blockReason }, { status: 400 });
                        }
                        if (guard.useTemplate && guard.templatePayload) {
                            sendOptions = { ...sendOptions, ...guard.templatePayload };
                        }
                    } catch (guardErr) {
                        console.warn('[Omnichannel API] Session guard skipped:', guardErr);
                    }
                }

                responseData = await sendWhatsAppMessage(toNumber, message, sendOptions);
                messageId = responseData?.messages?.[0]?.id;
                cleanTo = responseData?.sentTo || toNumber;
                console.log(`[Omnichannel API] [META RESPONSE]:`, JSON.stringify(responseData, null, 2));
            }
            console.log(`[Omnichannel API] ✅ SUCCESS! Platform: ${targetPlatform}, ID: ${messageId} | Recipient: ${cleanTo}`);
        } catch (error: any) {
            apiError = error.response?.data || error.message;
            console.error(`[Omnichannel API] ❌ FAILED (${targetPlatform})`, apiError);
            // We proceed to Firestore log even if API failed
        }

        // 2. Log in Firestore (Aggressive Resolution)
        // If we have a temporary ID or missing IDs, we MUST search by number
        let resolvedCardId = finalCardId;
        let resolvedGroupId = finalGroupId;

        if (!resolvedCardId || !resolvedGroupId || resolvedCardId.startsWith('temp')) {
            console.log(`[Omnichannel API] 🔍 Resolving entity-card for platform: ${targetPlatform}, ID: ${cleanTo}`);
            try {
                const groupsSnap = await db.collection('users').doc(userId).collection('entities').doc(entityId).collection('kanban-groups').get();
                for (const groupDoc of groupsSnap.docs) {
                    const cardsRef = groupDoc.ref.collection('cards');
                    let cardSnap: any = null;

                    // Strategy A: Search by platform_ids (Modern Schema — Messenger/Instagram PSID)
                    const rawPlatform = targetPlatform.toLowerCase();
                    const platformKey = (rawPlatform === 'facebook' || rawPlatform === 'messenger') ? 'messenger' : rawPlatform;
                    const queryByPlatformId = await cardsRef.where(`platform_ids.${platformKey}`, '==', cleanTo).limit(1).get();
                    if (!queryByPlatformId.empty) {
                        resolvedCardId = queryByPlatformId.docs[0].id;
                        resolvedGroupId = groupDoc.id;
                        console.log(`[Omnichannel API] ✅ Found via platform_ids.${platformKey}: ${resolvedCardId}`);
                        break;
                    }

                    // Strategy B: Search by email (Gmail specific)
                    if (targetPlatform === 'gmail') {
                        const queryByEmail = await cardsRef.where('email', '==', cleanTo).limit(1).get();
                        if (!queryByEmail.empty) {
                            resolvedCardId = queryByEmail.docs[0].id;
                            resolvedGroupId = groupDoc.id;
                            console.log(`[Omnichannel API] ✅ Found via email field: ${resolvedCardId}`);
                            break;
                        }
                    }

                    // Strategy C: Legacy phone-based search (WhatsApp)
                    if (targetPlatform === 'whatsapp' || targetPlatform === 'kamban') {
                        const searchNo = cleanTo.replace(/\+/g, '').replace(/\D/g, '');
                        const query1 = await cardsRef.where('contactNumberClean', '==', searchNo).get();
                        const query2 = query1.empty ? await cardsRef.where('contactNumber', '==', cleanTo).get() : query1;
                        const query3 = query2.empty ? await cardsRef.where('external_id', '==', cleanTo).get() : query2;

                        if (!query3.empty) {
                            const sorted = query3.docs.sort((a, b) => {
                                const tA = (a.data().updatedAt?.toDate?.() || new Date(0)).getTime();
                                const tB = (b.data().updatedAt?.toDate?.() || new Date(0)).getTime();
                                return tB - tA;
                            });
                            resolvedCardId = sorted[0].id;
                            resolvedGroupId = groupDoc.id;
                            console.log(`[Omnichannel API] ✅ Found via phone: ${resolvedCardId}`);
                            break;
                        }
                    }
                }
            } catch (err: any) {
                console.error('[Omnichannel API] Resolution error:', err.message);
            }
        }

        if (resolvedCardId && resolvedGroupId) {
            try {
                const cardRef = db
                    .collection('users').doc(userId)
                    .collection('entities').doc(entityId)
                    .collection('kanban-groups').doc(resolvedGroupId)
                    .collection('cards').doc(resolvedCardId);

                const newMessage = {
                    sender: 'agent',
                    text: message || '',
                    timestamp: new Date(),
                    whatsappMessageId: messageId || null,
                    platform: targetPlatform,
                    subject: bodyValue.subject || null,
                    ...(url ? {
                        fileUrl: url,
                        fileType: type === 'image' ? 'image/*' :
                            type === 'video' ? 'video/*' :
                            type === 'audio' ? 'audio/*' :
                            'application/octet-stream',
                        fileName: filename || null,
                        type: 'media',
                        metadata: {
                            url,
                            filename: filename || null
                        }
                    } : {}),
                    status: apiError ? 'failed' : 'sent',
                    error: apiError ? (typeof apiError === 'object' ? JSON.stringify(apiError) : apiError) : null
                };

                await cardRef.update({
                    lastMessage: (message || filename || 'Adjunto').length > 40
                        ? (message || filename || 'Adjunto').substring(0, 37) + '...'
                        : (message || filename || 'Adjunto'),
                    updatedAt: new Date(),
                    ...(targetPlatform === 'whatsapp' ? { contactNumberClean: cleanTo.replace(/\D/g, '') } : {}),
                    messages: admin.firestore.FieldValue.arrayUnion(newMessage),
                    unreadCount: 0,
                });
                console.log(`[Omnichannel API] Firestore log success for ${resolvedCardId} (Status: ${newMessage.status})`);
            } catch (logError: any) {
                console.error('[Omnichannel API] Firestore log failed:', logError.message);
            }
        }

        if (apiError) {
            return NextResponse.json(
                { error: 'Failed to send message', details: apiError },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            data: responseData,
            messageId: messageId,
            sentTo: cleanTo,
            cardId: resolvedCardId,
            groupId: resolvedGroupId
        });
    } catch (error: any) {
        console.error('Fatal API Error:', error.message);
        return NextResponse.json(
            { error: 'Fatal error processing request', details: error.message },
            { status: 500 }
        );
    }
}
