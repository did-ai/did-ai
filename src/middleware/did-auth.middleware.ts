import type { FastifyRequest, FastifyReply } from "fastify";
import canonicalize from "canonicalize";
import { redis } from "../config/redis.js";
import { pool } from "../config/database.js";
import { config } from "../config/index.js";
import { verifySignature } from "../crypto/signing.js";
import { sha256hex } from "../crypto/keys.js";
import { parseDidUrl } from "../utils/did-url.js";
import { DidAiError, ErrorCode } from "../errors/index.js";

interface DIDAuthHeader {
  did: string;
  nonce: string;
  timestamp: string;
  sig: string;
}

function extractField(input: string, fieldName: string): string | undefined {
  const regex = new RegExp(`${fieldName}="([^"]*)"`, "i");
  const match = input.match(regex);
  return match?.[1];
}

function parseDIDAuthHeader(header: string): DIDAuthHeader {
  const body = header.replace(/^DIDAuth\s+/, "");

  const did = extractField(body, "did");
  const nonce = extractField(body, "nonce");
  const timestamp = extractField(body, "timestamp");
  const sig = extractField(body, "sig");

  if (!did || !nonce || !timestamp || !sig) {
    throw new DidAiError(
      ErrorCode.AUTH_REQUIRED,
      "Invalid DID Auth header format",
    );
  }

  return {
    did,
    nonce,
    timestamp,
    sig,
  };
}

export async function didAuthMiddleware(
  req: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("DIDAuth ")) {
    throw new DidAiError(ErrorCode.AUTH_REQUIRED, "DID Auth required");
  }

  const { did, nonce, timestamp, sig } = parseDIDAuthHeader(authHeader);

  const now = Date.now();
  const ts = new Date(timestamp).getTime();
  if (isNaN(ts) || Math.abs(now - ts) > 5 * 60 * 1000) {
    throw new DidAiError(
      ErrorCode.TIMESTAMP_EXPIRED,
      "Timestamp outside allowed window",
    );
  }

  const nonceKey = `auth:nonce:${nonce}`;
  const isNew = await redis.set(nonceKey, "1", "EX", 600, "NX");
  if (!isNew) {
    throw new DidAiError(ErrorCode.NONCE_REPLAYED, "Nonce already used");
  }

  const parsedDid = parseDidUrl(did);
  const subjectType = parsedDid.components.subjectType;

  if (parsedDid.components.networkId !== config.vdrNetworkId) {
    throw new DidAiError(
      ErrorCode.NETWORK_ID_MISMATCH,
      `DID network ${parsedDid.components.networkId} does not match VDR network ${config.vdrNetworkId}`,
    );
  }

  const result = await pool.query(
    `SELECT document, status, controller FROM did_documents WHERE did = $1`,
    [did],
  );
  if (!result.rows[0]) {
    throw new DidAiError(ErrorCode.DID_NOT_FOUND, `DID not found: ${did}`);
  }
  if (result.rows[0].status !== "active") {
    throw new DidAiError(ErrorCode.DID_DEACTIVATED, "DID is deactivated");
  }

  const doc = result.rows[0].document as {
    controller?: string;
    verificationMethod?: Array<{ id: string; publicKeyMultibase: string }>;
    assertionMethod?: string[];
  };

  let verificationKey: string;

  if (subjectType === "dev") {
    const signingKey = doc.verificationMethod?.find((vm) =>
      doc.assertionMethod?.includes(vm.id),
    );
    if (!signingKey) {
      throw new DidAiError(
        ErrorCode.INVALID_SIGNATURE,
        "No signing key in DID Document",
      );
    }
    verificationKey = signingKey.publicKeyMultibase;
  } else {
    const controllerDid = doc.controller;
    if (!controllerDid) {
      throw new DidAiError(
        ErrorCode.INVALID_SIGNATURE,
        "No controller defined for Skill/Agent DID",
      );
    }

    const controllerParsed = parseDidUrl(controllerDid);
    if (
      controllerParsed.components.networkId !== parsedDid.components.networkId
    ) {
      throw new DidAiError(
        ErrorCode.CROSS_NETWORK_REFERENCE,
        "Controller must be on the same network",
      );
    }

    const controllerResult = await pool.query(
      `SELECT document, status FROM did_documents WHERE did = $1`,
      [controllerDid],
    );
    if (!controllerResult.rows[0]) {
      throw new DidAiError(
        ErrorCode.DID_NOT_FOUND,
        `Controller DID not found: ${controllerDid}`,
      );
    }
    if (controllerResult.rows[0].status !== "active") {
      throw new DidAiError(
        ErrorCode.DID_DEACTIVATED,
        "Controller DID is deactivated",
      );
    }

    const controllerDoc = controllerResult.rows[0].document as {
      verificationMethod?: Array<{ id: string; publicKeyMultibase: string }>;
      assertionMethod?: string[];
    };
    const controllerSigningKey = controllerDoc.verificationMethod?.find((vm) =>
      controllerDoc.assertionMethod?.includes(vm.id),
    );
    if (!controllerSigningKey) {
      throw new DidAiError(
        ErrorCode.INVALID_SIGNATURE,
        "No signing key in Controller DID Document",
      );
    }
    verificationKey = controllerSigningKey.publicKeyMultibase;
  }

  const body = (req.body as string | object | undefined) ?? "";
  const path = req.url.split("?")[0];
  const payload = canonicalize({
    did,
    networkId: parsedDid.components.networkId,
    nonce,
    timestamp,
    method: req.method,
    path,
    bodyHash: sha256hex(typeof body === "string" ? body : JSON.stringify(body)),
  })!;

  if (!verifySignature(payload, sig, verificationKey)) {
    throw new DidAiError(
      ErrorCode.INVALID_SIGNATURE,
      "Signature verification failed",
    );
  }

  (req as FastifyRequest & { callerDid: string }).callerDid = did;
}
