/**
 * POST /api/stripe/checkout   — Body: { email }
 *
 * Creates a Stripe Checkout Session and returns its hosted URL.
 * The frontend redirects the user to that URL to complete payment.
 */
import { createCheckoutSession } from '../../_lib/stripe.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PRICE_ID) {
    return Response.json({ error: 'Stripe no está configurado' }, { status: 500 });
  }

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

  const appUrl = env.APP_URL || new URL(request.url).origin;

  try {
    const session = await createCheckoutSession({
      secretKey:  env.STRIPE_SECRET_KEY,
      priceId:    env.STRIPE_PRICE_ID,
      email,
      successUrl: `${appUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl:  `${appUrl}/comprar.html?canceled=1`,
    });
    return Response.json({ url: session.url });
  } catch (err) {
    console.error('[Stripe checkout]', err);
    return Response.json({ error: err.message || 'Error al crear sesión de pago' }, { status: 500 });
  }
}
