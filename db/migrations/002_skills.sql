-- did:ai Phase 1 - Skill Migrations
-- Creates skill families, versions, and discovery views

-- Skill Families
CREATE TABLE IF NOT EXISTS skill_families (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  did_id            UUID UNIQUE NOT NULL REFERENCES did_documents(id),
  family_did        TEXT UNIQUE NOT NULL,
  owner_did         TEXT NOT NULL,
  name              TEXT NOT NULL,
  description       TEXT,
  category          TEXT,
  tags              TEXT[] DEFAULT '{}',
  latest_version    TEXT,
  latest_version_did TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_skill_families_owner ON skill_families(owner_did);
CREATE INDEX IF NOT EXISTS idx_skill_families_tags  ON skill_families USING gin(tags);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_skill_families_fts ON skill_families
  USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- Skill Versions
CREATE TABLE IF NOT EXISTS skill_versions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  did_id               UUID UNIQUE NOT NULL REFERENCES did_documents(id),
  version_did          TEXT UNIQUE NOT NULL,
  family_id            UUID NOT NULL REFERENCES skill_families(id),
  family_did           TEXT NOT NULL,
  version              TEXT NOT NULL,
  bump_type            TEXT NOT NULL CHECK (bump_type IN ('patch','minor','major')),
  previous_version_did TEXT,
  status               TEXT NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active','degraded','deprecated')),
  review_status        TEXT NOT NULL DEFAULT 'approved'
                       CHECK (review_status IN ('pending','approved','rejected','suspended')),
  execution_mode       TEXT NOT NULL DEFAULT 'prompt'
                       CHECK (execution_mode IN ('prompt','tool_enabled','code_enabled','agent')),
  input_schema         JSONB,
  output_schema        JSONB,
  tool_declarations    JSONB,
  content_hash         TEXT NOT NULL,
  creator_sig          TEXT NOT NULL,
  content_plaintext    JSONB,
  degraded_since       TIMESTAMPTZ,
  deprecated_since     TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (family_did, version)
);

CREATE INDEX IF NOT EXISTS idx_skill_versions_family ON skill_versions(family_did);
CREATE INDEX IF NOT EXISTS idx_skill_versions_status ON skill_versions(status);

-- Skill Changelogs
CREATE TABLE IF NOT EXISTS skill_changelogs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_did  TEXT NOT NULL,
  version     TEXT NOT NULL,
  summary     TEXT NOT NULL,
  details     JSONB NOT NULL DEFAULT '{}',
  migration_guide JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (family_did, version)
);

-- Discovery materialized view (Phase 1: no reputation, ordered by created_at)
CREATE MATERIALIZED VIEW IF NOT EXISTS skill_discovery AS
SELECT
  sf.family_did,
  sf.name,
  sf.description,
  sf.category,
  sf.tags,
  sf.latest_version,
  sf.owner_did,
  sv.input_schema,
  sv.output_schema,
  sv.execution_mode,
  sv.tool_declarations,
  0::numeric AS sort_score,
  sf.created_at,
  to_tsvector('english', sf.name || ' ' || COALESCE(sf.description, '')) AS search_vector
FROM skill_families sf
LEFT JOIN skill_versions sv
  ON sv.family_did = sf.family_did AND sv.version = sf.latest_version
WHERE sv.review_status = 'approved'
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_skill_discovery_family ON skill_discovery(family_did);
CREATE INDEX IF NOT EXISTS idx_skill_discovery_search ON skill_discovery USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_skill_discovery_score ON skill_discovery(sort_score DESC);
