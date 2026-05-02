/**
 * POST /api/stripe/webhook
 *
 * Receives Stripe webhook events. On checkout.session.completed:
 *   1. Verifies the Stripe-Signature header (replay-protected HMAC).
 *   2. Upserts the user with paid_at = now.
 *   3. Generates a magic-link token and emails it to the student.
 *   4. Sends a notification email to ADMIN_EMAIL (if configured).
 *
 * Stripe retries on 5xx, so any unexpected failure surfaces as 500 to retry.
 * Other event types are acknowledged with 200 to avoid retries.
 */
import { verifyWebhookSignature }                                 from '../../_lib/stripe.js';
import { sendMail, magicLinkEmail, paymentNotificationEmail }     from '../../_lib/mail.js';

const TTL_MIN_DEFAULT = 15;

export async function onRequestPost(context) {
  const { request, env } = context;

  // ─── Verify signature against the raw body ──────────────────────────────
  const sig     = request.headers.get('Stripe-Signature');
  const rawBody = await request.text();
  const ok      = await verifyWebhookSignature(rawBody, sig, env.STRIPE_WEBHOOK_SECRET);
  if (!ok) {
    return new Response('Invalid signature', { status: 400 });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  // We only act on completed checkouts; ack everything else
  if (event.type !== 'checkout.session.completed') {
    return Response.json({ received: true, ignored: event.type });
  }

  // ─── Extract email and amount from the session ──────────────────────────
  const session     = event.data.object;
  const email       = (session.metadata?.email || session.customer_details?.email || '')
                      .trim().toLowerCase();
  const sessionId   = session.id;
  const amountTotal = Math.round((session.amount_total || 0) / 100); // cents → MXN

  if (!email) {
    console.error('[Stripe webhook] No email on session', sessionId);
    return new Response('Missing email', { status: 400 });
  }

  // ─── Idempotent upsert into users ───────────────────────────────────────
  const existing = await env.DB
    .prepare('SELECT email, paid_at FROM users WHERE email = ?')
    .bind(email)
    .first();

  const now = new Date().toISOString();

  if (!existing) {
    await env.DB.prepare(`
      INSERT INTO users (email, paid_at, stripe_session_id, amount_mxn, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(email, now, sessionId, amountTotal, now).run();
  } else if (!existing.paid_at) {
    await env.DB.prepare(`
      UPDATE users SET paid_at = ?, stripe_session_id = ?, amount_mxn = ?
      WHERE email = ?
    `).bind(now, sessionId, amountTotal, email).run();
  }
  // else: already paid → fall through and (re)send the magic link

  // ─── Generate magic-link token ──────────────────────────────────────────
  const token     = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, '');
  const ttlMin    = Number(env.MAGIC_LINK_TTL_MINUTES || TTL_MIN_DEFAULT);
  const expiresAt = new Date(Date.now() + ttlMin * 60_000).toISOString();
  await env.DB.prepare(`
    INSERT INTO magic_tokens (token, email, expires_at, created_at)
    VALUES (?, ?, ?, ?)
  `).bind(token, email, expiresAt, now).run();

  const reqUrl  = new URL(request.url);
  const isLocal = /^(localhost|127\.0\.0\.1)$/i.test(reqUrl.hostname);
  const isDev   = !!env.DEV_EMAIL || isLocal;
  const appUrl  = env.APP_URL || reqUrl.origin;
  const link    = `${appUrl}/api/auth/verify?token=${token}`;

  // ─── Email the student ──────────────────────────────────────────────────
  const tpl = magicLinkEmail({ link, ttlMinutes: ttlMin });
  await sendMail({
    to:       email,
    subject:  tpl.subject, text: tpl.text, html: tpl.html,
    from:     env.MAIL_FROM      || 'noreply@spotdoggames.com',
    fromName: env.MAIL_FROM_NAME || 'Refuerzo Progra',
    apiKey:   env.RESEND_API_KEY,
    isDev,
  });

  // ─── Notify admin ───────────────────────────────────────────────────────
  if (env.ADMIN_EMAIL) {
    const adminTpl = paymentNotificationEmail({ email, amount: amountTotal, sessionId });
    await sendMail({
      to:       env.ADMIN_EMAIL,
      subject:  adminTpl.subject, text: adminTpl.text, html: adminTpl.html,
      from:     env.MAIL_FROM      || 'noreply@spotdoggames.com',
      fromName: env.MAIL_FROM_NAME || 'Refuerzo Progra',
      apiKey:   env.RESEND_API_KEY,
      isDev,
    });
  }

  return Response.json({ received: true });
}
