/**
 * GET  /api/progress  — loads the user's progress blob from D1
 * PUT  /api/progress  — saves the user's progress blob to D1
 *
 * The user email comes from the signed session cookie; DEV_EMAIL is used in
 * local dev only. Binding "DB" must be a D1 database configured in wrangler.toml
 * / Pages settings.
 */
import { readSession } from '../_lib/session.js';

async function getEmail(context) {
  const fromCookie = await readSession(context.request, context.env.SESSION_SECRET);
  return fromCookie ?? context.env.DEV_EMAIL ?? null;
}

export async function onRequestGet(context) {
  const email = await getEmail(context);
  if (!email) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const row = await context.env.DB
    .prepare('SELECT data FROM user_progress WHERE email = ?')
    .bind(email)
    .first();

  return Response.json(row ? JSON.parse(row.data) : {});
}

export async function onRequestPut(context) {
  const email = await getEmail(context);
  if (!email) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const now = new Date().toISOString();

  await context.env.DB.prepare(`
    INSERT INTO user_progress (email, data, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(email) DO UPDATE SET
      data       = excluded.data,
      updated_at = excluded.updated_at
  `).bind(email, JSON.stringify(body), now).run();

  return Response.json({ ok: true });
}
