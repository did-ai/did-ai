import canonicalize from "canonicalize";
import { pool } from "../config/database.js";
import { redis } from "../config/redis.js";
import { generateDid, sha256hex } from "../crypto/keys.js";
import { verifySignature } from "../crypto/signing.js";
import {
  buildDidDocument,
  buildSkillFamilyService,
  buildSkillVersionService,
  buildVersionListService,
} from "../builders/did-document.builder.js";
import { DidAiError, ErrorCode } from "../errors/index.js";
import { isReservedNamespace } from "../config/namespaces.js";
import {
  findSkillFamilyByFamilyDid,
  updateSkillFamilyLatestVersion,
  findSkillVersionByVersionDid,
  findActiveSkillVersion,
  findSkillVersionsByFamily,
  updateSkillVersionStatus,
  type SkillFamilyRow,
  type SkillVersionRow,
} from "../db/queries/skill.queries.js";
import { findDidByDid } from "../db/queries/did.queries.js";

export interface SkillContent {
  system_prompt: string;
  input_schema: object;
  output_schema: object;
  test_cases: object[];
  version: string;
  family_did: string;
}

export function computeContentHash(content: SkillContent): string {
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

export async function createSkillFamily(params: {
  ownerDid: string;
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
  namespace: string;
}): Promise<{ familyDid: string }> {
  if (isReservedNamespace(params.namespace)) {
    throw new DidAiError(
      ErrorCode.NAMESPACE_RESERVED,
      `Namespace '${params.namespace}' is reserved`,
    );
  }

  const familyDid = generateDid("skill", params.namespace);
  const shortId = familyDid.split(":").pop()!;

  const document = buildDidDocument({
    did: familyDid,
    subtype: "family",
    controller: params.ownerDid,
    services: [
      buildSkillFamilyService({
        familyDid,
        name: params.name,
        description: params.description,
        category: params.category,
        tags: params.tags,
      }),
      buildVersionListService({
        familyDid,
        type: "skill",
        versions: [],
      }),
    ],
  });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO did_documents
       (did, type, subtype, namespace, unique_id, document, status)
       VALUES ($1, 'skill', 'family', $2, $3, $4, 'active')`,
      [familyDid, params.namespace, shortId, JSON.stringify(document)],
    );

    const didRow = await client.query(
      "SELECT id FROM did_documents WHERE did = $1",
      [familyDid],
    );

    await client.query(
      `INSERT INTO skill_families
       (did_id, family_did, owner_did, name, description, category, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        didRow.rows[0].id,
        familyDid,
        params.ownerDid,
        params.name,
        params.description ?? null,
        params.category ?? null,
        params.tags ?? [],
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

export async function publishSkillVersion(params: {
  familyDid: string;
  ownerDid: string;
  version: string;
  bumpType: "patch" | "minor" | "major";
  content: SkillContent;
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

  const family = await findSkillFamilyByFamilyDid(params.familyDid);
  if (!family) {
    throw new DidAiError(
      ErrorCode.FAMILY_NOT_FOUND,
      `Skill family not found: ${params.familyDid}`,
    );
  }
  if (family.owner_did !== params.ownerDid) {
    throw new DidAiError(
      ErrorCode.AUTH_REQUIRED,
      "Only the owner can publish versions",
    );
  }

  const contentHash = computeContentHash(params.content);
  const signingKey = await getOwnerSigningKey(params.ownerDid);
  if (!verifySignature(contentHash, params.creatorSig, signingKey)) {
    throw new DidAiError(
      ErrorCode.INVALID_SIGNATURE,
      "creatorSig verification failed",
    );
  }

  const versionDid = generateDid("skill", params.namespace);
  const shortId = versionDid.split(":").pop()!;

  const prevVersion = await findActiveSkillVersion(params.familyDid);
  const previousVersion = prevVersion?.version ?? null;
  const previousVersionDid = prevVersion?.version_did ?? null;

  const document = buildDidDocument({
    did: versionDid,
    subtype: "version",
    controller: params.ownerDid,
    services: [
      buildSkillVersionService({
        versionDid,
        familyDid: params.familyDid,
        version: params.version,
        bumpType: params.bumpType,
        status: "active",
        previousVersion: previousVersion ?? undefined,
        inputSchema: params.content.input_schema,
        outputSchema: params.content.output_schema,
        contentHash,
        creatorSig: params.creatorSig,
      }),
    ],
  });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO did_documents
       (did, type, subtype, namespace, unique_id, document, status)
       VALUES ($1, 'skill', 'version', $2, $3, $4, 'active')`,
      [versionDid, params.namespace, shortId, JSON.stringify(document)],
    );

    const didRow = await client.query(
      "SELECT id FROM did_documents WHERE did = $1",
      [versionDid],
    );

    await client.query(
      `INSERT INTO skill_versions
       (did_id, version_did, family_id, family_did, version, bump_type,
        previous_version_did, input_schema, output_schema,
        content_hash, creator_sig, content_plaintext)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        didRow.rows[0].id,
        versionDid,
        family.id,
        params.familyDid,
        params.version,
        params.bumpType,
        previousVersionDid ?? undefined,
        JSON.stringify(params.content.input_schema),
        JSON.stringify(params.content.output_schema),
        contentHash,
        params.creatorSig,
        JSON.stringify(params.content),
      ],
    );

    await updateSkillFamilyLatestVersion(
      params.familyDid,
      params.version,
      versionDid,
    );

    if (previousVersionDid) {
      const newStatus = params.bumpType === "patch" ? "deprecated" : "degraded";
      await updateSkillVersionStatus(previousVersionDid, newStatus);

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
      `INSERT INTO skill_changelogs (family_did, version, summary, details, migration_guide)
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

export async function getSkillFamily(
  familyDid: string,
): Promise<SkillFamilyRow | null> {
  return findSkillFamilyByFamilyDid(familyDid);
}

export async function getSkillVersion(
  versionDid: string,
): Promise<SkillVersionRow | null> {
  return findSkillVersionByVersionDid(versionDid);
}

export async function getSkillVersions(
  familyDid: string,
): Promise<SkillVersionRow[]> {
  return findSkillVersionsByFamily(familyDid);
}

export async function getSkillContent(
  familyDid: string,
): Promise<object | null> {
  const activeVersion = await findActiveSkillVersion(familyDid);
  if (!activeVersion) {
    return null;
  }
  return activeVersion.content_plaintext ?? null;
}

export async function getSkillChangelog(
  familyDid: string,
  version: string,
): Promise<{
  summary: string;
  details: object;
  migration_guide: object | null;
} | null> {
  const result = await pool.query(
    `SELECT summary, details, migration_guide FROM skill_changelogs
     WHERE family_did = $1 AND version = $2`,
    [familyDid, version],
  );
  return result.rows[0] ?? null;
}
