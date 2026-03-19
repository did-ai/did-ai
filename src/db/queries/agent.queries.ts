import { pool } from "../../config/database.js";

export interface AgentFamilyRow {
  id: string;
  did_id: string;
  family_did: string;
  owner_did: string;
  name: string;
  description: string | null;
  tags: string[];
  visibility: string;
  latest_version: string | null;
  latest_version_did: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface AgentVersionRow {
  id: string;
  did_id: string;
  version_did: string;
  family_id: string;
  family_did: string;
  version: string;
  bump_type: string;
  previous_version_did: string | null;
  input_schema: object | null;
  output_schema: object | null;
  tool_declarations: object | null;
  execution_mode: string;
  skill_bindings: object[];
  orchestration_mode: string;
  orchestration_flow: object | null;
  aggregated_tools: object | null;
  capabilities: object | null;
  agent_config: object | null;
  status: string;
  review_status: string;
  content_hash: string;
  creator_sig: string;
  content_plaintext: object | null;
  degraded_since: Date | null;
  deprecated_since: Date | null;
  created_at: Date;
}

export interface AgentChangelogRow {
  id: string;
  family_did: string;
  version: string;
  summary: string;
  details: object;
  migration_guide: object | null;
  created_at: Date;
}

export async function findAgentFamilyByFamilyDid(
  familyDid: string,
): Promise<AgentFamilyRow | null> {
  const result = await pool.query(
    "SELECT * FROM agent_families WHERE family_did = $1",
    [familyDid],
  );
  return result.rows[0] ?? null;
}

export async function findAgentFamiliesByOwner(
  ownerDid: string,
): Promise<AgentFamilyRow[]> {
  const result = await pool.query(
    "SELECT * FROM agent_families WHERE owner_did = $1 ORDER BY created_at DESC",
    [ownerDid],
  );
  return result.rows;
}

export async function findPublicAgentFamilies(): Promise<AgentFamilyRow[]> {
  const result = await pool.query(
    `SELECT * FROM agent_families 
     WHERE visibility = 'public' 
     ORDER BY created_at DESC`,
  );
  return result.rows;
}

export async function insertAgentFamily(params: {
  did_id: string;
  family_did: string;
  owner_did: string;
  name: string;
  description?: string;
  tags?: string[];
  visibility?: string;
}): Promise<AgentFamilyRow> {
  const result = await pool.query(
    `INSERT INTO agent_families 
     (did_id, family_did, owner_did, name, description, tags, visibility)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      params.did_id,
      params.family_did,
      params.owner_did,
      params.name,
      params.description ?? null,
      params.tags ?? [],
      params.visibility ?? "public",
    ],
  );
  return result.rows[0];
}

export async function updateAgentFamilyLatestVersion(
  familyDid: string,
  version: string,
  versionDid: string,
): Promise<void> {
  await pool.query(
    `UPDATE agent_families 
     SET latest_version = $1, latest_version_did = $2, updated_at = now()
     WHERE family_did = $3`,
    [version, versionDid, familyDid],
  );
}

export async function findAgentVersionByVersionDid(
  versionDid: string,
): Promise<AgentVersionRow | null> {
  const result = await pool.query(
    "SELECT * FROM agent_versions WHERE version_did = $1",
    [versionDid],
  );
  return result.rows[0] ?? null;
}

export async function findAgentVersionByVersion(
  familyDid: string,
  version: string,
): Promise<AgentVersionRow | null> {
  const result = await pool.query(
    "SELECT * FROM agent_versions WHERE family_did = $1 AND version = $2",
    [familyDid, version],
  );
  return result.rows[0] ?? null;
}

export async function findAgentVersionsByFamily(
  familyDid: string,
): Promise<AgentVersionRow[]> {
  const result = await pool.query(
    "SELECT * FROM agent_versions WHERE family_did = $1 ORDER BY created_at DESC",
    [familyDid],
  );
  return result.rows;
}

export async function findActiveAgentVersion(
  familyDid: string,
): Promise<AgentVersionRow | null> {
  const result = await pool.query(
    `SELECT * FROM agent_versions 
     WHERE family_did = $1 AND status = 'active'
     ORDER BY created_at DESC LIMIT 1`,
    [familyDid],
  );
  return result.rows[0] ?? null;
}

export async function insertAgentVersion(params: {
  did_id: string;
  version_did: string;
  family_id: string;
  family_did: string;
  version: string;
  bump_type: string;
  previous_version_did?: string;
  skill_bindings?: object[];
  orchestration_mode?: string;
  orchestration_flow?: object;
  aggregated_tools?: object;
  capabilities?: object;
  agent_config?: object;
  content_hash: string;
  creator_sig: string;
}): Promise<AgentVersionRow> {
  const result = await pool.query(
    `INSERT INTO agent_versions 
     (did_id, version_did, family_id, family_did, version, bump_type,
      previous_version_did, skill_bindings, orchestration_mode, orchestration_flow,
      aggregated_tools, capabilities, agent_config, content_hash, creator_sig)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     RETURNING *`,
    [
      params.did_id,
      params.version_did,
      params.family_id,
      params.family_did,
      params.version,
      params.bump_type,
      params.previous_version_did ?? null,
      JSON.stringify(params.skill_bindings ?? []),
      params.orchestration_mode ?? "standalone",
      params.orchestration_flow
        ? JSON.stringify(params.orchestration_flow)
        : null,
      params.aggregated_tools ? JSON.stringify(params.aggregated_tools) : null,
      params.capabilities ? JSON.stringify(params.capabilities) : null,
      params.agent_config ? JSON.stringify(params.agent_config) : null,
      params.content_hash,
      params.creator_sig,
    ],
  );
  return result.rows[0];
}

export async function updateAgentVersionStatus(
  versionDid: string,
  status: string,
): Promise<void> {
  await pool.query(
    `UPDATE agent_versions 
     SET status = $1,
         degraded_since = CASE WHEN $1 = 'degraded' THEN now() ELSE degraded_since END,
         deprecated_since = CASE WHEN $1 = 'deprecated' THEN now() ELSE deprecated_since END
     WHERE version_did = $2`,
    [status, versionDid],
  );
}

export async function insertAgentChangelog(params: {
  family_did: string;
  version: string;
  summary: string;
  details?: object;
  migration_guide?: object;
}): Promise<AgentChangelogRow> {
  const result = await pool.query(
    `INSERT INTO agent_changelogs (family_did, version, summary, details, migration_guide)
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

export async function searchAgentDiscovery(
  query: string,
  limit = 20,
  offset = 0,
): Promise<
  Array<{
    family_did: string;
    name: string;
    description: string | null;
    tags: string[];
    visibility: string;
    latest_version: string | null;
    owner_did: string;
    search_vector: unknown;
  }>
> {
  const result = await pool.query(
    `SELECT family_did, name, description, tags, visibility, latest_version, owner_did, search_vector
     FROM agent_discovery
     WHERE search_vector @@ plainto_tsquery('english', $1)
     ORDER BY ts_rank(search_vector, plainto_tsquery('english', $1)) DESC
     LIMIT $2 OFFSET $3`,
    [query, limit, offset],
  );
  return result.rows;
}

export async function refreshAgentDiscovery(): Promise<void> {
  await pool.query("REFRESH MATERIALIZED VIEW agent_discovery");
}
