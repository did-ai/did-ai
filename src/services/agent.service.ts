import canonicalize from "canonicalize";
import { pool } from "../config/database.js";
import { redis } from "../config/redis.js";
import { generateDid, sha256hex } from "../crypto/keys.js";
import { verifySignature } from "../crypto/signing.js";
import {
  buildDidDocument,
  buildAgentFamilyService,
  buildAgentVersionService,
  buildAgentProfileService,
} from "../builders/did-document.builder.js";
import { DidAiError, ErrorCode } from "../errors/index.js";
import {
  findAgentFamilyByFamilyDid,
  updateAgentFamilyLatestVersion,
  findAgentVersionByVersionDid,
  findActiveAgentVersion,
  findAgentVersionsByFamily,
  updateAgentVersionStatus,
  type AgentFamilyRow,
  type AgentVersionRow,
} from "../db/queries/agent.queries.js";
import { findDidByDid } from "../db/queries/did.queries.js";
import {
  validateAgentConstraints,
  validateSkillBindings,
} from "../validators/constraints.js";

export interface AgentContent {
  skill_bindings: Array<{
    skillFamilyDid: string;
    versionPolicy: string;
    lockedVersion?: string;
    role: string;
  }>;
  orchestration_mode: "standalone" | "barn_role";
  orchestration_flow?: object;
  aggregated_tools?: object[];
  capabilities?: {
    inputFormats: string[];
    outputFormats: string[];
  };
  agent_config?: object;
  name: string;
  description?: string;
  tags?: string[];
  visibility: "public" | "unlisted" | "private";
  version: string;
  family_did: string;
}

export function computeAgentContentHash(content: AgentContent): string {
  return sha256hex(canonicalize(content)!);
}

async function getOwnerSigningKey(ownerDid: string): Promise<string> {
  const didDoc = await findDidByDid(ownerDid);
  if (!didDoc) {
    throw new DidAiError(ErrorCode.DID_NOT_FOUND, `DID not found: ${ownerDid}`);
  }
  const doc = didDoc.document as {
    verificationMethod?: Array<{ id: string; publicKeyMultibase: string }>;
  };
  const vm = doc.verificationMethod?.find((v) => v.id.endsWith("#signing-key"));
  if (!vm) {
    throw new DidAiError(
      ErrorCode.DID_NOT_FOUND,
      `Signing key not found for ${ownerDid}`,
    );
  }
  return vm.publicKeyMultibase;
}

export async function createAgentFamily(params: {
  ownerDid: string;
  name: string;
  description?: string;
  tags?: string[];
  visibility?: "public" | "unlisted" | "private";
  namespace: string;
}): Promise<{ familyDid: string }> {
  const familyDid = generateDid("agent", params.namespace);
  const shortId = familyDid.split(":").pop()!;

  const document = buildDidDocument({
    did: familyDid,
    subtype: "family",
    controller: params.ownerDid,
    services: [
      buildAgentFamilyService({
        familyDid,
        name: params.name,
        description: params.description,
        tags: params.tags,
        visibility: params.visibility ?? "public",
      }),
    ],
  });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO did_documents
       (did, type, subtype, namespace, unique_id, document, status)
       VALUES ($1, 'agent', 'family', $2, $3, $4, 'active')`,
      [familyDid, params.namespace, shortId, JSON.stringify(document)],
    );

    const didRow = await client.query(
      "SELECT id FROM did_documents WHERE did = $1",
      [familyDid],
    );

    await client.query(
      `INSERT INTO agent_families
       (did_id, family_did, owner_did, name, description, tags, visibility)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        didRow.rows[0].id,
        familyDid,
        params.ownerDid,
        params.name,
        params.description ?? null,
        params.tags ?? [],
        params.visibility ?? "public",
      ],
    );

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  return { familyDid };
}

export async function publishAgentVersion(params: {
  familyDid: string;
  ownerDid: string;
  version: string;
  bumpType: "patch" | "minor" | "major";
  content: AgentContent;
  creatorSig: string;
  changelog: {
    summary: string;
    details?: object;
    migrationGuide?: object;
  };
  namespace: string;
}): Promise<{ versionDid: string; contentHash: string }> {
  if (params.bumpType === "major" && !params.changelog.migrationGuide) {
    throw new DidAiError(
      ErrorCode.MISSING_MIGRATION_GUIDE,
      "Major version bump requires migrationGuide in changelog",
    );
  }

  const family = await findAgentFamilyByFamilyDid(params.familyDid);
  if (!family) {
    throw new DidAiError(
      ErrorCode.FAMILY_NOT_FOUND,
      `Agent family not found: ${params.familyDid}`,
    );
  }
  if (family.owner_did !== params.ownerDid) {
    throw new DidAiError(
      ErrorCode.AUTH_REQUIRED,
      "Only the owner can publish versions",
    );
  }

  validateSkillBindings(params.content.skill_bindings);

  const contentHash = computeAgentContentHash(params.content);
  const signingKey = await getOwnerSigningKey(params.ownerDid);
  if (!verifySignature(contentHash, params.creatorSig, signingKey)) {
    throw new DidAiError(
      ErrorCode.INVALID_SIGNATURE,
      "creatorSig verification failed",
    );
  }

  const versionDid = generateDid("agent", params.namespace);
  const shortId = versionDid.split(":").pop()!;

  const prevVersion = await findActiveAgentVersion(params.familyDid);
  const previousVersionDid = prevVersion?.version_did ?? null;

  const document = buildDidDocument({
    did: versionDid,
    subtype: "version",
    controller: params.ownerDid,
    services: [
      buildAgentVersionService({
        versionDid,
        familyDid: params.familyDid,
        version: params.version,
        bumpType: params.bumpType,
        status: "active",
        previousVersionDid: previousVersionDid ?? undefined,
        skillBindings: params.content.skill_bindings,
        orchestrationMode: params.content.orchestration_mode,
        orchestrationFlow: params.content.orchestration_flow,
        aggregatedTools: params.content.aggregated_tools,
        contentHash,
        creatorSig: params.creatorSig,
      }),
      buildAgentProfileService({
        versionDid,
        name: params.content.name,
        description: params.content.description,
        tags: params.content.tags,
        visibility: params.content.visibility,
        capabilities: params.content.capabilities ?? {
          inputFormats: [],
          outputFormats: [],
        },
      }),
    ],
  });

  validateAgentConstraints(
    document as Parameters<typeof validateAgentConstraints>[0],
  );

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO did_documents
       (did, type, subtype, namespace, unique_id, document, status)
       VALUES ($1, 'agent', 'version', $2, $3, $4, 'active')`,
      [versionDid, params.namespace, shortId, JSON.stringify(document)],
    );

    const didRow = await client.query(
      "SELECT id FROM did_documents WHERE did = $1",
      [versionDid],
    );

    await client.query(
      `INSERT INTO agent_versions
       (did_id, version_did, family_id, family_did, version, bump_type,
        previous_version_did, skill_bindings, orchestration_mode, orchestration_flow,
        aggregated_tools, capabilities, agent_config, content_hash, creator_sig)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        didRow.rows[0].id,
        versionDid,
        family.id,
        params.familyDid,
        params.version,
        params.bumpType,
        previousVersionDid ?? undefined,
        JSON.stringify(params.content.skill_bindings),
        params.content.orchestration_mode,
        params.content.orchestration_flow
          ? JSON.stringify(params.content.orchestration_flow)
          : null,
        params.content.aggregated_tools
          ? JSON.stringify(params.content.aggregated_tools)
          : null,
        params.content.capabilities
          ? JSON.stringify(params.content.capabilities)
          : null,
        params.content.agent_config
          ? JSON.stringify(params.content.agent_config)
          : null,
        contentHash,
        params.creatorSig,
      ],
    );

    await updateAgentFamilyLatestVersion(
      params.familyDid,
      params.version,
      versionDid,
    );

    if (previousVersionDid) {
      const newStatus = params.bumpType === "patch" ? "deprecated" : "degraded";
      await updateAgentVersionStatus(previousVersionDid, newStatus);

      await client.query(
        `UPDATE did_documents SET document = jsonb_set(
           document,
           '{service,0,status}',
           $1::jsonb
         ) WHERE did = $2`,
        [JSON.stringify(newStatus), previousVersionDid],
      );
    }

    await client.query(
      `INSERT INTO agent_changelogs (family_did, version, summary, details, migration_guide)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        params.familyDid,
        params.version,
        params.changelog.summary,
        JSON.stringify(params.changelog.details ?? {}),
        params.changelog.migrationGuide
          ? JSON.stringify(params.changelog.migrationGuide)
          : null,
      ],
    );

    await client.query("COMMIT");

    await redis.del(`did:resolve:${params.familyDid}`);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  return { versionDid, contentHash };
}

export async function getAgentFamily(
  familyDid: string,
): Promise<AgentFamilyRow | null> {
  return findAgentFamilyByFamilyDid(familyDid);
}

export async function getAgentVersion(
  versionDid: string,
): Promise<AgentVersionRow | null> {
  return findAgentVersionByVersionDid(versionDid);
}

export async function getAgentVersions(
  familyDid: string,
): Promise<AgentVersionRow[]> {
  return findAgentVersionsByFamily(familyDid);
}
