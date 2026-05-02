/**
 * POST /api/auth/request   — Body: { email }
 *
 * If the email belongs to a paid user → generate a magic token, persist it,
 * email the link to the user, and respond { sent: true }.
 * Otherwise → respond { paid: false, checkoutPath: '/comprar.html' } so the
 * frontend can redirect to the purchase page.
 *
 * In dev (DEV_EMAIL set) the magic link is also returned in `devLink` and
 * printed to the wrangler console — MailChannels does not work from local IPs.
 */
import { sendMail, magicLinkEmail } from '../../_lib/mail.js';

const TTL_MIN_DEFAULT = 15;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const email = String(body?.email ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return Response.json({ error: 'Email inválido' }, { status: 400 });
  }

  const user = await env.DB
    .prepare('SELECT email, paid_at FROM users WHERE email = ?')
    .bind(email)
    .first();

  if (!user || !user.paid_at) {
    return Response.json({ paid: false, checkoutPath: '/comprar.html' });
  }

  // Create one-shot token (UUID + extra entropy → 64+ chars)
  const token     = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, '');
  const ttlMin    = Number(env.MAGIC_LINK_TTL_MINUTES || TTL_MIN_DEFAULT);
  const expiresAt = new Date(Date.now() + ttlMin * 60_000).toISOString();
  const now       = new Date().toISOString();

  await env.DB.prepare(`
    INSERT INTO magic_tokens (token, email, expires_at, created_at)
    VALUES (?, ?, ?, ?)
  `).bind(token, email, expiresAt, now).run();

  const reqUrl = new URL(request.url);
  const isDev  = !!env.DEV_EMAIL || /^(localhost|127\.0\.0\.1)$/i.test(reqUrl.hostname);
  const appUrl = env.APP_URL || reqUrl.origin;
  const link   = `${appUrl}/api/auth/verify?token=${token}`;

  const { subject, text, html } = magicLinkEmail({ link, ttlMinutes: ttlMin });
  const result = await sendMail({
    to:       email,
    subject, text, html,
    from:     env.MAIL_FROM      || 'noreply@spotdoggames.com',
    fromName: env.MAIL_FROM_NAME || 'Refuerzo Progra',
    apiKey:   env.RESEND_API_KEY,
    isDev,
  });

  return Response.json({
    sent: result.ok,
    ...(isDev ? { devLink: link } : {}),
  });
}
