import { ed25519 } from "@noble/curves/ed25519";
import { hexToBytes } from "@noble/hashes/utils";
import { encode58, decode58 } from "./base58.js";

export function signPayload(payload: string, privateKeyHex: string): string {
  const msgBytes = new TextEncoder().encode(payload);
  const privBytes = hexToBytes(privateKeyHex);
  const sig = ed25519.sign(msgBytes, privBytes);
  return "z" + encode58(new Uint8Array(sig));
}

export function verifySignature(
  payload: string,
  signatureMultibase: string,
  publicKeyMultibase: string,
): boolean {
  try {
    const sigBytes = decode58(signatureMultibase.slice(1));
    const pubDecoded = decodeMultibaseEd25519(publicKeyMultibase);
    const msgBytes = new TextEncoder().encode(payload);
    return ed25519.verify(sigBytes, msgBytes, pubDecoded);
  } catch {
    return false;
  }
}

function decodeMultibaseEd25519(multibase: string): Uint8Array {
  const decoded = decode58(multibase.slice(1));
  return decoded.slice(2);
}
