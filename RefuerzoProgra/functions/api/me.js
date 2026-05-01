/**
 * GET /api/me
 * Returns the authenticated user email read from the signed session cookie.
 * Falls back to env.DEV_EMAIL only in local dev (.dev.vars).
 * Responds 401 when there is no valid session — the frontend redirects to /login.html.
 */
import { readSession } from '../_lib/session.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  let email = await readSession(request, env.SESSION_SECRET);
  if (!email && env.DEV_EMAIL) email = env.DEV_EMAIL;

  if (!email) {
    return Response.json({ email: null }, { status: 401 });
  }
  return Response.json({ email });
}
