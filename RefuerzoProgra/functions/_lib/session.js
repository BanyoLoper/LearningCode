/**
 * session.js — Signs and verifies session cookies using HMAC-SHA256.
 *
 * Cookie format: <base64url(payload)>.<base64url(hmac)> where payload is
 * "<email>|<expiresAtMs>". Stored as HttpOnly + SameSite=Lax (+ Secure in prod).
 *
 * Replaces the previous Cloudflare Access header authentication.
 */

const COOKIE_NAME = 'session';
const TTL_MS      = 1000 * 60 * 60 * 24 * 30; // 30 days

const enc = new TextEncoder();
const dec = new TextDecoder();

// ─── Base64URL ──────────────────────────────────────────────────────────────

function b64urlEncode(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') +
                 '==='.slice((str.length + 3) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ─── HMAC ───────────────────────────────────────────────────────────────────

async function importKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

// ─── Public ─────────────────────────────────────────────────────────────────

/** Builds a Set-Cookie value with a freshly signed session for the given email. */
export async function buildSessionCookie(email, secret, { secure = true } = {}) {
  if (!secret) throw new Error('SESSION_SECRET is not configured');
  const expiresAt = Date.now() + TTL_MS;
  const payload   = `${email}|${expiresAt}`;
  const key       = await importKey(secret);
  const sigBuf    = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  const token     = `${b64urlEncode(enc.encode(payload))}.${b64urlEncode(new Uint8Array(sigBuf))}`;

  const attrs = [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(TTL_MS / 1000)}`,
  ];
  if (secure) attrs.push('Secure');
  return attrs.join('; ');
}

/** Builds a Set-Cookie value that immediately clears the session. */
export function buildClearCookie({ secure = true } = {}) {
  const attrs = [
    `${COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ];
  if (secure) attrs.push('Secure');
  return attrs.join('; ');
}

/** Reads the Cookie header and returns the verified email, or null if missing/invalid/expired. */
export async function readSession(request, secret) {
  if (!secret) return null;
  const header = request.headers.get('Cookie');
  if (!header) return null;
  const m = header.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]+)`));
  if (!m) return null;

  const [payloadB64, sigB64] = m[1].split('.');
  if (!payloadB64 || !sigB64) return null;

  try {
    const key          = await importKey(secret);
    const payloadBytes = b64urlDecode(payloadB64);
    const sigBytes     = b64urlDecode(sigB64);
    const ok           = await crypto.subtle.verify('HMAC', key, sigBytes, payloadBytes);
    if (!ok) return null;

    const [email, expStr] = dec.decode(payloadBytes).split('|');
    if (!email || !expStr) return null;
    if (Date.now() > Number(expStr)) return null;
    return email;
  } catch {
    return null;
  }
}
