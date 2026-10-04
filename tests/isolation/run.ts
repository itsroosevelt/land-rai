/**
 * Pruebas de aislamiento multi-tenant. Corren SOLO contra el emulador de Firestore (nunca producción).
 *   npm run test:isolation
 * Dos clientes falsos (A y B) con integraciones propias: ningún evento/credencial de uno debe tocar al otro.
 */
import crypto from 'crypto';
import axios from 'axios';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
    console.error('ABORTADO: FIRESTORE_EMULATOR_HOST no está definido. Estas pruebas solo corren contra el emulador.');
    process.exit(2);
}
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'demo-roosevelt-test';
process.env.GCLOUD_PROJECT = 'demo-roosevelt-test';
process.env.META_APP_SECRET = 'test_meta_secret';
process.env.TWITTER_CONSUMER_SECRET = 'test_x_secret';
process.env.GMAIL_CLIENT_SECRET = 'test_gmail_secret';
process.env.WEBHOOK_SIGNATURE_MODE = 'enforce';
process.env.WHATSAPP_ACCESS_TOKEN = 'EAA_PLATFORM_OWNER_TOKEN'; // el dueño de la plataforma: NUNCA debe usarse para un cliente
process.env.WHATSAPP_PHONE_NUMBER_ID = 'PHONE_PLATFORM_OWNER';

// ---- Sin red real: todo lo saliente se registra y se simula ----
const outbound: { url: string; auth: string }[] = [];
(globalThis as any).fetch = async (url: any, init: any = {}) => {
    outbound.push({ url: String(url), auth: JSON.stringify(init?.headers || {}) + String(url) });
    return new Response(JSON.stringify({ ok: true, result: {} }), { status: 200, headers: { 'content-type': 'application/json' } });
};
axios.defaults.adapter = async (config: any) => {
    outbound.push({ url: String(config.url), auth: JSON.stringify(config.headers || {}) + JSON.stringify(config.params || {}) + String(config.url) });
    return { data: { messages: [{ id: 'wamid.TEST' }], data: [] }, status: 200, statusText: 'OK', headers: {}, config } as any;
};

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = '') {
    if (ok) { passed++; console.log(`  ✅ ${name}`); }
    else { failures.push(name); console.log(`  ❌ ${name} ${detail}`); }
}

const A = { uid: 'uidAAAAAAAAAAAA', ent: 'entA' };
const B = { uid: 'uidBBBBBBBBBBBB', ent: 'entB' };
const C = { uid: 'uidCCCCCCCCCCCC', ent: 'entC' }; // cliente sin credenciales
const D = { uid: 'uidDDDDDDDDDDDD', ent: 'entD' }; // intenta secuestrar la página de A
const E = { uid: 'uidEEEEEEEEEEEE', ent: 'entE' }; // reclama los mismos ids que D (conflicto)
const path = (t: { uid: string; ent: string }) => `users/${t.uid}/entities/${t.ent}`;

async function listTree(db: FirebaseFirestore.Firestore, docPath: string, out: Set<string> = new Set()) {
    const ref = db.doc(docPath);
    for (const col of await ref.listCollections()) {
        for (const d of await col.listDocuments()) {
            out.add(d.path);
            await listTree(db, d.path, out);
        }
    }
    return out;
}
const sign = (body: string, secret = 'test_meta_secret') => 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');

async function main() {
    const { db } = await import('../../src/lib/firebase-admin');

    // ---------- Datos sembrados ----------
    for (const t of [A, B, C, D, E]) await db.doc(path(t)).set({ name: t.ent, type: 'empresa' });
    const seed = (t: any, id: string, data: any) => db.doc(`${path(t)}/integrations/${id}`).set({ status: 'Connected', ...data });
    await seed(A, 'messenger', { provider: 'messenger', pageId: 'PAGE_A', accessToken: 'EAA_TOKEN_A', pageAccessToken: 'EAA_TOKEN_A' });
    await seed(B, 'messenger', { provider: 'messenger', pageId: 'PAGE_B', accessToken: 'EAA_TOKEN_B', pageAccessToken: 'EAA_TOKEN_B' });
    await seed(A, 'whatsapp', { phoneNumberId: 'PHONE_A', accessToken: 'EAA_WA_A', wabaId: 'WABA_A' });
    await seed(B, 'whatsapp', { phoneNumberId: 'PHONE_B', accessToken: 'EAA_WA_B', wabaId: 'WABA_B' });
    await seed(A, 'x_twitter', { provider: 'x_twitter', twitterUserId: 'XA', twitterHandle: 'cuenta_a' });
    await seed(B, 'x_twitter', { provider: 'x_twitter', twitterUserId: 'XB', twitterHandle: 'cuenta_b' });
    await seed(A, 'telegram', { provider: 'telegram', botToken: '111:AAA' });
    await db.doc(`${path(A)}/integrations/telegram_internal`).set({ webhookSecret: 'secretA' });
    // D reclama la misma página que A (ataque de secuestro)
    await seed(D, 'messenger', { provider: 'messenger', pageId: 'PAGE_A', accessToken: 'EAA_TOKEN_D', pageAccessToken: 'EAA_TOKEN_D' });

    // D y E reclaman el mismo número de WhatsApp, cuenta de X y correo de Gmail
    for (const t of [D, E]) {
        await seed(t, 'whatsapp', { phoneNumberId: 'PHONE_SHARED', accessToken: 'EAA_WA_' + t.ent });
        await seed(t, 'x_twitter', { provider: 'x_twitter', twitterUserId: 'XSHARED', twitterHandle: 'compartida' });
        await db.doc(`${path(t)}/integrations/gmail/accounts/shared_x_com`).set({ gmailAddress: 'shared@x.com', email: 'shared@x.com', status: 'Connected' });
    }

    // =====================================================================
    console.log('\n1) Reglas de Firestore (cliente web)');
    const env = await initializeTestEnvironment({
        projectId: 'demo-roosevelt-test',
        firestore: { rules: readFileSync((process.env.ROOT_DIR || '.') + '/firestore.rules', 'utf8'), host: process.env.FIRESTORE_EMULATOR_HOST!.split(':')[0], port: Number(process.env.FIRESTORE_EMULATOR_HOST!.split(':')[1]) },
    });
    await env.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().doc(`${path(B)}/integrations/messenger`).set({ pageAccessToken: 'EAA_TOKEN_B', pageId: 'PAGE_B' });
        await ctx.firestore().doc(`${path(A)}/integrations/messenger`).set({ pageAccessToken: 'EAA_TOKEN_A', pageId: 'PAGE_A' });
    });
    const asA = env.authenticatedContext(A.uid).firestore();
    const anon = env.unauthenticatedContext().firestore();
    await assertSucceeds(asA.doc(`${path(A)}/integrations/messenger`).get());
    check('A lee sus propias integraciones', true);
    await assertSucceeds(asA.doc(`${path(A)}/integrations/messenger`).set({ pageId: 'PAGE_A', pageAccessToken: 'EAA_TOKEN_A' }));
    check('A escribe sus propias integraciones', true);
    check('A NO lee integraciones de B', await assertFails(asA.doc(`${path(B)}/integrations/messenger`).get()).then(() => true, () => false));
    check('A NO escribe en integraciones de B', await assertFails(asA.doc(`${path(B)}/integrations/messenger`).set({ pageId: 'X' })).then(() => true, () => false));
    check('A NO crea entidades bajo el uid de B', await assertFails(asA.doc(`users/${B.uid}/entities/nueva`).set({ a: 1 })).then(() => true, () => false));
    check('A NO consulta collectionGroup(integrations)', await assertFails(asA.collectionGroup('integrations').get()).then(() => true, () => false));
    check('A NO consulta collectionGroup(cards) de todos', await assertFails(asA.collectionGroup('cards').get()).then(() => true, () => false));
    check('A NO crea colecciones raíz', await assertFails(asA.doc('mi_coleccion/doc1').set({ a: 1 })).then(() => true, () => false));
    check('A NO lee system_mappings', await assertFails(asA.doc('system_mappings/whatsapp_numbers/numbers/PHONE_B').get()).then(() => true, () => false));
    check('Sin sesión NO lee nada', await assertFails(anon.doc(`${path(A)}/integrations/messenger`).get()).then(() => true, () => false));
    await env.cleanup();

    // =====================================================================
    console.log('\n2) Webhook de Meta (Messenger/Instagram)');
    const metaRoute = await import('../../src/app/api/meta/webhook/route');
    const metaBody = (pageId: string, text: string) => JSON.stringify({
        object: 'page',
        entry: [{ id: pageId, time: Date.now(), messaging: [{ sender: { id: 'CLIENTE_1' }, recipient: { id: pageId }, timestamp: Date.now(), message: { mid: 'm_' + crypto.randomUUID(), text } }] }],
    });
    const postMeta = (raw: string, sig?: string) => metaRoute.POST(new Request('http://localhost/api/meta/webhook', { method: 'POST', headers: { 'content-type': 'application/json', ...(sig ? { 'x-hub-signature-256': sig } : {}) }, body: raw }));

    let beforeA = await listTree(db, path(A)), beforeB = await listTree(db, path(B));
    let raw = metaBody('PAGE_B', 'hola B');
    let res = await postMeta(raw, 'sha256=' + '0'.repeat(64));
    check('Firma falsa → 401', res.status === 401);
    res = await postMeta(raw);
    check('Sin firma → 401', res.status === 401);
    check('Firma falsa no escribió nada en B', (await listTree(db, path(B))).size === beforeB.size);

    res = await postMeta(raw, sign(raw));
    check('Firma válida para página de B → 200', res.status === 200, `status=${res.status}`);
    const afterB = await listTree(db, path(B)), afterA = await listTree(db, path(A));
    check('El mensaje de PAGE_B llegó a la entidad B', afterB.size > beforeB.size, `antes=${beforeB.size} después=${afterB.size}`);
    check('El mensaje de PAGE_B NO tocó la entidad A', afterA.size === beforeA.size);

    // Secuestro: D reclama PAGE_A (igual que A). Nadie debe recibirlo.
    const beforeD = await listTree(db, path(D)); beforeA = await listTree(db, path(A));
    raw = metaBody('PAGE_A', 'mensaje de un cliente real de A');
    res = await postMeta(raw, sign(raw));
    const j: any = await res.json().catch(() => ({}));
    check('Página reclamada por dos usuarios → ignorada (ambiguous_tenant)', j.ignored === 'ambiguous_tenant', JSON.stringify(j));
    check('El atacante D NO recibió el mensaje', (await listTree(db, path(D))).size === beforeD.size);
    check('La víctima A tampoco recibe (conflicto bloqueado)', (await listTree(db, path(A))).size === beforeA.size);

    // =====================================================================
    console.log('\n3) Webhook de WhatsApp');
    const waRoute = await import('../../src/app/api/whatsapp/webhook/route');
    const waBody = (phoneId: string, text: string) => JSON.stringify({
        object: 'whatsapp_business_account',
        entry: [{ id: 'WABA', changes: [{ field: 'messages', value: { messaging_product: 'whatsapp', metadata: { display_phone_number: '1555', phone_number_id: phoneId },
            contacts: [{ profile: { name: 'Cliente' }, wa_id: '5215550001' }], messages: [{ from: '5215550001', id: 'wamid.' + crypto.randomUUID(), timestamp: String(Math.floor(Date.now() / 1000)), type: 'text', text: { body: text } }] } }] }],
    });
    const postWa = (raw: string, sig?: string) => waRoute.POST(new Request('http://localhost/api/whatsapp/webhook', { method: 'POST', headers: { 'content-type': 'application/json', ...(sig ? { 'x-hub-signature-256': sig } : {}) }, body: raw }));
    beforeA = await listTree(db, path(A)); beforeB = await listTree(db, path(B));
    raw = waBody('PHONE_A', 'hola A por whatsapp');
    res = await postWa(raw, 'sha256=' + 'f'.repeat(64));
    check('WhatsApp con firma falsa → 401', res.status === 401);
    res = await postWa(raw, sign(raw));
    check('WhatsApp con firma válida → 200', res.status === 200, `status=${res.status}`);
    check('Mensaje de PHONE_A llegó a A', (await listTree(db, path(A))).size > beforeA.size);
    check('Mensaje de PHONE_A NO tocó a B', (await listTree(db, path(B))).size === beforeB.size);
    const unmapped = waBody('PHONE_NADIE', 'huérfano');
    res = await postWa(unmapped, sign(unmapped));
    check('Número no mapeado → ignorado, sin caer en otro tenant', ((await res.json()) as any).ignored === 'tenant_not_mapped');

    // =====================================================================
    console.log('\n4) Envío de WhatsApp: credenciales solo del cliente');
    const { sendWhatsAppMessage } = await import('../../src/lib/sendProviders');
    outbound.length = 0;
    let threw = false;
    try { await sendWhatsAppMessage('5215550009', 'hola', { userId: C.uid, entityId: C.ent }); } catch { threw = true; }
    check('Cliente SIN credenciales → error (no usa el token del dueño)', threw);
    check('Nada salió hacia Meta con el token de la plataforma', !outbound.some((o) => o.auth.includes('EAA_PLATFORM_OWNER_TOKEN') || o.auth.includes('PHONE_PLATFORM_OWNER')));
    outbound.length = 0;
    await sendWhatsAppMessage('5215550009', 'hola', { userId: B.uid, entityId: B.ent });
    check('Cliente B envía con SU token y SU número', outbound.some((o) => o.auth.includes('EAA_WA_B') && o.url.includes('PHONE_B')));
    check('B nunca usa el token de A ni el de la plataforma', !outbound.some((o) => o.auth.includes('EAA_WA_A') || o.auth.includes('EAA_PLATFORM_OWNER_TOKEN')));

    // =====================================================================
    console.log('\n5) X / Twitter: resolución de tenant');
    const { resolveTwitterTenant } = await import('../../src/lib/xWebhookHelpers');
    check('for_user_id de A → entidad A', (await resolveTwitterTenant({ for_user_id: 'XA' }))?.entityId === A.ent);
    check('for_user_id de B → entidad B', (await resolveTwitterTenant({ for_user_id: 'XB' }))?.entityId === B.ent);
    check('Id desconocido → null (sin fallback a otro tenant)', (await resolveTwitterTenant({ for_user_id: 'XNADIE' })) === null);
    check('Sin handle ni id coincidente → null (no matchea undefined===undefined)', (await resolveTwitterTenant({ for_user_id: 'XNADIE', user: {} })) === null);
    const twRoute = await import('../../src/app/api/twitter/webhook/route');
    const twRaw = JSON.stringify({ for_user_id: 'XA', tweet_create_events: [] });
    res = await twRoute.POST(new Request('http://localhost/api/twitter/webhook', { method: 'POST', headers: { 'x-twitter-webhooks-signature': 'sha256=falsa' }, body: twRaw }));
    check('X con firma falsa → 401', res.status === 401);

    // =====================================================================
    console.log('\n6) Telegram');
    const tgRoute = await import('../../src/app/api/telegram/webhook/route');
    const tgBody = JSON.stringify({ update_id: 1, message: { message_id: 7, chat: { id: 99001, type: 'private' }, from: { id: 99001, first_name: 'Tg' }, text: 'hola bot' } });
    const postTg = (u: string, e: string, secret?: string) => tgRoute.POST(new Request(`http://localhost/api/telegram/webhook?u=${u}&e=${e}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(secret ? { 'x-telegram-bot-api-secret-token': secret } : {}) }, body: tgBody }));
    beforeA = await listTree(db, path(A));
    res = await postTg(A.uid, A.ent, 'incorrecto');
    check('Telegram con secret incorrecto → 401', res.status === 401);
    res = await postTg(A.uid, A.ent);
    check('Telegram sin secret → 401', res.status === 401);
    check('Rechazados no escribieron nada', (await listTree(db, path(A))).size === beforeA.size);
    beforeB = await listTree(db, path(B));
    res = await postTg(A.uid, A.ent, 'secretA');
    check('Telegram con el secret de A → 200', res.status === 200, `status=${res.status}`);
    check('Telegram de A creó datos en A', (await listTree(db, path(A))).size > beforeA.size);
    check('Telegram de A NO tocó a B', (await listTree(db, path(B))).size === beforeB.size);

    // =====================================================================
    console.log('\n7) OAuth state de Gmail');
    const gmailCb = await import('../../src/app/api/gmail/callback/route');
    const forged = Buffer.from(JSON.stringify({ userId: B.uid, entityId: B.ent })).toString('base64');
    res = await gmailCb.GET(new Request(`http://localhost/api/gmail/callback?code=abc&state=${encodeURIComponent(forged)}`));
    check('State forjado (sin firma) → 400', res.status === 400);
    const { signOAuthState } = await import('../../src/lib/oauthState');
    const forged2 = signOAuthState({ userId: A.uid, entityId: A.ent }).split('.')[0] + '.' + 'x'.repeat(43);
    res = await gmailCb.GET(new Request(`http://localhost/api/gmail/callback?code=abc&state=${encodeURIComponent(forged2)}`));
    check('State con firma inválida → 400', res.status === 400);

    // =====================================================================
    console.log('\n8) Anti-secuestro: el mismo id reclamado por dos usuarios no se entrega a nadie');
    const beforeDE = (await listTree(db, path(D))).size + (await listTree(db, path(E))).size;
    raw = waBody('PHONE_SHARED', 'mensaje para un número disputado');
    res = await postWa(raw, sign(raw));
    check('WhatsApp: número reclamado por D y E → ignorado', ((await res.json()) as any).ignored === 'tenant_not_mapped');
    check('X: cuenta reclamada por D y E → null', (await resolveTwitterTenant({ for_user_id: 'XSHARED' })) === null);
    const gmailRoute = await import('../../src/app/api/gmail/webhook/route');
    const pubsub = (email: string) => JSON.stringify({ message: { data: Buffer.from(JSON.stringify({ emailAddress: email, historyId: '1' })).toString('base64') } });
    res = await gmailRoute.POST(new Request('http://localhost/api/gmail/webhook', { method: 'POST', body: pubsub('shared@x.com') }));
    check('Gmail sin token de Pub/Sub (enforce) → 401', res.status === 401);
    process.env.WEBHOOK_SIGNATURE_MODE = 'log'; // solo para ejercitar la resolución de tenant
    res = await gmailRoute.POST(new Request('http://localhost/api/gmail/webhook', { method: 'POST', body: pubsub('shared@x.com') }));
    check('Gmail: correo reclamado por D y E → ignorado', ((await res.json()) as any).ignored === 'ambiguous_tenant');
    process.env.WEBHOOK_SIGNATURE_MODE = 'enforce';
    check('Ni D ni E recibieron nada', (await listTree(db, path(D))).size + (await listTree(db, path(E))).size === beforeDE);

    // =====================================================================
    console.log(`\nResultado: ${passed} OK, ${failures.length} fallos`);
    if (failures.length) { console.log('Fallos:\n - ' + failures.join('\n - ')); process.exit(1); }
    process.exit(0);
}
main().catch((e) => { console.error('Error en la suite:', e); process.exit(1); });
