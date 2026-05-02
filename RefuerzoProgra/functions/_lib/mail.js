/**
 * mail.js — Sends transactional emails via Resend (free tier: 3,000/mo).
 *
 * In local dev (isDev=true) we log to console instead of hitting the API,
 * so you don't need a real RESEND_API_KEY to develop.
 *
 * Production requires:
 *   - RESEND_API_KEY  (secret in Pages dashboard)
 *   - MAIL_FROM       (e.g. noreply@spotdoggames.com — domain must be verified in Resend)
 *   - MAIL_FROM_NAME  (display name shown in inbox)
 */

const RESEND_URL = 'https://api.resend.com/emails';

// ─── Send ───────────────────────────────────────────────────────────────────

/**
 * Sends an email. Returns { ok: boolean, devLog?: string }.
 * In dev mode (isDev=true) it logs to console and returns ok=true without sending.
 */
export async function sendMail({ to, subject, html, text, from, fromName, apiKey, isDev = false }) {
  if (isDev) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`[DEV MAIL] To:      ${to}`);
    console.log(`[DEV MAIL] From:    ${fromName} <${from}>`);
    console.log(`[DEV MAIL] Subject: ${subject}`);
    console.log('[DEV MAIL] Body:');
    console.log(text || stripHtml(html));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return { ok: true, devLog: text || html };
  }

  if (!apiKey) {
    console.error('[Resend] Missing RESEND_API_KEY');
    return { ok: false };
  }

  const res = await fetch(RESEND_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      from:    `${fromName} <${from}>`,
      to:      [to],
      subject,
      text:    text || stripHtml(html),
      html:    html || `<p>${text}</p>`,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`[Resend] ${res.status}: ${body}`);
    return { ok: false };
  }
  return { ok: true };
}

function stripHtml(s) {
  return (s || '').replace(/<[^>]*>/g, '').replace(/\s+\n/g, '\n').trim();
}

// ─── Templates ──────────────────────────────────────────────────────────────

/** Magic-link email sent to the student. */
export function magicLinkEmail({ link, ttlMinutes }) {
  const subject = '🎮 Tu acceso a Refuerzo de Programación';
  const text = `Hola,

Para entrar al curso, abre este enlace (válido por ${ttlMinutes} minutos):

${link}

Si no solicitaste este acceso, ignora este correo.`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:1.5rem;color:#2c3e50">
      <h2 style="color:#16213e;margin:0 0 1rem">🎮 Refuerzo de Programación</h2>
      <p>Da click en el botón para entrar al curso:</p>
      <p style="margin:1.5rem 0">
        <a href="${link}" style="background:#16a085;color:#fff;padding:0.85rem 1.75rem;text-decoration:none;border-radius:6px;display:inline-block;font-weight:600">
          Entrar al curso →
        </a>
      </p>
      <p style="color:#666;font-size:0.9rem">
        Este enlace expira en <strong>${ttlMinutes} minutos</strong> y solo puede usarse una vez.
        Si no solicitaste este acceso, ignora este correo.
      </p>
      <p style="color:#999;font-size:0.8rem;word-break:break-all;border-top:1px solid #eee;padding-top:1rem;margin-top:1.5rem">
        ¿No funciona el botón? Copia esta URL en tu navegador:<br>${link}
      </p>
    </div>`;
  return { subject, text, html };
}

/** Notification sent to ADMIN_EMAIL when a payment is confirmed. */
export function paymentNotificationEmail({ email, amount, sessionId }) {
  const subject = `[Refuerzo Progra] Nuevo pago: ${email}`;
  const when = new Date().toISOString();
  const text = `Nuevo pago confirmado.

Alumno:     ${email}
Monto:      ${amount} MXN
Stripe:     ${sessionId}
Fecha:      ${when}

Acceso desbloqueado automáticamente. Magic link enviado al alumno.`;
  const html = `
    <div style="font-family:system-ui,sans-serif">
      <h3 style="margin:0 0 1rem">💰 Nuevo pago confirmado</h3>
      <table style="border-collapse:collapse">
        <tr><td style="padding:4px 12px 4px 0"><strong>Alumno:</strong></td><td>${email}</td></tr>
        <tr><td style="padding:4px 12px 4px 0"><strong>Monto:</strong></td><td>${amount} MXN</td></tr>
        <tr><td style="padding:4px 12px 4px 0"><strong>Stripe session:</strong></td><td><code>${sessionId}</code></td></tr>
        <tr><td style="padding:4px 12px 4px 0"><strong>Fecha:</strong></td><td>${when}</td></tr>
      </table>
      <p style="color:#16a085;margin-top:1rem">Acceso desbloqueado automáticamente. Magic link enviado al alumno.</p>
    </div>`;
  return { subject, text, html };
}
