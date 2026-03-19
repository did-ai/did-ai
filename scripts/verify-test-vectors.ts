import {
  generateEd25519KeyPair,
  generateX25519KeyPair,
  generateDid,
  sha256hex,
  encodeMultibase,
  ED25519_PREFIX,
} from "../src/crypto/keys.js";
import { signPayload, verifySignature } from "../src/crypto/signing.js";
import canonicalize from "canonicalize";
import { ed25519 } from "@noble/curves/ed25519";
import { x25519 } from "@noble/curves/ed25519";

const X25519_PREFIX = new Uint8Array([0xec, 0x01]);

console.log("=== Verifying ALL Test Vectors from spec-release-fix.md ===\n");

// Test private keys from the spec
const SIGNING_PRIVATE_KEY =
  "81b8668ddd9ea06b398430d37c0c0f79e3d60e0ec8b38495929e4c6e63cb8587";
const ROTATION_PRIVATE_KEY =
  "081387aa82e713a18e6208f195d3e95c1e28b0b9b814c3969c4e863e93ef9e1a";
const X25519_PRIVATE_KEY =
  "6f40266e2c9da99ba7e98361d4af4ddb5896e6b407f132f7fcb9853002fd25b2";

const results: { name: string; passed: boolean; details: string }[] = [];

// ===== C.2 Signing Key Multibase Encoding =====
console.log("C.2: Signing Key Multibase Encoding");
const signingKeyBytes = new Uint8Array(
  SIGNING_PRIVATE_KEY.match(/.{1,2}/g)?.map((b) => parseInt(b, 16)) || [],
);
const signingPublicKey = ed25519.getPublicKey(signingKeyBytes);
const signingPubKeyMultibase = encodeMultibase(
  ED25519_PREFIX,
  signingPublicKey,
);
const expectedSigningPubKey =
  "z6Mkg4i8vwbjHJL5MqqzfRWRgUGgR3YTbo2MiG14kskteSyt";
const c2Passed = signingPubKeyMultibase === expectedSigningPubKey;
results.push({
  name: "C.2 Signing Key",
  passed: c2Passed,
  details: signingPubKeyMultibase,
});
console.log(`  ${c2Passed ? "✓ PASS" : "✗ FAIL"}: ${signingPubKeyMultibase}`);
console.log();

// ===== C.3 Rotation Key Multibase Encoding =====
console.log("C.3: Rotation Key Multibase Encoding");
const rotationKeyBytes = new Uint8Array(
  ROTATION_PRIVATE_KEY.match(/.{1,2}/g)?.map((b) => parseInt(b, 16)) || [],
);
const rotationPublicKey = ed25519.getPublicKey(rotationKeyBytes);
const rotationPubKeyMultibase = encodeMultibase(
  ED25519_PREFIX,
  rotationPublicKey,
);
const expectedRotationPubKey =
  "z6MkfxU4sa5RH9hgKHaAZm9X8rBXeCpFNwzh112orPPy24Um";
const c3Passed = rotationPubKeyMultibase === expectedRotationPubKey;
results.push({
  name: "C.3 Rotation Key",
  passed: c3Passed,
  details: rotationPubKeyMultibase,
});
console.log(`  ${c3Passed ? "✓ PASS" : "✗ FAIL"}: ${rotationPubKeyMultibase}`);
console.log();

// ===== C.4 contentHash Calculation =====
console.log("C.4: contentHash Calculation");
const skillContent = {
  system_prompt: "You are a TypeScript code review expert.",
  input_schema: {
    type: "object",
    properties: { code: { type: "string" } },
    required: ["code"],
  },
  output_schema: {
    type: "object",
    properties: {
      issues: { type: "array" },
      score: { type: "number" },
    },
    required: ["issues", "score"],
  },
  test_cases: [],
  version: "2.1.0",
  family_did: "did:ai:skill:hub:mXn2pLqRt7vWkYjBc3D",
};

const canonicalContent = canonicalize(skillContent)!;
const contentHash = sha256hex(canonicalContent);
const expectedContentHash =
  "a34a5a2525cef552d3537bf3b5d13dd04d073339d0a19898f3ed75d8d0b0741e";
const c4Passed = contentHash === expectedContentHash;
results.push({
  name: "C.4 contentHash",
  passed: c4Passed,
  details: contentHash,
});
console.log(`  ${c4Passed ? "✓ PASS" : "✗ FAIL"}: ${contentHash}`);
console.log();

// ===== C.5 creatorSig Calculation =====
console.log("C.5: creatorSig Calculation");
const creatorSig = signPayload(contentHash, SIGNING_PRIVATE_KEY);
const expectedCreatorSig =
  "z51itHZ6xMSRWt4gcbbZSqbyK3Ldajdqex469CQM4hPFqBYFsaCyHEF1RP2ep4QQEgXqauKC6HPAiPeMDE7z9rYJ3";
const c5Passed = creatorSig === expectedCreatorSig;
results.push({ name: "C.5 creatorSig", passed: c5Passed, details: creatorSig });
console.log(`  ${c5Passed ? "✓ PASS" : "✗ FAIL"}: ${creatorSig}`);
console.log();

// ===== C.6 DID Auth Signature Payload =====
console.log("C.6: DID Auth Signature Payload");
const testDid = "did:ai:dev:hub:T9alXYnUjX1zw-ANaZiAIG";
const body = '{"name":"Test Skill"}';
const bodyHash = sha256hex(body);

const authPayload = {
  did: testDid,
  nonce: "abc123nonce456",
  timestamp: 1710720000,
  method: "POST",
  path: "/api/v1/skills",
  bodyHash: bodyHash,
};

const canonicalAuthPayload = canonicalize(authPayload)!;
const authSig = signPayload(canonicalAuthPayload, SIGNING_PRIVATE_KEY);
const expectedAuthSig =
  "z2AfGMQ797NVShEWKQRttRtr2SoQGtneBnAeh78iQmjoXm51M1xyq943JQ9pRbBUhGf6Q7s6nmUUEkSGiqvvg1bBs";
const c6Passed = authSig === expectedAuthSig;
results.push({ name: "C.6 DID Auth", passed: c6Passed, details: authSig });
console.log(`  ${c6Passed ? "✓ PASS" : "✗ FAIL"}: ${authSig}`);
console.log();

// ===== C.9 X25519 Key (Platform Encryption) =====
console.log("C.9: X25519 Key (Platform Encryption)");
const x25519KeyBytes = new Uint8Array(
  X25519_PRIVATE_KEY.match(/.{1,2}/g)?.map((b) => parseInt(b, 16)) || [],
);
const x25519PublicKey = x25519.getPublicKey(x25519KeyBytes);
const x25519PubKeyMultibase = encodeMultibase(X25519_PREFIX, x25519PublicKey);
const expectedX25519PubKey = "z6LSmMYGUgKMouhtg2CJLfDGrjx7wNyNhZTGD67tgLoPNJru";
const c9Passed = x25519PubKeyMultibase === expectedX25519PubKey;
results.push({
  name: "C.9 X25519 Key",
  passed: c9Passed,
  details: x25519PubKeyMultibase,
});
console.log(`  ${c9Passed ? "✓ PASS" : "✗ FAIL"}: ${x25519PubKeyMultibase}`);
console.log();

// ===== C.7 & C.8 require database =====
// C.1 is random (nanoid) - cannot verify deterministically

console.log("=== Verification Summary ===");
const passed = results.filter((r) => r.passed).length;
const total = results.length;
console.log(`Passed: ${passed}/${total}\n`);

results.forEach((r) => {
  console.log(`  ${r.passed ? "✓" : "✗"} ${r.name}: ${r.details}`);
});

console.log("\n=== Unverified (require database or random) ===");
console.log("  - C.1: Developer DID (nanoid generates random IDs)");
console.log("  - C.7: DID URL Fragment Resolution (requires DID in database)");
console.log("  - C.8: Version Query Resolution (requires version in database)");

// Final verification - signature verification
console.log("\n=== Final Signature Verification ===");
const signatureValid = verifySignature(
  contentHash,
  creatorSig,
  signingPubKeyMultibase,
);
console.log(`creatorSig verification: ${signatureValid ? "✓ PASS" : "✗ FAIL"}`);
