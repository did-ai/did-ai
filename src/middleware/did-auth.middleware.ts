import type { FastifyRequest, FastifyReply } from "fastify";
import canonicalize from "canonicalize";
import { redis } from "../config/redis.js";
import { pool } from "../config/database.js";
import { verifySignature } from "../crypto/signing.js";
import { sha256hex } from "../crypto/keys.js";
import { DidAiError, ErrorCode } from "../errors/index.js";

interface DIDAuthHeader {
  did: string;
  nonce: string;
  timestamp: number;
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
    timestamp: parseInt(timestamp, 10),
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

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > 300) {
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

  const result = await pool.query(
    `SELECT document, status FROM did_documents WHERE did = $1`,
    [did],
  );
  if (!result.rows[0]) {
    throw new DidAiError(ErrorCode.DID_NOT_FOUND, `DID not found: ${did}`);
  }
  if (result.rows[0].status !== "active") {
    throw new DidAiError(ErrorCode.DID_DEACTIVATED, "DID is deactivated");
  }

  const doc = result.rows[0].document;
  const signingKey = doc.verificationMethod?.find((vm: { id: string }) =>
    vm.id.endsWith("#signing-key"),
  );
  if (!signingKey) {
    throw new DidAiError(
      ErrorCode.INVALID_SIGNATURE,
      "No signing key in DID Document",
    );
  }

  const body = (req.body as string | object | undefined) ?? "";
  const payload = canonicalize({
    did,
    nonce,
    timestamp,
    method: req.method,
    path: req.url,
    bodyHash: sha256hex(typeof body === "string" ? body : JSON.stringify(body)),
  })!;

  if (!verifySignature(payload, sig, signingKey.publicKeyMultibase)) {
    throw new DidAiError(
      ErrorCode.INVALID_SIGNATURE,
      "Signature verification failed",
    );
  }

  (req as FastifyRequest & { callerDid: string }).callerDid = did;
}
