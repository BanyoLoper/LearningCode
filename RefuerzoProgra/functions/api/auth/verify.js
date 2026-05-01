/**
 * GET /api/auth/verify?token=...
 *
 * Validates a magic-link token. On success: marks it used, sets the signed
 * session cookie, and 302-redirects to `/`. On failure: responds with a
 * minimal HTML error page that links back to /login.html.
 */
import { buildSessionCookie } from '../../_lib/session.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const url   = new URL(request.url);
  const token = url.searchParams.get('token');
  if (!token) return htmlError('Token faltante', 'No se recibió un token de acceso.');

  const row = await env.DB
    .prepare('SELECT email, expires_at, used_at FROM magic_tokens WHERE token = ?')
    .bind(token)
    .first();

  if (!row)         return htmlError('Enlace inválido', 'Este enlace no existe.');
  if (row.used_at)  return htmlError('Enlace ya usado', 'Este enlace solo puede usarse una vez. Solicita uno nuevo desde el login.');
  if (Date.now() > new Date(row.expires_at).getTime()) {
    return htmlError('Enlace expirado', 'Este enlace ya expiró. Solicita uno nuevo desde el login.');
  }

  await env.DB
    .prepare('UPDATE magic_tokens SET used_at = ? WHERE token = ?')
    .bind(new Date().toISOString(), token)
    .run();

  const isLocal = /^(localhost|127\.0\.0\.1)$/i.test(new URL(request.url).hostname);
  const isDev   = !!env.DEV_EMAIL || isLocal;
  const cookie  = await buildSessionCookie(row.email, env.SESSION_SECRET, { secure: !isDev });

  return new Response(null, {
    status: 302,
    headers: {
      'Set-Cookie': cookie,
      'Location':   '/',
    },
  });
}

function htmlError(title, msg) {
  const body = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>${title}</title>
<style>
  body{font-family:system-ui,sans-serif;background:#1a1a2e;color:#e0e0e0;
       display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
  .card{background:#16213e;padding:2.5rem;border-radius:12px;max-width:420px;text-align:center}
  h1{color:#e74c3c;margin:0 0 1rem}
  a{color:#16a085;font-weight:600}
</style></head>
<body><div class="card"><h1>${title}</h1><p>${msg}</p>
<p><a href="/login.html">← Volver al login</a></p></div></body></html>`;
  return new Response(body, {
    status:  400,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
