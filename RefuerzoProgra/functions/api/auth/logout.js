/**
 * POST /api/auth/logout — Clears the session cookie.
 */
import { buildClearCookie } from '../../_lib/session.js';

export async function onRequestPost(context) {
  const isLocal = /^(localhost|127\.0\.0\.1)$/i.test(new URL(context.request.url).hostname);
  const isDev   = !!context.env.DEV_EMAIL || isLocal;
  const cookie  = buildClearCookie({ secure: !isDev });
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Set-Cookie':   cookie,
      'Content-Type': 'application/json',
    },
  });
}
