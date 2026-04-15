-- D1 schema for RefuerzoProgra
-- Run once: wrangler d1 execute refuerzo-progra-db --file=db/schema.sql

CREATE TABLE IF NOT EXISTS user_progress (
  email      TEXT PRIMARY KEY,
  data       TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL
);
