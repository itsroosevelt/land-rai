import { NextResponse } from "next/server";
import { db, admin } from "@/lib/firebase-admin";
import { registerWhatsAppTenantMapping } from "@/lib/whatsappTenant";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Delivery-speed control -> delay between sends (ms).
const delayForSpeed = (speed?: string): number => {
    switch (speed) {
        case "10":
            return 6000;
        case "50":
            return 1200;
        case "100":
            return 600;
        default:
            return 250; // "No limit" still keeps a safe minimum spacing
    }
};

// Replace dynamic tokens with recipient data.
const resolveTokens = (input: string, r: any): string => {
    if (!input) return input;
    return input
        .replace(/\{\{\s*Nombre\s*\}\}/gi, r.name || "")
        .replace(/\{\{\s*Tel[eé]fono\s*\}\}/gi, r.phone || "")
        .replace(/\{\{\s*Pa[ií]s\s*\}\}/gi, r.country || "");
};

export async function POST(req: Request) {
    try {
        const { userId, entityId, broadcastId } = await req.json();
        if (!userId || !entityId || !broadcastId) {
            return NextResponse.json(
                { error: "Missing userId, entityId or broadcastId" },
                { status: 400 }
            );
        }

        const tenantPath = `users/${userId}/entities/${entityId}`;
        const broadcastRef = db.doc(`${tenantPath}/broadcasts/${broadcastId}`);
        const snap = await broadcastRef.get();
        if (!snap.exists) {
            return NextResponse.json({ error: "Broadcast not found" }, { status: 404 });
        }

        let broadcast: any = snap.data();
        if (broadcast.status === "Sending") {
            return NextResponse.json(
                { error: "La campaña ya se está enviando." },
                { status: 409 }
            );
        }
        if (broadcast.status === "Completed") {
            return NextResponse.json(
                { error: "La campaña ya fue completada." },
                { status: 409 }
            );
        }

        let message = broadcast.message || { kind: "text", text: "" };

        const { ensureBroadcastTemplateBody } = await import("@/lib/broadcast/ensureBroadcastTemplateBody");
        const ensured = await ensureBroadcastTemplateBody({
            db,
            tenantPath,
            broadcastId,
            broadcast,
            userId,
            entityId,
        });
        if (ensured.updated) {
            message = ensured.message;
            broadcast = { ...broadcast, message };
        }

        // Mark as sending.
        await broadcastRef.update({
            status: "Sending",
            launchedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Load pending / failed recipients.
        const recSnap = await db
            .collection(`${tenantPath}/broadcasts/${broadcastId}/recipients`)
            .get();
        const recipients = recSnap.docs
            .map((d) => ({ ref: d.ref, ...(d.data() as any) }))
            .filter((r) => r.status === "pending" || r.status === "failed");

        const { sendWhatsAppMessage } = await import("@/lib/sendProviders");

        // MULTI-NUMBER: send from the number the user explicitly picked when configuring the
        // campaign (broadcast.senderSlot / senderPhoneNumberId). If the campaign has NO explicit
        // choice, we DO NOT change anything — it sends from the default number and the attached
        // bot is left exactly as it was configured (no re-binding).
        let broadcastFromPhoneId: string | undefined;
        let broadcastSlot: string | undefined = broadcast.senderSlot || undefined;
        try {
            if (broadcast.senderPhoneNumberId) {
                broadcastFromPhoneId = String(broadcast.senderPhoneNumberId);
            }
            if (!broadcastFromPhoneId && broadcastSlot) {
                // Only resolve a number when the user explicitly chose a slot for this campaign.
                const slotSnap = await db.doc(`${tenantPath}/whatsapp_numbers/${broadcastSlot}`).get();
                const slotData = slotSnap.data();
                const slotPhoneId = slotData?.phoneNumberId || slotData?.phone_number_id;
                if (slotPhoneId && slotData?.status !== "Disconnected") {
                    broadcastFromPhoneId = String(slotPhoneId);
                }
            }
            if (broadcastFromPhoneId) {
                // Register so the inbound webhook resolves this number to the tenant (index-free).
                await registerWhatsAppTenantMapping(broadcastFromPhoneId, userId, entityId).catch(() => {});
                console.log(`[Broadcast] 📤 Sending from number ${broadcastFromPhoneId} (slot: ${broadcastSlot || "n/a"})`);
            }
        } catch (e) {
            console.warn("[Broadcast] Broadcast number resolution skipped:", e);
        }

        const delay = delayForSpeed(broadcast.deliverySpeed);
        let sent = 0;
        let failed = 0;

        for (let i = 0; i < recipients.length; i++) {
            const r = recipients[i];
            try {
                let text = "";
                let type = "text";
                let template: any = undefined;
                let url: string | undefined = undefined;
                let filename: string | undefined = undefined;

                if (message.kind === "template") {
                    type = "template";
                    const vars: string[] = message.templateVariables || [];
                    const params = vars.map((v: string) => ({
                        type: "text",
                        text: resolveTokens(message.templateParamValues?.[v] || "", r),
                    }));
                    template = {
                        name: message.templateName,
                        language: { code: message.templateLanguage || "es" },
                        components: params.length ? [{ type: "body", parameters: params }] : [],
                    };
                    const { resolveBroadcastRecipientText } = await import(
                        "@/app/nucleo/[entityId]/cmo/broadcast/list/lib/resolveBroadcastMessageText"
                    );
                    text = resolveBroadcastRecipientText(
                        { id: broadcastId, ...broadcast, message } as any,
                        { id: r.id, ...r, status: r.status || "pending" } as any
                    );
                } else if (message.kind === "media") {
                    type = message.mediaType || "image";
                    url = message.mediaUrl;
                    filename = message.filename;
                    text = resolveTokens(message.caption || "", r);
                } else {
                    type = "text";
                    text = resolveTokens(message.text || "", r);
                }

                const resp: any = await sendWhatsAppMessage(r.phone, text, {
                    type: type as any,
                    template,
                    url,
                    filename,
                    userId,
                    entityId,
                    ...(broadcastFromPhoneId ? { fromPhoneNumberId: broadcastFromPhoneId } : {}),
                });

                const messageId = resp?.messages?.[0]?.id || null;
                await r.ref.update({
                    status: "sent",
                    messageId,
                    error: null,
                    sentAt: admin.firestore.FieldValue.serverTimestamp(),
                    sentText: text,
                });

                // Log outbound message into conversation history (visible in chat).
                try {
                    const { isBroadcastTemplatePlaceholder } = await import(
                        "@/app/nucleo/[entityId]/cmo/broadcast/list/lib/resolveBroadcastMessageText"
                    );
                    if (text && !isBroadcastTemplatePlaceholder(text)) {
                        const { logBroadcastMessageToConversation } = await import(
                            "@/lib/broadcast/logBroadcastToConversationAdmin"
                        );
                        await logBroadcastMessageToConversation({
                            db,
                            tenantPath,
                            userId,
                            entityId,
                            phone: r.phone,
                            text,
                            broadcastId,
                            broadcastName: broadcast.name,
                            messageId,
                            mediaUrl: url,
                            mediaType: type !== "text" && type !== "template" ? type : undefined,
                            filename,
                        });
                    } else {
                        console.warn(
                            `[Broadcast] Conversation log skipped for ${r.phone}: unresolved template text`
                        );
                    }
                } catch (logErr) {
                    console.warn("[Broadcast] Conversation log skipped:", logErr);
                }

                // Lightweight reverse indexes so the inbound webhook can track
                // delivered/read (by messageId) and replies (by phone digits).
                const replyKeys = (await import("@/lib/phoneUtils")).phoneReplyIndexKeys(r.phone);
                if (replyKeys.length > 0) {
                    await Promise.all(
                        replyKeys.map((key) =>
                            db
                                .doc(`${tenantPath}/broadcast_reply_index/${key}`)
                                .set({
                                    broadcastId,
                                    recipientId: r.id,
                                    sentAt: admin.firestore.FieldValue.serverTimestamp(),
                                })
                                .catch(() => {})
                        )
                    );
                }
                if (messageId) {
                    await db
                        .doc(`${tenantPath}/broadcast_msg_index/${messageId}`)
                        .set({ broadcastId, recipientId: r.id })
                        .catch(() => {});
                }
                sent++;
            } catch (err: any) {
                const errMsg =
                    err?.response?.data?.error?.message ||
                    err?.message ||
                    "Error desconocido";
                await r.ref.update({
                    status: "failed",
                    error: String(errMsg).slice(0, 500),
                });
                failed++;
            }

            // Live progress every few recipients.
            if (i % 3 === 0 || i === recipients.length - 1) {
                await broadcastRef.update({
                    "stats.sent": sent,
                    "stats.failed": failed,
                    "stats.pending": Math.max(0, recipients.length - sent - failed),
                });
            }

            if (i < recipients.length - 1) await sleep(delay);
        }

        // Activate attached bot on the campaign's phone number (exclusive per phone_number_id).
        if (broadcast.botId && broadcastFromPhoneId) {
            try {
                const botsSnap = await db.collection(`${tenantPath}/chatbots`).get();
                const targetPhone = String(broadcastFromPhoneId).trim();
                const batch = db.batch();
                for (const botDoc of botsSnap.docs) {
                    const data = botDoc.data() || {};
                    const botPhone = String(data.phoneNumberId || '').trim();
                    if (botDoc.id === broadcast.botId) {
                        batch.set(
                            botDoc.ref,
                            {
                                isActive: true,
                                phoneNumberId: targetPhone,
                                targetPlatforms: ['whatsapp'],
                                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                            },
                            { merge: true }
                        );
                    } else if (
                        (data.isActive === true || data.isActive === 'true') &&
                        botPhone === targetPhone
                    ) {
                        batch.set(
                            botDoc.ref,
                            {
                                isActive: false,
                                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                            },
                            { merge: true }
                        );
                    }
                }
                await batch.commit();
            } catch (e) {
                console.error("[Broadcast] Failed to activate bot:", e);
            }
        }

        const finalStatus = sent === 0 && failed > 0 ? "Failed" : "Completed";
        await broadcastRef.update({
            status: finalStatus,
            "stats.sent": sent,
            "stats.failed": failed,
            "stats.pending": Math.max(0, recipients.length - sent - failed),
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        try {
            const { backfillBroadcastConversations } = await import(
                "@/lib/broadcast/backfillBroadcastConversations"
            );
            await backfillBroadcastConversations({ db, userId, entityId, broadcastId });
        } catch (backfillErr) {
            console.warn("[Broadcast] Post-send conversation backfill skipped:", backfillErr);
        }

        return NextResponse.json({
            success: true,
            status: finalStatus,
            sent,
            failed,
            total: recipients.length,
        });
    } catch (error: any) {
        console.error("[Broadcast Send] ❌", error);
        return NextResponse.json(
            { error: error.message || "Internal error" },
            { status: 500 }
        );
    }
}
