/**
 * GET /api/me
 * Returns the authenticated user's email injected by Cloudflare Zero Trust.
 * The header Cf-Access-Authenticated-User-Email is set by Cloudflare Access
 * and cannot be spoofed by the client.
 */
export async function onRequestGet(context) {
  const email =
    context.request.headers.get('Cf-Access-Authenticated-User-Email') ??
    context.env.DEV_EMAIL ??   // solo existe si está en .dev.vars (local)
    null;
  return Response.json({ email });
}
