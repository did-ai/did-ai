import { test, describe, expect } from "vitest";
import {
  buildDidDocument,
  buildDeveloperProfileService,
  buildPublishedAssetsService,
  buildSkillFamilyService,
  buildSkillVersionService,
  buildAgentFamilyService,
  buildAgentVersionService,
  buildAgentProfileService,
} from "../builders/did-document.builder.js";

describe("buildDidDocument", () => {
  test("should build minimal DID document", () => {
    const doc = buildDidDocument({
      did: "did:ai:hub:dev:abc123",
      subtype: "identity",
      controller: "did:ai:hub:dev:abc123",
      services: [],
    });

    expect(doc).toHaveProperty("@context");
    expect(doc).toHaveProperty("id", "did:ai:hub:dev:abc123");
    expect(doc).toHaveProperty("subtype", "identity");
    expect(doc).toHaveProperty("controller", "did:ai:hub:dev:abc123");
    expect(doc).not.toHaveProperty("created");
    expect(doc).not.toHaveProperty("updated");
    expect(doc).toHaveProperty("service", []);
  });

  test("should include verification methods for developer DID with capabilityInvocation", () => {
    const doc = buildDidDocument({
      did: "did:ai:hub:dev:abc123",
      subtype: "identity",
      controller: "did:ai:hub:dev:abc123",
      signingKeyMultibase: "zabc123",
      rotationKeyMultibase: "zdef456",
      services: [],
    });

    expect(doc).toHaveProperty("verificationMethod");
    expect(doc).toHaveProperty("assertionMethod");
    expect(doc).toHaveProperty("authentication");
    expect(doc).toHaveProperty("capabilityInvocation");
    expect(doc).not.toHaveProperty("capabilityDelegation");
  });

  test("should include keyAgreement when encryption key provided", () => {
    const doc = buildDidDocument({
      did: "did:ai:hub:dev:abc123",
      subtype: "identity",
      controller: "did:ai:hub:dev:abc123",
      signingKeyMultibase: "zabc123",
      rotationKeyMultibase: "zdef456",
      encryptionKeyMultibase: "zghi789",
      services: [],
    });

    expect(doc).toHaveProperty("keyAgreement");
  });

  test("should not include verification methods without keys", () => {
    const doc = buildDidDocument({
      did: "did:ai:hub:skill:abc123",
      subtype: "family",
      controller: "did:ai:hub:dev:owner",
      services: [{ type: "SkillFamily" }],
    });

    expect(doc).not.toHaveProperty("verificationMethod");
  });
});

describe("buildDeveloperProfileService", () => {
  test("should build profile service", () => {
    const service = buildDeveloperProfileService({
      did: "did:ai:hub:dev:abc123",
      shortId: "abc123",
      displayName: "Test Developer",
      bio: "Test bio",
    });

    expect(service).toHaveProperty("id", "did:ai:hub:dev:abc123#profile");
    expect(service).toHaveProperty("type", "DeveloperProfile");
    expect(service).toHaveProperty("displayName", "Test Developer");
    expect(service).toHaveProperty("bio", "Test bio");
  });
});

describe("buildPublishedAssetsService", () => {
  test("should build assets service", () => {
    const service = buildPublishedAssetsService({
      did: "did:ai:hub:dev:abc123",
      shortId: "abc123",
    });

    expect(service).toHaveProperty("id", "did:ai:hub:dev:abc123#published");
    expect(service).toHaveProperty("type", "PublishedAssets");
  });
});

describe("buildSkillFamilyService", () => {
  test("should build skill family service", () => {
    const service = buildSkillFamilyService({
      familyDid: "did:ai:hub:skill:abc123",
      name: "Test Skill",
      description: "A test skill",
      category: "testing",
      tags: ["test", "mock"],
    });

    expect(service).toHaveProperty("id", "did:ai:hub:skill:abc123#family");
    expect(service).toHaveProperty("type", "SkillFamily");
    expect(service).toHaveProperty("name", "Test Skill");
    expect(service).toHaveProperty("description", "A test skill");
    expect(service).toHaveProperty("category", "testing");
    expect(service).toHaveProperty("tags", ["test", "mock"]);
  });
});

describe("buildSkillVersionService", () => {
  test("should build skill version service", () => {
    const service = buildSkillVersionService({
      versionDid: "did:ai:hub:skill:v123",
      familyDid: "did:ai:hub:skill:abc123",
      version: "1.0.0",
      bumpType: "major",
      status: "active",
      inputSchema: { type: "object" },
      outputSchema: { type: "string" },
      contentHash: "abc123",
      creatorSig: "sig123",
    });

    expect(service).toHaveProperty("id", "did:ai:hub:skill:v123#version");
    expect(service).toHaveProperty("type", "SkillVersion");
    expect(service).toHaveProperty("version", "1.0.0");
    expect(service).toHaveProperty("bumpType", "major");
    expect(service).toHaveProperty("status", "active");
  });
});

describe("buildAgentFamilyService", () => {
  test("should build agent family service", () => {
    const service = buildAgentFamilyService({
      familyDid: "did:ai:hub:agent:abc123",
      name: "Test Agent",
      visibility: "public",
    });

    expect(service).toHaveProperty("id", "did:ai:hub:agent:abc123#family");
    expect(service).toHaveProperty("type", "AgentFamily");
    expect(service).toHaveProperty("visibility", "public");
  });
});

describe("buildAgentVersionService", () => {
  test("should build agent version service", () => {
    const service = buildAgentVersionService({
      versionDid: "did:ai:hub:agent:v123",
      familyDid: "did:ai:hub:agent:abc123",
      version: "1.0.0",
      bumpType: "minor",
      status: "active",
      skillBindings: [],
      orchestrationMode: "standalone",
      contentHash: "abc123",
      creatorSig: "sig123",
    });

    expect(service).toHaveProperty("id", "did:ai:hub:agent:v123#version");
    expect(service).toHaveProperty("type", "AgentVersion");
    expect(service).toHaveProperty("orchestrationMode", "standalone");
  });
});

describe("buildAgentProfileService", () => {
  test("should build agent profile service", () => {
    const service = buildAgentProfileService({
      versionDid: "did:ai:hub:agent:v123",
      name: "Test Agent",
      visibility: "public",
      capabilities: {
        inputFormats: ["json"],
        outputFormats: ["text"],
      },
    });

    expect(service).toHaveProperty("id", "did:ai:hub:agent:v123#profile");
    expect(service).toHaveProperty("type", "AgentProfile");
    expect(service).toHaveProperty("capabilities");
  });
});
