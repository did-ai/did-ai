import { test, describe, expect } from "vitest";
import {
  generateDid,
  encodeMultibase,
  sha256hex,
  generateEd25519KeyPair,
} from "./keys.js";
import { signPayload, verifySignature } from "./signing.js";

describe("generateDid", () => {
  test("should generate valid dev DID", () => {
    const did = generateDid("dev", "hub");
    expect(did).toMatch(/^did:ai:dev:hub:[a-zA-Z0-9_-]{22}$/);
  });

  test("should generate valid skill DID", () => {
    const did = generateDid("skill", "test");
    expect(did).toMatch(/^did:ai:skill:test:[a-zA-Z0-9_-]{22}$/);
  });

  test("should generate valid agent DID", () => {
    const did = generateDid("agent", "hub");
    expect(did).toMatch(/^did:ai:agent:hub:[a-zA-Z0-9_-]{22}$/);
  });

  test("should throw on invalid namespace", () => {
    expect(() => generateDid("dev", "")).toThrow();
    expect(() => generateDid("dev", "InvalidNamespace")).toThrow();
    expect(() => generateDid("dev", "-starts-with-hyphen")).toThrow();
    expect(() => generateDid("dev", "ends-with-hyphen-")).toThrow();
  });

  test("should use default namespace hub", () => {
    const did = generateDid("dev");
    expect(did).toMatch(/^did:ai:dev:hub:/);
  });
});

describe("encodeMultibase", () => {
  test("should encode with z prefix", () => {
    const key = new Uint8Array([1, 2, 3, 4, 5]);
    const prefix = new Uint8Array([0xed, 0x01]);
    const result = encodeMultibase(prefix, key);
    expect(result).toMatch(/^z[a-km-zA-HJ-NP-Z1-9]+$/);
  });
});

describe("sha256hex", () => {
  test("should produce hex string", () => {
    const hash = sha256hex("test");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  test("should be deterministic", () => {
    const hash1 = sha256hex("test");
    const hash2 = sha256hex("test");
    expect(hash1).toBe(hash2);
  });
});

describe("signPayload and verifySignature", () => {
  const keyPair = generateEd25519KeyPair();
  const privateKeyHex = Buffer.from(keyPair.privateKey).toString("hex");
  const publicKeyMultibase = keyPair.publicKeyMultibase;

  test("should sign and verify payload", () => {
    const payload = "test payload";
    const signature = signPayload(payload, privateKeyHex);
    expect(signature).toMatch(/^z[a-km-zA-HJ-NP-Z1-9]+$/);

    const isValid = verifySignature(payload, signature, publicKeyMultibase);
    expect(isValid).toBe(true);
  });

  test("should reject invalid signature", () => {
    const payload = "test payload";
    const signature = signPayload("different payload", privateKeyHex);

    const isValid = verifySignature(payload, signature, publicKeyMultibase);
    expect(isValid).toBe(false);
  });

  test("should reject tampered signature", () => {
    const payload = "test payload";
    const signature = signPayload(payload, privateKeyHex);
    const tamperedSig = signature.slice(0, -1) + "x";

    const isValid = verifySignature(payload, tamperedSig, publicKeyMultibase);
    expect(isValid).toBe(false);
  });
});
