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

export async function resolveDid(did: string): Promise<object> {
  const cacheKey = `did:resolve:${did}`;

  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const result = await pool.query(
    `SELECT document, status FROM did_documents WHERE did = $1`,
    [did],
  );
  if (!result.rows[0]) {
    throw new DidAiError(ErrorCode.DID_NOT_FOUND, `DID not found: ${did}`);
  }
  if (result.rows[0].status === "deactivated") {
    throw new DidAiError(ErrorCode.DID_DEACTIVATED, "DID is deactivated");
  }

  const doc = result.rows[0].document;
  await redis.setex(cacheKey, CACHE_TTL.DID_RESOLVE, JSON.stringify(doc));
  return doc;
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
