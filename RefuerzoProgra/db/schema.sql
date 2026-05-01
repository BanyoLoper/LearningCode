-- D1 schema for RefuerzoProgra
-- Run after every change: wrangler d1 execute refuerzo-progra-db --file=db/schema.sql --remote
-- For local dev: wrangler d1 execute refuerzo-progra-db --file=db/schema.sql --local

CREATE TABLE IF NOT EXISTS user_progress (
  email      TEXT PRIMARY KEY,
  data       TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL
);

-- Paying users. A row exists only after a successful Stripe payment.
CREATE TABLE IF NOT EXISTS users (
  email             TEXT PRIMARY KEY,
  paid_at           TEXT,
  stripe_session_id TEXT,
  amount_mxn        INTEGER,
  created_at        TEXT NOT NULL
);

-- One-shot magic-link tokens. Marked used_at on first redemption.
CREATE TABLE IF NOT EXISTS magic_tokens (
  token       TEXT PRIMARY KEY,
  email       TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  used_at     TEXT,
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_magic_email ON magic_tokens(email);
