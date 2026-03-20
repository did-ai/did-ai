import { sha256 } from "@noble/hashes/sha256";
import { encode58 } from "./base58.js";

export function deriveSaid(publicKeyBytes: Uint8Array): string {
  const hash = sha256(publicKeyBytes);
  const multihash = new Uint8Array(34);
  multihash[0] = 0x12;
  multihash[1] = 0x20;
  multihash.set(hash, 2);
  return encode58(multihash);
}

export function verifySaid(publicKeyBytes: Uint8Array, said: string): boolean {
  const derived = deriveSaid(publicKeyBytes);
  return derived === said;
}
