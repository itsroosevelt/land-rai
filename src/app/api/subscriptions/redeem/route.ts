import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { guardApi } from '@/lib/apiAuth';
import { getSubscriptionCurrentDocPath } from '@/lib/subscriptions/payment-config';
import { normalizePlan, type PlanId } from '@/lib/subscriptions/plans';

export const dynamic = 'force-dynamic';

/**
 * Canje de códigos de acceso, validado en el servidor.
 * SUBSCRIPTION_ACCESS_CODES = "CODIGO1:pro,CODIGO2:enterprise"   (el plan que otorga cada código).
 * Sin esa variable el canje queda deshabilitado. Los códigos nunca viajan al navegador.
 */
const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MS = 60 * 60 * 1000;

function parseCodes(): Array<{ code: string; plan: PlanId }> {
    return (process.env.SUBSCRIPTION_ACCESS_CODES || '')
        .split(',')
        .map((pair) => pair.trim())
        .filter(Boolean)
        .map((pair) => {
            const i = pair.lastIndexOf(':');
            const plan = normalizePlan(i > 0 ? pair.slice(i + 1) : 'pro');
            return plan ? { code: i > 0 ? pair.slice(0, i) : pair, plan } : null;
        })
        .filter((x): x is { code: string; plan: PlanId } => !!x);
}

const safeEqual = (a: string, b: string) => {
    const ha = crypto.createHash('sha256').update(a).digest();
    const hb = crypto.createHash('sha256').update(b).digest();
    return crypto.timingSafeEqual(ha, hb);
};

export async function POST(req: Request) {
    const denied = await guardApi(req);
    if (denied) return denied;

    try {
        const { userId, entityId, code } = await req.json();
        if (!userId || !entityId || typeof code !== 'string' || !code.trim()) {
            return NextResponse.json({ ok: false, message: 'Faltan datos.' }, { status: 400 });
        }

        const codes = parseCodes();
        if (codes.length === 0) {
            return NextResponse.json({ ok: false, message: 'El canje de códigos no está habilitado.' }, { status: 503 });
        }

        // Límite de intentos fallidos por usuario (documento solo-servidor).
        const attemptsRef = db.doc(`users/${userId}/entities/${entityId}/subscriptions/redeem_attempts`);
        const attempts = (await attemptsRef.get()).data();
        const recent = ((attempts?.failedAt as number[] | undefined) || []).filter((t) => Date.now() - t < WINDOW_MS);
        if (recent.length >= MAX_FAILED_ATTEMPTS) {
            return NextResponse.json({ ok: false, message: 'Demasiados intentos. Inténtalo más tarde.' }, { status: 429 });
        }

        const match = codes.find((c) => safeEqual(c.code, code.trim()));
        if (!match) {
            await attemptsRef.set({ failedAt: [...recent, Date.now()] });
            return NextResponse.json({ ok: false, message: 'Código inválido.' }, { status: 400 });
        }

        const now = new Date();
        await db.doc(getSubscriptionCurrentDocPath(userId, entityId)).set(
            {
                status: 'active',
                plan: match.plan,
                priceUSD: 0,
                paymentMethod: 'access_code',
                activatedAt: now.toISOString(),
                expiresAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(),
                updatedAt: now.toISOString(),
                cancelAtPeriodEnd: false,
                cancelledAt: null,
            },
            { merge: true }
        );
        await attemptsRef.set({ failedAt: [] });
        return NextResponse.json({ ok: true, plan: match.plan });
    } catch (e: any) {
        console.error('[subscriptions/redeem] error:', e?.message);
        return NextResponse.json({ ok: false, message: 'No se pudo canjear el código.' }, { status: 500 });
    }
}
