-- did:ai Phase 1 - Agent Migrations
-- Creates agent families, versions, and discovery views

-- Agent Families
CREATE TABLE IF NOT EXISTS agent_families (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  did_id            UUID UNIQUE NOT NULL REFERENCES did_documents(id),
  family_did        TEXT UNIQUE NOT NULL,
  owner_did         TEXT NOT NULL,
  name              TEXT NOT NULL,
  description       TEXT,
  tags              TEXT[] DEFAULT '{}',
  visibility        TEXT NOT NULL DEFAULT 'public'
                    CHECK (visibility IN ('public','unlisted','private')),
  latest_version    TEXT,
  latest_version_did TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_families_owner ON agent_families(owner_did);

-- Agent Versions
CREATE TABLE IF NOT EXISTS agent_versions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  did_id               UUID UNIQUE NOT NULL REFERENCES did_documents(id),
  version_did          TEXT UNIQUE NOT NULL,
  family_id            UUID NOT NULL REFERENCES agent_families(id),
  family_did           TEXT NOT NULL,
  version              TEXT NOT NULL,
  bump_type            TEXT NOT NULL CHECK (bump_type IN ('patch','minor','major')),
  previous_version_did TEXT,
  skill_bindings       JSONB NOT NULL DEFAULT '[]',
  orchestration_mode   TEXT NOT NULL DEFAULT 'standalone'
                       CHECK (orchestration_mode IN ('standalone','barn_role')),
  orchestration_flow   JSONB,
  aggregated_tools     JSONB,
  capabilities         JSONB,
  agent_config         JSONB,
  status               TEXT NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active','degraded','deprecated')),
  review_status        TEXT NOT NULL DEFAULT 'approved'
                       CHECK (review_status IN ('pending','approved','rejected','suspended')),
  content_hash         TEXT NOT NULL,
  creator_sig          TEXT NOT NULL,
  degraded_since       TIMESTAMPTZ,
  deprecated_since     TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (family_did, version)
);

CREATE INDEX IF NOT EXISTS idx_agent_versions_family ON agent_versions(family_did);
CREATE INDEX IF NOT EXISTS idx_agent_versions_status ON agent_versions(status);

-- Agent Changelogs
CREATE TABLE IF NOT EXISTS agent_changelogs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_did      TEXT NOT NULL,
  version         TEXT NOT NULL,
  summary         TEXT NOT NULL,
  details         JSONB NOT NULL DEFAULT '{}',
  migration_guide JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (family_did, version)
);

-- Discovery materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS agent_discovery AS
SELECT
  af.family_did,
  af.name,
  af.description,
  af.tags,
  af.visibility,
  af.latest_version,
  af.owner_did,
  av.skill_bindings,
  av.aggregated_tools,
  av.orchestration_mode,
  0::numeric AS sort_score,
  af.created_at,
  to_tsvector('english', af.name || ' ' || COALESCE(af.description, '')) AS search_vector
FROM agent_families af
LEFT JOIN agent_versions av
  ON av.family_did = af.family_did AND av.version = af.latest_version
WHERE af.visibility = 'public'
  AND av.review_status = 'approved'
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_discovery_family ON agent_discovery(family_did);
CREATE INDEX IF NOT EXISTS idx_agent_discovery_search ON agent_discovery USING gin(search_vector);
