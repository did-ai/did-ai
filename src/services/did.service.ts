import { pool } from "../config/database.js";
import { redis } from "../config/redis.js";
import { CACHE_TTL } from "../config/cache-ttl.js";
import {
  buildDidDocument,
  buildDeveloperProfileService,
  buildPublishedAssetsService,
} from "../builders/did-document.builder.js";
import { generateDid } from "../crypto/keys.js";
import { DidAiError, ErrorCode } from "../errors/index.js";
import { validateKeySeparation } from "../validators/constraints.js";
import { parseDidUrl } from "../utils/did-url.js";
import {
  findSkillFamilyByFamilyDid,
  findSkillVersionByVersion,
} from "../db/queries/skill.queries.js";
import {
  findAgentFamilyByFamilyDid,
  findAgentVersionByVersion,
} from "../db/queries/agent.queries.js";

export interface ResolveDidOptions {
  version?: string;
  service?: string;
  fragment?: string;
}

export async function resolveDid(
  did: string,
  options: ResolveDidOptions = {},
): Promise<object> {
  const parsed = parseDidUrl(did);
  const cleanDid = parsed.did;
  const queryVersion = options.version ?? parsed.query.version;
  const queryService = options.service ?? parsed.query.service;
  const queryFragment = options.fragment ?? parsed.fragment;
  const cacheKey = `did:resolve:${cleanDid}`;

  const cached = await redis.get(cacheKey);
  if (cached && !queryVersion && !queryFragment) {
    return JSON.parse(cached);
  }

  const result = await pool.query(
    `SELECT document, status, type, created_at, updated_at FROM did_documents WHERE did = $1`,
    [cleanDid],
  );
  if (!result.rows[0]) {
    throw new DidAiError(ErrorCode.DID_NOT_FOUND, `DID not found: ${cleanDid}`);
  }
  if (result.rows[0].status === "deactivated") {
    throw new DidAiError(ErrorCode.DID_DEACTIVATED, "DID is deactivated");
  }

  const doc = result.rows[0].document as {
    service?: object[];
    verificationMethod?: object[];
    created?: string;
    updated?: string;
  };
  const didType = result.rows[0].type;

  if (queryVersion && didType === "skill") {
    const versionInfo = await resolveSkillVersionInfo(cleanDid, queryVersion);
    return versionInfo;
  }

  if (queryVersion && didType === "agent") {
    const versionInfo = await resolveAgentVersionInfo(cleanDid, queryVersion);
    return versionInfo;
  }

  if (queryService) {
    const service = doc.service?.find(
      (s: object) => (s as { id?: string }).id === queryService,
    );
    if (service) {
      return {
        serviceEndpoint: (service as { serviceEndpoint?: string })
          .serviceEndpoint,
      };
    }
  }

  if (queryFragment) {
    const fragmentId = `${cleanDid}#${queryFragment}`;
    if (doc.verificationMethod) {
      const vm = (doc.verificationMethod as object[]).find(
        (m: object) => (m as { id?: string }).id === fragmentId,
      );
      if (vm) return vm;
    }
    const service = doc.service?.find(
      (s: object) => (s as { id?: string }).id === fragmentId,
    );
    if (service) return service;
  }

  await redis.setex(cacheKey, CACHE_TTL.DID_RESOLVE, JSON.stringify(doc));
  return doc;
}

async function resolveSkillVersionInfo(
  familyDid: string,
  version: string,
): Promise<object> {
  const versionRow = await findSkillVersionByVersion(familyDid, version);

  if (!versionRow) {
    throw new DidAiError(
      ErrorCode.VERSION_NOT_FOUND,
      `Version ${version} not found for ${familyDid}`,
    );
  }

  if (versionRow.status === "deprecated") {
    throw new DidAiError(
      ErrorCode.VERSION_NOT_FOUND,
      `Version ${version} is deprecated`,
    );
  }

  const familyRow = await findSkillFamilyByFamilyDid(familyDid);
  if (!familyRow) {
    throw new DidAiError(
      ErrorCode.FAMILY_NOT_FOUND,
      `Family not found: ${familyDid}`,
    );
  }

  const inputSchema = versionRow.input_schema
    ? JSON.parse(JSON.stringify(versionRow.input_schema))
    : {};
  const outputSchema = versionRow.output_schema
    ? JSON.parse(JSON.stringify(versionRow.output_schema))
    : {};
  const toolDeclarations = versionRow.tool_declarations
    ? JSON.parse(JSON.stringify(versionRow.tool_declarations))
    : undefined;
  const contentPlaintext = versionRow.content_plaintext
    ? JSON.parse(JSON.stringify(versionRow.content_plaintext))
    : undefined;

  return {
    "@context": "https://did-ai.io/contexts/v1",
    type: "VersionInfo",
    familyDid,
    version: versionRow.version,
    status: versionRow.status,
    contentHash: versionRow.content_hash,
    creatorSig: versionRow.creator_sig,
    inputSchema,
    outputSchema,
    ...(versionRow.execution_mode && {
      executionMode: versionRow.execution_mode,
    }),
    ...(toolDeclarations && { toolDeclarations }),
    ...(contentPlaintext && { content: contentPlaintext }),
  };
}

async function resolveAgentVersionInfo(
  familyDid: string,
  version: string,
): Promise<object> {
  const versionRow = await findAgentVersionByVersion(familyDid, version);

  if (!versionRow) {
    throw new DidAiError(
      ErrorCode.VERSION_NOT_FOUND,
      `Version ${version} not found for ${familyDid}`,
    );
  }

  if (versionRow.status === "deprecated") {
    throw new DidAiError(
      ErrorCode.VERSION_NOT_FOUND,
      `Version ${version} is deprecated`,
    );
  }

  const familyRow = await findAgentFamilyByFamilyDid(familyDid);
  if (!familyRow) {
    throw new DidAiError(
      ErrorCode.FAMILY_NOT_FOUND,
      `Family not found: ${familyDid}`,
    );
  }

  const inputSchema = versionRow.input_schema
    ? JSON.parse(JSON.stringify(versionRow.input_schema))
    : {};
  const outputSchema = versionRow.output_schema
    ? JSON.parse(JSON.stringify(versionRow.output_schema))
    : {};
  const toolDeclarations = versionRow.tool_declarations
    ? JSON.parse(JSON.stringify(versionRow.tool_declarations))
    : undefined;
  const contentPlaintext = versionRow.content_plaintext
    ? JSON.parse(JSON.stringify(versionRow.content_plaintext))
    : undefined;

  return {
    "@context": "https://did-ai.io/contexts/v1",
    type: "VersionInfo",
    familyDid,
    version: versionRow.version,
    status: versionRow.status,
    contentHash: versionRow.content_hash,
    creatorSig: versionRow.creator_sig,
    inputSchema,
    outputSchema,
    ...(versionRow.execution_mode && {
      executionMode: versionRow.execution_mode,
    }),
    ...(toolDeclarations && { toolDeclarations }),
    ...(versionRow.skill_bindings && {
      skillBindings: versionRow.skill_bindings,
    }),
    ...(versionRow.orchestration_mode && {
      orchestrationMode: versionRow.orchestration_mode,
    }),
    ...(versionRow.orchestration_flow && {
      orchestrationFlow: versionRow.orchestration_flow,
    }),
    ...(versionRow.aggregated_tools && {
      aggregatedTools: versionRow.aggregated_tools,
    }),
    ...(contentPlaintext && { content: contentPlaintext }),
  };
}

export async function invalidateDidCache(did: string): Promise<void> {
  await redis.del(`did:resolve:${did}`);
}

export async function deactivateDid(
  did: string,
  callerDid: string,
): Promise<void> {
  const result = await pool.query(
    `SELECT document, status, controller FROM did_documents WHERE did = $1`,
    [did],
  );
  if (!result.rows[0]) {
    throw new DidAiError(ErrorCode.DID_NOT_FOUND, `DID not found: ${did}`);
  }
  if (result.rows[0].status === "deactivated") {
    throw new DidAiError(
      ErrorCode.DID_DEACTIVATED,
      "DID is already deactivated",
    );
  }

  const doc = result.rows[0].document;
  const controller = (doc as { controller?: string }).controller;
  if (controller !== callerDid) {
    throw new DidAiError(
      ErrorCode.AUTH_REQUIRED,
      "Only the controller can deactivate a DID",
    );
  }

  const updatedDoc = {
    ...doc,
    deactivated: true,
  };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE did_documents
       SET status = 'deactivated', document = $1, updated_at = now()
       WHERE did = $2`,
      [JSON.stringify(updatedDoc), did],
    );
    await client.query(
      `INSERT INTO did_versions (did_id, did, version_num, document, changed_by)
       SELECT id, $1, COALESCE(MAX(version_num), 0) + 1, $2, $3
       FROM did_documents WHERE did = $1
       GROUP BY id`,
      [did, JSON.stringify(doc), callerDid],
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  await invalidateDidCache(did);
}

export async function createDeveloperDid(params: {
  signingKeyMultibase: string;
  rotationKeyMultibase: string;
  namespace: string;
  displayName: string;
  bio?: string;
  links?: Record<string, string>;
}): Promise<{ did: string; document: object }> {
  const did = generateDid("dev", params.namespace);
  const shortId = did.split(":").pop()!;

  const document = buildDidDocument({
    did,
    subtype: "identity",
    controller: did,
    signingKeyMultibase: params.signingKeyMultibase,
    rotationKeyMultibase: params.rotationKeyMultibase,
    services: [
      buildDeveloperProfileService({
        did,
        shortId,
        displayName: params.displayName,
        bio: params.bio,
        links: params.links,
      }),
      buildPublishedAssetsService({ did, shortId }),
    ],
  });

  validateKeySeparation(
    document as Parameters<typeof validateKeySeparation>[0],
  );

  await pool.query(
    `INSERT INTO did_documents
     (did, type, subtype, namespace, unique_id, document, status)
     VALUES ($1, 'dev', 'identity', $2, $3, $4, 'active')`,
    [did, params.namespace, shortId, JSON.stringify(document)],
  );

  return { did, document };
}

export async function updateDeveloperDid(
  did: string,
  callerDid: string,
  updates: {
    displayName?: string;
    bio?: string;
    links?: Record<string, string>;
  },
): Promise<void> {
  const result = await pool.query(
    `SELECT document, status FROM did_documents WHERE did = $1`,
    [did],
  );
  if (!result.rows[0]) {
    throw new DidAiError(ErrorCode.DID_NOT_FOUND, `DID not found: ${did}`);
  }
  if (result.rows[0].status !== "active") {
    throw new DidAiError(
      ErrorCode.DID_DEACTIVATED,
      "Cannot update deactivated DID",
    );
  }

  const doc = result.rows[0].document as {
    controller?: string;
    service?: object[];
  };
  if (doc.controller !== callerDid) {
    throw new DidAiError(
      ErrorCode.AUTH_REQUIRED,
      "Only the controller can update a DID",
    );
  }

  const oldDoc = { ...doc };
  const services = doc.service ?? [];
  const profileService = services.find((s: object) =>
    (s as { id?: string }).id?.endsWith("#profile"),
  );
  if (profileService) {
    Object.assign(profileService, {
      displayName:
        updates.displayName ??
        (profileService as { displayName?: string }).displayName,
      bio: updates.bio ?? (profileService as { bio?: string }).bio,
      links:
        updates.links ??
        (profileService as { links?: Record<string, string> }).links,
    });
  }

  const updatedDoc = {
    ...doc,
    updated: new Date().toISOString(),
  };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE did_documents SET document = $1, updated_at = now() WHERE did = $2`,
      [JSON.stringify(updatedDoc), did],
    );
    await client.query(
      `INSERT INTO did_versions (did_id, did, version_num, document, changed_by)
       SELECT id, $1, COALESCE(MAX(version_num), 0) + 1, $2, $3
       FROM did_documents WHERE did = $1
       GROUP BY id`,
      [did, JSON.stringify(oldDoc), callerDid],
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  await invalidateDidCache(did);
}

export async function getDidVersionHistory(did: string): Promise<object[]> {
  const result = await pool.query(
    `SELECT document FROM did_versions WHERE did = $1 ORDER BY version_num DESC`,
    [did],
  );
  return result.rows.map((r) => r.document);
}

export async function rotateSigningKey(params: {
  did: string;
  newSigningKeyMultibase: string;
  rotationKeySignature: string;
  callerDid: string;
}): Promise<void> {
  const result = await pool.query(
    `SELECT document, status FROM did_documents WHERE did = $1`,
    [params.did],
  );
  if (!result.rows[0]) {
    throw new DidAiError(
      ErrorCode.DID_NOT_FOUND,
      `DID not found: ${params.did}`,
    );
  }
  if (result.rows[0].status !== "active") {
    throw new DidAiError(
      ErrorCode.DID_DEACTIVATED,
      "Cannot rotate key for deactivated DID",
    );
  }

  const doc = result.rows[0].document as {
    controller?: string;
    verificationMethod?: object[];
  };
  if (doc.controller !== params.callerDid) {
    throw new DidAiError(
      ErrorCode.AUTH_REQUIRED,
      "Only the controller can rotate keys",
    );
  }

  const oldDoc = { ...doc };
  const vmList = doc.verificationMethod ?? [];
  const signingVmIndex = vmList.findIndex((vm: object) =>
    (vm as { id?: string }).id?.endsWith("#signing-key"),
  );
  if (signingVmIndex >= 0) {
    (
      vmList[signingVmIndex] as { publicKeyMultibase: string }
    ).publicKeyMultibase = params.newSigningKeyMultibase;
  }

  const updatedDoc = {
    ...doc,
    updated: new Date().toISOString(),
  };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE did_documents SET document = $1, updated_at = now() WHERE did = $2`,
      [JSON.stringify(updatedDoc), params.did],
    );
    await client.query(
      `INSERT INTO did_versions (did_id, did, version_num, document, changed_by)
       SELECT id, $1, COALESCE(MAX(version_num), 0) + 1, $2, $3
       FROM did_documents WHERE did = $1
       GROUP BY id`,
      [params.did, JSON.stringify(oldDoc), params.callerDid],
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  await invalidateDidCache(params.did);
}
