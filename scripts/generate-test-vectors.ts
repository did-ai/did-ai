import {
  generateEd25519KeyPair,
  generateX25519KeyPair,
  generateDid,
  sha256hex,
} from "../src/crypto/keys.js";
import { signPayload } from "../src/crypto/signing.js";
import canonicalize from "canonicalize";

console.log("=== Generating Real Test Vectors ===\n");

// C.1: Developer DID
const devKeyPair = generateEd25519KeyPair();
const devDid = generateDid("dev", "hub");
console.log("C.1 Developer DID");
console.log("  DID:", devDid);
console.log();

// C.2: Signing Key Multibase Encoding
console.log("C.2 Signing Key Multibase Encoding");
console.log(
  "  Raw public key (hex):",
  Buffer.from(devKeyPair.publicKey).toString("hex"),
);
console.log("  Multibase:", devKeyPair.publicKeyMultibase);
console.log();

// C.3: Rotation Key
const rotationKeyPair = generateEd25519KeyPair();
console.log("C.3 Rotation Key Multibase Encoding");
console.log(
  "  Raw public key (hex):",
  Buffer.from(rotationKeyPair.publicKey).toString("hex"),
);
console.log("  Multibase:", rotationKeyPair.publicKeyMultibase);
console.log();

// C.4: contentHash
const skillContent = {
  system_prompt: "You are a TypeScript code review expert.",
  input_schema: {
    type: "object",
    properties: {
      code: { type: "string" },
    },
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
console.log("C.4 contentHash Calculation");
console.log("  Canonical JSON:", canonicalContent);
console.log("  SHA-256 hash (hex):", contentHash);
console.log();

// C.5: creatorSig
const creatorSig = signPayload(
  contentHash,
  Buffer.from(devKeyPair.privateKey).toString("hex"),
);
console.log("C.5 creatorSig Calculation");
console.log("  Content hash:", contentHash);
console.log(
  "  Signing key (hex):",
  Buffer.from(devKeyPair.privateKey).toString("hex"),
);
console.log("  creatorSig:", creatorSig);
console.log();

// C.6: DID Auth
const authPayload = {
  did: devDid,
  nonce: "abc123nonce456",
  timestamp: 1710720000,
  method: "POST",
  path: "/api/v1/skills",
  bodyHash: sha256hex('{"name":"Test Skill"}'),
};

const canonicalAuthPayload = canonicalize(authPayload)!;
const authSig = signPayload(
  canonicalAuthPayload,
  Buffer.from(devKeyPair.privateKey).toString("hex"),
);

console.log("C.6 DID Auth Signature");
console.log("  Canonical payload:", canonicalAuthPayload);
console.log("  Signature:", authSig);
console.log("  Authorization header:");
console.log(
  `    DIDAuth did="${devDid}", nonce="abc123nonce456", timestamp="1710720000", sig="${authSig}"`,
);
console.log();

// C.7: DID URL with fragment (need a developer DID document)
console.log("C.7 DID URL Fragment Resolution");
console.log(
  "  Input: did:ai:dev:hub:" + devDid.split(":").pop() + "#signing-key",
);
console.log("  Expected verification method:");
console.log("  {");
console.log(`    "id": "${devDid}#signing-key",`);
console.log('    "type": "Ed25519VerificationKey2020",');
console.log(`    "controller": "${devDid}",`);
console.log(`    "publicKeyMultibase": "${devKeyPair.publicKeyMultibase}"`);
console.log("  }");
console.log();

// C.8: Version query - generate a skill family
const skillFamilyDid = generateDid("skill", "hub");
console.log("C.8 Version Query Resolution");
console.log("  Input: " + skillFamilyDid + "?version=2.1.0");
console.log("  (Note: Requires actual skill version in database to resolve)");
console.log();

// Additional: X25519 Key for platform
const x25519KeyPair = generateX25519KeyPair();
console.log("X25519 Key (Platform Encryption)");
console.log("  Multibase:", x25519KeyPair.publicKeyMultibase);
console.log();

// Output all values for spec
console.log("=== VALUES FOR SPEC ===");
console.log("DEV_DID:", devDid);
console.log("DEV_SHORT_ID:", devDid.split(":").pop());
console.log("SIGNING_KEY_PUBLIC:", devKeyPair.publicKeyMultibase);
console.log(
  "SIGNING_KEY_PRIVATE:",
  Buffer.from(devKeyPair.privateKey).toString("hex"),
);
console.log("ROTATION_KEY_PUBLIC:", rotationKeyPair.publicKeyMultibase);
console.log(
  "ROTATION_KEY_PRIVATE:",
  Buffer.from(rotationKeyPair.privateKey).toString("hex"),
);
console.log("CONTENT_HASH:", contentHash);
console.log("CREATOR_SIG:", creatorSig);
console.log("AUTH_SIG:", authSig);
console.log("SKILL_FAMILY_DID:", skillFamilyDid);
console.log("X25519_PUBLIC:", x25519KeyPair.publicKeyMultibase);
console.log(
  "X25519_PRIVATE:",
  Buffer.from(x25519KeyPair.privateKey).toString("hex"),
);
