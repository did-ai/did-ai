import { ed25519 } from "@noble/curves/ed25519";
import { x25519 } from "@noble/curves/ed25519";
import { nanoid } from "nanoid";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";
import { encode58 } from "./base58.js";

const ED25519_PREFIX = new Uint8Array([0xed, 0x01]);
const X25519_PREFIX = new Uint8Array([0xec, 0x01]);

export function encodeMultibase(prefix: Uint8Array, key: Uint8Array): string {
  const combined = new Uint8Array(prefix.length + key.length);
  combined.set(prefix);
  combined.set(key, prefix.length);
  return "z" + encode58(combined);
}

export function generateEd25519KeyPair() {
  const privateKey = ed25519.utils.randomPrivateKey();
  const publicKey = ed25519.getPublicKey(privateKey);
  return {
    privateKey,
    publicKey,
    publicKeyMultibase: encodeMultibase(ED25519_PREFIX, publicKey),
  };
}

export function generateX25519KeyPair() {
  const privateKey = x25519.utils.randomPrivateKey();
  const publicKey = x25519.getPublicKey(privateKey);
  return {
    privateKey,
    publicKey,
    publicKeyMultibase: encodeMultibase(X25519_PREFIX, publicKey),
  };
}

const NAMESPACE_PATTERN = /^[a-z0-9][a-z0-9-]{0,30}[a-z0-9]$/;

export function generateDid(
  type: "dev" | "skill" | "agent" | "barn" | "platform" | "host",
  namespace = "hub",
): string {
  if (!NAMESPACE_PATTERN.test(namespace)) {
    throw new Error(`Invalid namespace: ${namespace}`);
  }
  return `did:ai:${type}:${namespace}:${nanoid(22)}`;
}

export function sha256hex(data: string): string {
  return bytesToHex(sha256(new TextEncoder().encode(data)));
}
