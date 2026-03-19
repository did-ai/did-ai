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

console.log("=== Verifying Test Vectors from spec-release-fix.md ===\n");

// Use the specific private key from the test vectors
const TEST_PRIVATE_KEY_HEX =
  "81b8668ddd9ea06b398430d37c0c0f79e3d60e0ec8b38495929e4c6e63cb8587";
const TEST_PUBLIC_KEY_HEX =
  "17f084838bebf42121a1159c530adc083259e5855fa34f51130cda24707f5c3f";

const results: { name: string; passed: boolean; details: string }[] = [];

// C.4 contentHash - can verify independently
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
const c4ExpectedHash =
  "a34a5a2525cef552d3537bf3b5d13dd04d073339d0a19898f3ed75d8d0b0741e";
const c4Passed = contentHash === c4ExpectedHash;
results.push({
  name: "C.4 contentHash",
  passed: c4Passed,
  details: contentHash,
});
console.log(`  ${c4Passed ? "✓ PASS" : "✗ FAIL"}: ${contentHash}`);
console.log();

// C.5 creatorSig - using the specific private key
console.log("C.5: creatorSig Calculation");
const expectedCreatorSig =
  "z51itHZ6xMSRWt4gcbbZSqbyK3Ldajdqex469CQM4hPFqBYFsaCyHEF1RP2ep4QQEgXqauKC6HPAiPeMDE7z9rYJ3";
const actualCreatorSig = signPayload(contentHash, TEST_PRIVATE_KEY_HEX);
const c5Passed = actualCreatorSig === expectedCreatorSig;
results.push({
  name: "C.5 creatorSig",
  passed: c5Passed,
  details: actualCreatorSig,
});
console.log(`  ${c5Passed ? "✓ PASS" : "✗ FAIL"}: ${actualCreatorSig}`);
console.log();

// C.6 DID Auth - using the same private key
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
const expectedAuthSig =
  "z2AfGMQ797NVShEWKQRttRtr2SoQGtneBnAeh78iQmjoXm51M1xyq943JQ9pRbBUhGf6Q7s6nmUUEkSGiqvvg1bBs";
const actualAuthSig = signPayload(canonicalAuthPayload, TEST_PRIVATE_KEY_HEX);
const c6Passed = actualAuthSig === expectedAuthSig;
results.push({
  name: "C.6 DID Auth",
  passed: c6Passed,
  details: actualAuthSig,
});
console.log(`  ${c6Passed ? "✓ PASS" : "✗ FAIL"}: ${actualAuthSig}`);
console.log();

// Verify the public key matches
console.log("C.2: Signing Key Multibase Encoding (Verification)");
const expectedPubKey = "z6Mkg4i8vwbjHJL5MqqzfRWRgUGgR3YTbo2MiG14kskteSyt";

// Create a key pair from the specific private key
const keyBytes = new Uint8Array(
  TEST_PRIVATE_KEY_HEX.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) ||
    [],
);

// Use noble curves to derive public key
import { ed25519 } from "@noble/curves/ed25519";
const derivedPublicKey = ed25519.getPublicKey(keyBytes);
const computedPubKey = encodeMultibase(ED25519_PREFIX, derivedPublicKey);

const c2Passed = computedPubKey === expectedPubKey;
results.push({
  name: "C.2 Signing Key",
  passed: c2Passed,
  details: computedPubKey,
});
console.log(`  ${c2Passed ? "✓ PASS" : "✗ FAIL"}: ${computedPubKey}`);
console.log();

// Verify full flow - sign and verify
console.log("=== Verify Complete Flow ===");
const verificationResult = verifySignature(
  contentHash,
  actualCreatorSig,
  computedPubKey,
);
console.log(
  `Signature verification: ${verificationResult ? "✓ PASS" : "✗ FAIL"}`,
);
console.log();

// Summary
console.log("=== SUMMARY ===");
const passed = results.filter((r) => r.passed).length;
const total = results.length;
console.log(`Passed: ${passed}/${total}`);
results.forEach((r) => {
  console.log(`  ${r.passed ? "✓" : "✗"} ${r.name}: ${r.details}`);
});
