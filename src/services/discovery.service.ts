import { pool } from "../config/database.js";
import {
  searchSkillDiscovery,
  refreshSkillDiscovery,
} from "../db/queries/skill.queries.js";
import {
  searchAgentDiscovery,
  refreshAgentDiscovery,
} from "../db/queries/agent.queries.js";

export interface SkillDiscoveryResult {
  family_did: string;
  name: string;
  description: string | null;
  category: string | null;
  tags: string[];
  latest_version: string | null;
  owner_did: string;
}

export interface AgentDiscoveryResult {
  family_did: string;
  name: string;
  description: string | null;
  tags: string[];
  visibility: string;
  latest_version: string | null;
  owner_did: string;
}

export interface DiscoveryParams {
  q?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}

export async function discoverSkills(
  params: DiscoveryParams = {},
): Promise<{ items: SkillDiscoveryResult[]; total: number }> {
  const limit = params.limit ?? 20;
  const offset = params.offset ?? 0;
  const query = params.q ?? "";

  const items = await searchSkillDiscovery(query, limit, offset);

  const countResult = await pool.query(
    `SELECT COUNT(*) as total FROM skill_discovery
     WHERE search_vector @@ plainto_tsquery('english', $1)`,
    [query],
  );

  return {
    items: items as SkillDiscoveryResult[],
    total: parseInt(countResult.rows[0].total, 10),
  };
}

export async function discoverAgents(
  params: DiscoveryParams = {},
): Promise<{ items: AgentDiscoveryResult[]; total: number }> {
  const limit = params.limit ?? 20;
  const offset = params.offset ?? 0;
  const query = params.q ?? "";

  const items = await searchAgentDiscovery(query, limit, offset);

  const countResult = await pool.query(
    `SELECT COUNT(*) as total FROM agent_discovery
     WHERE search_vector @@ plainto_tsquery('english', $1)`,
    [query],
  );

  return {
    items: items as AgentDiscoveryResult[],
    total: parseInt(countResult.rows[0].total, 10),
  };
}

export async function refreshDiscoveryViews(): Promise<void> {
  await refreshSkillDiscovery();
  await refreshAgentDiscovery();
}
