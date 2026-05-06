/**
 * stripe.js — Minimal Stripe HTTP client (no SDK, runs in Cloudflare Workers).
 * Handles Checkout Session creation and webhook signature verification.
 */

const STRIPE_API        = 'https://api.stripe.com/v1';
const TOLERANCE_SECONDS = 300; // same as Stripe SDK default — replay protection
const enc               = new TextEncoder();

// ─── Checkout ───────────────────────────────────────────────────────────────

/**
 * Creates a Stripe Checkout Session in payment (one-off) mode.
 * Returns the full session object — use .url to redirect the user.
 */
export async function createCheckoutSession({ secretKey, priceId, email, successUrl, cancelUrl }) {
  const params = new URLSearchParams();
  params.set('mode', 'payment');
  params.set('line_items[0][price]',     priceId);
  params.set('line_items[0][quantity]',  '1');
  params.set('success_url',              successUrl);
  params.set('cancel_url',               cancelUrl);
  params.set('customer_email',           email);
  params.set('client_reference_id',      email);
  params.set('metadata[email]',          email);
  params.set('payment_intent_data[metadata][email]', email);
  params.set('allow_promotion_codes',    'true');

  const res = await fetch(`${STRIPE_API}/checkout/sessions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${secretKey}`,
      'Content-Type':  'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Stripe ${res.status}: ${data?.error?.message || JSON.stringify(data)}`);
  }
  return data;
}

// ─── Webhook signature verification ─────────────────────────────────────────

/**
 * Verifies the Stripe-Signature header against the raw request body.
 * Returns true only if the signature is valid AND within the tolerance window.
 */
export async function verifyWebhookSignature(rawBody, sigHeader, secret) {
  if (!sigHeader || !secret) return false;

  const parts = {};
  for (const item of sigHeader.split(',')) {
    const [k, v] = item.split('=');
    if (!parts[k]) parts[k] = [];
    parts[k].push(v);
  }
  const timestamp  = parts.t?.[0];
  const signatures = parts.v1 || [];
  if (!timestamp || signatures.length === 0) return false;

  // Replay protection
  const ageSec = Math.floor(Date.now() / 1000) - Number(timestamp);
  if (Math.abs(ageSec) > TOLERANCE_SECONDS) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuf   = await crypto.subtle.sign('HMAC', key, enc.encode(`${timestamp}.${rawBody}`));
  const computed = bytesToHex(new Uint8Array(sigBuf));

  return signatures.some(s => timingSafeEqual(s, computed));
}

function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
