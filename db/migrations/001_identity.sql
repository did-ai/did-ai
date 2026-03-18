-- did:ai Phase 1 - Identity Migrations
-- Creates core DID tables, authentication tables, and audit logging

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -------------------------------------------------------
-- All DID subjects share this table
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS did_documents (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  did         TEXT    UNIQUE NOT NULL,
  type        TEXT    NOT NULL
              CHECK (type IN ('dev','skill','agent','barn','platform','host')),
  subtype     TEXT    NOT NULL
              CHECK (subtype IN ('identity','family','version')),
  namespace   TEXT    NOT NULL,
  unique_id   TEXT    NOT NULL,
  document    JSONB   NOT NULL,
  status      TEXT    NOT NULL DEFAULT 'active'
              CHECK (status IN ('active','deactivated')),
  is_platform BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (namespace, unique_id)
);

CREATE INDEX IF NOT EXISTS idx_did_documents_type      ON did_documents(type);
CREATE INDEX IF NOT EXISTS idx_did_documents_subtype   ON did_documents(subtype);
CREATE INDEX IF NOT EXISTS idx_did_documents_namespace ON did_documents(namespace);
CREATE INDEX IF NOT EXISTS idx_did_documents_status    ON did_documents(status);

-- Version history for each DID Document
CREATE TABLE IF NOT EXISTS did_versions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  did_id      UUID NOT NULL REFERENCES did_documents(id),
  did         TEXT NOT NULL,
  version_num INT  NOT NULL,
  document    JSONB NOT NULL,
  changed_by  TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_did_versions_did ON did_versions(did);

-- Cloud-custodied signing keys (encrypted with user password)
CREATE TABLE IF NOT EXISTS custodial_signing_keys (
  developer_did     TEXT PRIMARY KEY,
  encrypted_privkey BYTEA NOT NULL,
  kdf_salt          BYTEA NOT NULL,
  kdf_iterations    INT   NOT NULL DEFAULT 600000,
  encryption_alg    TEXT  NOT NULL DEFAULT 'AES-256-GCM',
  keychain_synced   BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Web sessions
CREATE TABLE IF NOT EXISTS user_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    TEXT UNIQUE NOT NULL,
  developer_did TEXT NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  revoked       BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_did ON user_sessions(developer_did);
CREATE INDEX IF NOT EXISTS idx_sessions_sid ON user_sessions(session_id);

-- Append-only audit log (application has INSERT only)
CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seq           BIGSERIAL NOT NULL,
  chain_id      TEXT NOT NULL DEFAULT 'P2L',
  prev_hash     TEXT NOT NULL,
  timestamp     TIMESTAMPTZ NOT NULL DEFAULT now(),
  level         TEXT NOT NULL CHECK (level IN ('P0','P1','P2L','P2T','P3')),
  actor_did     TEXT,
  actor_ip      INET,
  action        TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id   TEXT NOT NULL,
  payload       JSONB NOT NULL DEFAULT '{}',
  result        TEXT NOT NULL CHECK (result IN ('success','failure')),
  entry_hash    TEXT NOT NULL
);

-- Migrations tracking table
CREATE TABLE IF NOT EXISTS schema_migrations (
  version       TEXT PRIMARY KEY,
  applied_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  description   TEXT
);
