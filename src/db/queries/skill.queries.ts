import { pool } from "../../config/database.js";

export interface SkillFamilyRow {
  id: string;
  did_id: string;
  family_did: string;
  owner_did: string;
  name: string;
  description: string | null;
  category: string | null;
  tags: string[];
  latest_version: string | null;
  latest_version_did: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface SkillVersionRow {
  id: string;
  did_id: string;
  version_did: string;
  family_id: string;
  family_did: string;
  version: string;
  bump_type: string;
  previous_version_did: string | null;
  status: string;
  review_status: string;
  execution_mode: string;
  input_schema: object | null;
  output_schema: object | null;
  tool_declarations: object | null;
  content_hash: string;
  creator_sig: string;
  content_plaintext: object | null;
  degraded_since: Date | null;
  deprecated_since: Date | null;
  created_at: Date;
}

export interface SkillChangelogRow {
  id: string;
  family_did: string;
  version: string;
  summary: string;
  details: object;
  migration_guide: object | null;
  created_at: Date;
}

export async function findSkillFamilyByFamilyDid(
  familyDid: string,
): Promise<SkillFamilyRow | null> {
  const result = await pool.query(
    "SELECT * FROM skill_families WHERE family_did = $1",
    [familyDid],
  );
  return result.rows[0] ?? null;
}

export async function findSkillFamiliesByOwner(
  ownerDid: string,
): Promise<SkillFamilyRow[]> {
  const result = await pool.query(
    "SELECT * FROM skill_families WHERE owner_did = $1 ORDER BY created_at DESC",
    [ownerDid],
  );
  return result.rows;
}

export async function insertSkillFamily(params: {
  did_id: string;
  family_did: string;
  owner_did: string;
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
}): Promise<SkillFamilyRow> {
  const result = await pool.query(
    `INSERT INTO skill_families 
     (did_id, family_did, owner_did, name, description, category, tags)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      params.did_id,
      params.family_did,
      params.owner_did,
      params.name,
      params.description ?? null,
      params.category ?? null,
      params.tags ?? [],
    ],
  );
  return result.rows[0];
}

export async function updateSkillFamilyLatestVersion(
  familyDid: string,
  version: string,
  versionDid: string,
): Promise<void> {
  await pool.query(
    `UPDATE skill_families 
     SET latest_version = $1, latest_version_did = $2, updated_at = now()
     WHERE family_did = $3`,
    [version, versionDid, familyDid],
  );
}

export async function findSkillVersionByVersionDid(
  versionDid: string,
): Promise<SkillVersionRow | null> {
  const result = await pool.query(
    "SELECT * FROM skill_versions WHERE version_did = $1",
    [versionDid],
  );
  return result.rows[0] ?? null;
}

export async function findSkillVersionByVersion(
  familyDid: string,
  version: string,
): Promise<SkillVersionRow | null> {
  const result = await pool.query(
    "SELECT * FROM skill_versions WHERE family_did = $1 AND version = $2",
    [familyDid, version],
  );
  return result.rows[0] ?? null;
}

export async function findSkillVersionsByFamily(
  familyDid: string,
): Promise<SkillVersionRow[]> {
  const result = await pool.query(
    "SELECT * FROM skill_versions WHERE family_did = $1 ORDER BY created_at DESC",
    [familyDid],
  );
  return result.rows;
}

export async function findActiveSkillVersion(
  familyDid: string,
): Promise<SkillVersionRow | null> {
  const result = await pool.query(
    `SELECT * FROM skill_versions 
     WHERE family_did = $1 AND status = 'active'
     ORDER BY created_at DESC LIMIT 1`,
    [familyDid],
  );
  return result.rows[0] ?? null;
}

export async function insertSkillVersion(params: {
  did_id: string;
  version_did: string;
  family_id: string;
  family_did: string;
  version: string;
  bump_type: string;
  previous_version_did?: string;
  input_schema?: object;
  output_schema?: object;
  tool_declarations?: object;
  content_hash: string;
  creator_sig: string;
  content_plaintext?: object;
}): Promise<SkillVersionRow> {
  const result = await pool.query(
    `INSERT INTO skill_versions 
     (did_id, version_did, family_id, family_did, version, bump_type,
      previous_version_did, input_schema, output_schema, tool_declarations,
      content_hash, creator_sig, content_plaintext)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING *`,
    [
      params.did_id,
      params.version_did,
      params.family_id,
      params.family_did,
      params.version,
      params.bump_type,
      params.previous_version_did ?? null,
      params.input_schema ? JSON.stringify(params.input_schema) : null,
      params.output_schema ? JSON.stringify(params.output_schema) : null,
      params.tool_declarations
        ? JSON.stringify(params.tool_declarations)
        : null,
      params.content_hash,
      params.creator_sig,
      params.content_plaintext
        ? JSON.stringify(params.content_plaintext)
        : null,
    ],
  );
  return result.rows[0];
}

export async function updateSkillVersionStatus(
  versionDid: string,
  status: string,
): Promise<void> {
  await pool.query(
    `UPDATE skill_versions 
     SET status = $1,
         degraded_since = CASE WHEN $1 = 'degraded' THEN now() ELSE degraded_since END,
         deprecated_since = CASE WHEN $1 = 'deprecated' THEN now() ELSE deprecated_since END
     WHERE version_did = $2`,
    [status, versionDid],
  );
}

export async function insertSkillChangelog(params: {
  family_did: string;
  version: string;
  summary: string;
  details?: object;
  migration_guide?: object;
}): Promise<SkillChangelogRow> {
  const result = await pool.query(
    `INSERT INTO skill_changelogs (family_did, version, summary, details, migration_guide)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      params.family_did,
      params.version,
      params.summary,
      JSON.stringify(params.details ?? {}),
      params.migration_guide ? JSON.stringify(params.migration_guide) : null,
    ],
  );
  return result.rows[0];
}

export async function searchSkillDiscovery(
  query: string,
  limit = 20,
  offset = 0,
): Promise<
  Array<{
    family_did: string;
    name: string;
    description: string | null;
    category: string | null;
    tags: string[];
    latest_version: string | null;
    owner_did: string;
    search_vector: unknown;
  }>
> {
  const result = await pool.query(
    `SELECT family_did, name, description, category, tags, latest_version, owner_did, search_vector
     FROM skill_discovery
     WHERE search_vector @@ plainto_tsquery('english', $1)
     ORDER BY ts_rank(search_vector, plainto_tsquery('english', $1)) DESC
     LIMIT $2 OFFSET $3`,
    [query, limit, offset],
  );
  return result.rows;
}

export async function refreshSkillDiscovery(): Promise<void> {
  await pool.query("REFRESH MATERIALIZED VIEW skill_discovery");
}
