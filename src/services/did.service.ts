import { pool } from "../config/database.js";
import { redis } from "../config/redis.js";
import { CACHE_TTL } from "../config/cache-ttl.js";
import {
  buildDidDocument,
  buildDeveloperProfileService,
  buildPublishedAssetsService,
} from "../builders/did-document.builder.js";
import { generateDid, decodeMultibase } from "../crypto/keys.js";
import { verifySaid } from "../crypto/said.js";
import { DidAiError, ErrorCode } from "../errors/index.js";
import {
  validateKeySeparation,
  validateSkillAgentConstraints,
} from "../validators/constraints.js";
import { parseDidUrl } from "../utils/did-url.js";
import { isReservedNamespace } from "../config/namespaces.js";
import { buildResolutionResult } from "../types/resolution.js";
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

export async function resolveDid(did: string, options: ResolveDidOptions = {}) {
  const parsed = parseDidUrl(did);
  const cleanDid = parsed.did;
  const queryVersion = options.version ?? parsed.query.version;
  const queryService = options.service ?? parsed.query.service;
  const queryFragment = options.fragment ?? parsed.fragment;

  const result = await pool.query(
    `SELECT document, status, type, created_at, updated_at, version_num 
     FROM did_documents WHERE did = $1`,
    [cleanDid],
  );

  if (!result.rows[0]) {
    return buildResolutionResult(null, "", "", false, {
      error: "notFound",
    });
  }

  const doc = result.rows[0].document as Record<string, unknown>;
  const status = result.rows[0].status;
  const createdAt = result.rows[0].created_at;
  const updatedAt = result.rows[0].updated_at;
  const versionNum = result.rows[0].version_num;

  if (status === "deactivated") {
    return buildResolutionResult(null, createdAt, updatedAt, true, {
      versionId: versionNum?.toString(),
      error: "deactivated",
    });
  }

  const subjectType = parsed.components.subjectType;
  if (subjectType === "dev") {
    const vm = doc.verificationMethod as
      | Array<{
          id: string;
          publicKeyMultibase: string;
        }>
      | undefined;
    const assertionMethod = doc.assertionMethod as string[] | undefined;
    const signingKey = vm?.find((v) => assertionMethod?.includes(v.id));

    if (signingKey) {
      const pubKeyBytes = decodeMultibase(signingKey.publicKeyMultibase);
      const uniqueId = parsed.components.uniqueId;
      if (!verifySaid(pubKeyBytes, uniqueId)) {
        return buildResolutionResult(null, "", "", false, {
          error: "saidMismatch",
        });
      }
    }
  }

  if (queryVersion) {
    const didType = result.rows[0].type;
    if (didType === "skill") {
      const versionInfo = await resolveSkillVersionInfo(cleanDid, queryVersion);
      return buildResolutionResult(versionInfo, createdAt, updatedAt, false, {
        versionId: versionNum?.toString(),
      });
    }
    if (didType === "agent") {
      const versionInfo = await resolveAgentVersionInfo(cleanDid, queryVersion);
      return buildResolutionResult(versionInfo, createdAt, updatedAt, false, {
        versionId: versionNum?.toString(),
      });
    }
  }

  if (queryService) {
    const services = doc.service as Array<{ id?: string }> | undefined;
    const service = services?.find((s) => s.id === queryService);
    if (service) {
      const serviceEndpoint = (service as { serviceEndpoint?: string })
        .serviceEndpoint;
      return buildResolutionResult(
        { serviceEndpoint },
        createdAt,
        updatedAt,
        false,
        { versionId: versionNum?.toString() },
      );
    }
  }

  if (queryFragment) {
    const fragmentId = `${cleanDid}#${queryFragment}`;
    const vm = doc.verificationMethod as Array<{ id?: string }> | undefined;
    const vmEntry = vm?.find((m) => m.id === fragmentId);
    if (vmEntry) {
      return buildResolutionResult(vmEntry, createdAt, updatedAt, false, {
        versionId: versionNum?.toString(),
      });
    }
    const services = doc.service as Array<{ id?: string }> | undefined;
    const serviceEntry = services?.find((s) => s.id === fragmentId);
    if (serviceEntry) {
      return buildResolutionResult(serviceEntry, createdAt, updatedAt, false, {
        versionId: versionNum?.toString(),
      });
    }
  }

  const cacheKey = `did:resolve:${cleanDid}`;
  await redis.setex(cacheKey, CACHE_TTL.DID_RESOLVE, JSON.stringify(doc));

  return buildResolutionResult(doc, createdAt, updatedAt, false, {
    versionId: versionNum?.toString(),
    contentType: "application/did+ld+json",
  });
}

async function resolveSkillVersionInfo(
  familyDid: string,
  version: string,
): Promise<Record<string, unknown>> {
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
): Promise<Record<string, unknown>> {
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

  const doc = result.rows[0].document as Record<string, unknown>;
  const controller = doc.controller as string | undefined;
  if (controller !== callerDid) {
    throw new DidAiError(
      ErrorCode.AUTH_REQUIRED,
      "Only the controller can deactivate a DID",
    );
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE did_documents
       SET status = 'deactivated', document = $1, updated_at = now()
       WHERE did = $2`,
      [JSON.stringify({ ...doc, deactivated: true }), did],
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
  encryptionKeyMultibase?: string;
  networkId: string;
  displayName: string;
  bio?: string;
  links?: Record<string, string>;
}): Promise<{ did: string; document: Record<string, unknown> }> {
  if (isReservedNamespace(params.networkId)) {
    throw new DidAiError(
      ErrorCode.NAMESPACE_RESERVED,
      `Namespace '${params.networkId}' is reserved`,
    );
  }

  const did = generateDid("dev", params.networkId, params.signingKeyMultibase);
  const uniqueId = did.split(":").pop()!;

  const document = buildDidDocument({
    did,
    subtype: "identity",
    controller: did,
    signingKeyMultibase: params.signingKeyMultibase,
    rotationKeyMultibase: params.rotationKeyMultibase,
    encryptionKeyMultibase: params.encryptionKeyMultibase,
    services: [
      buildDeveloperProfileService({
        did,
        shortId: uniqueId,
        displayName: params.displayName,
        bio: params.bio,
        links: params.links,
      }),
      buildPublishedAssetsService({ did, shortId: uniqueId }),
    ],
  }) as Record<string, unknown>;

  validateKeySeparation(
    document as Parameters<typeof validateKeySeparation>[0],
  );

  await pool.query(
    `INSERT INTO did_documents
     (did, type, subtype, namespace, unique_id, document, status)
     VALUES ($1, 'dev', 'identity', $2, $3, $4, 'active')`,
    [did, params.networkId, uniqueId, JSON.stringify(document)],
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

export async function createSkillFamilyDid(params: {
  familyDid: string;
  controllerDid: string;
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
}): Promise<void> {
  const parsed = parseDidUrl(params.controllerDid);
  const networkId = parsed.components.networkId;

  const document = {
    "@context": [
      "https://www.w3.org/ns/did/v1",
      "https://did-ai.io/contexts/v1",
    ],
    id: params.familyDid,
    controller: params.controllerDid,
    service: [
      {
        id: `${params.familyDid}#family`,
        type: "SkillFamily",
        serviceEndpoint: `https://did-ai.io/skills/${networkId}/${parsed.components.uniqueId}`,
        name: params.name,
        description: params.description,
        category: params.category,
        tags: params.tags ?? [],
      },
    ],
  };

  validateSkillAgentConstraints(
    document as Parameters<typeof validateSkillAgentConstraints>[0],
  );

  await pool.query(
    `INSERT INTO did_documents (did, type, subtype, namespace, unique_id, document, status)
     VALUES ($1, 'skill', 'family', $2, $3, $4, 'active')`,
    [
      params.familyDid,
      networkId,
      parsed.components.uniqueId,
      JSON.stringify(document),
    ],
  );
}

export async function createAgentFamilyDid(params: {
  familyDid: string;
  controllerDid: string;
  name: string;
  description?: string;
  tags?: string[];
  visibility: "public" | "unlisted" | "private";
}): Promise<void> {
  const parsed = parseDidUrl(params.controllerDid);
  const networkId = parsed.components.networkId;

  const document = {
    "@context": [
      "https://www.w3.org/ns/did/v1",
      "https://did-ai.io/contexts/v1",
    ],
    id: params.familyDid,
    controller: params.controllerDid,
    service: [
      {
        id: `${params.familyDid}#family`,
        type: "AgentFamily",
        serviceEndpoint: `https://did-ai.io/agents/${networkId}/${parsed.components.uniqueId}`,
        name: params.name,
        description: params.description,
        tags: params.tags ?? [],
        visibility: params.visibility,
      },
    ],
  };

  validateSkillAgentConstraints(
    document as Parameters<typeof validateSkillAgentConstraints>[0],
  );

  await pool.query(
    `INSERT INTO did_documents (did, type, subtype, namespace, unique_id, document, status)
     VALUES ($1, 'agent', 'family', $2, $3, $4, 'active')`,
    [
      params.familyDid,
      networkId,
      parsed.components.uniqueId,
      JSON.stringify(document),
    ],
  );
}
