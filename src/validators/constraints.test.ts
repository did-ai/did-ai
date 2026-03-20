import { test, describe, expect } from "vitest";
import {
  validateKeySeparation,
  validateAgentConstraints,
  validateSkillAgentConstraints,
  validateVersionStatus,
  validateSkillBindings,
} from "./constraints.js";
import { DidAiError, ErrorCode } from "../errors/index.js";

describe("validateKeySeparation", () => {
  test("should accept Ed25519 in assertionMethod", () => {
    expect(() =>
      validateKeySeparation({
        verificationMethod: [
          {
            id: "did:ai:hub:dev:abc#signing-key",
            type: "Ed25519VerificationKey2020",
            controller: "did:ai:hub:dev:abc",
            publicKeyMultibase: "zabc123",
          },
        ],
        assertionMethod: ["did:ai:hub:dev:abc#signing-key"],
      }),
    ).not.toThrow();
  });

  test("should accept X25519 in keyAgreement", () => {
    expect(() =>
      validateKeySeparation({
        verificationMethod: [
          {
            id: "did:ai:hub:dev:abc#encryption-key",
            type: "X25519KeyAgreementKey2020",
            controller: "did:ai:hub:dev:abc",
            publicKeyMultibase: "zdef456",
          },
        ],
        keyAgreement: ["did:ai:hub:dev:abc#encryption-key"],
      }),
    ).not.toThrow();
  });

  test("should reject Ed25519 in keyAgreement", () => {
    expect(() =>
      validateKeySeparation({
        verificationMethod: [
          {
            id: "did:ai:hub:dev:abc#signing-key",
            type: "Ed25519VerificationKey2020",
            controller: "did:ai:hub:dev:abc",
            publicKeyMultibase: "zabc123",
          },
        ],
        keyAgreement: ["did:ai:hub:dev:abc#signing-key"],
      }),
    ).toThrow(DidAiError);
  });

  test("should reject X25519 in assertionMethod", () => {
    expect(() =>
      validateKeySeparation({
        verificationMethod: [
          {
            id: "did:ai:hub:dev:abc#encryption-key",
            type: "X25519KeyAgreementKey2020",
            controller: "did:ai:hub:dev:abc",
            publicKeyMultibase: "zdef456",
          },
        ],
        assertionMethod: ["did:ai:hub:dev:abc#encryption-key"],
      }),
    ).toThrow(DidAiError);
  });

  test("should pass when no verificationMethod", () => {
    expect(() => validateKeySeparation({})).not.toThrow();
  });

  test("should reject duplicate VM ids", () => {
    expect(() =>
      validateKeySeparation({
        verificationMethod: [
          {
            id: "did:ai:hub:dev:abc#key1",
            type: "Ed25519VerificationKey2020",
            controller: "did:ai:hub:dev:abc",
            publicKeyMultibase: "zabc123",
          },
          {
            id: "did:ai:hub:dev:abc#key1",
            type: "Ed25519VerificationKey2020",
            controller: "did:ai:hub:dev:abc",
            publicKeyMultibase: "zdef456",
          },
        ],
      }),
    ).toThrow(DidAiError);
  });
});

describe("validateSkillAgentConstraints", () => {
  test("should reject verificationMethod for skill/agent", () => {
    expect(() =>
      validateSkillAgentConstraints({
        verificationMethod: [
          {
            id: "did:ai:hub:dev:abc#signing-key",
            type: "Ed25519VerificationKey2020",
            controller: "did:ai:hub:dev:abc",
            publicKeyMultibase: "zabc123",
          },
        ],
      }),
    ).toThrow(DidAiError);
  });

  test("should reject assertionMethod for skill/agent", () => {
    expect(() =>
      validateSkillAgentConstraints({
        assertionMethod: ["did:ai:hub:dev:abc#signing-key"],
      }),
    ).toThrow(DidAiError);
  });

  test("should accept skill/agent without verification relationships", () => {
    expect(() =>
      validateSkillAgentConstraints({
        service: [{ type: "SkillFamily" }],
      }),
    ).not.toThrow();
  });
});

describe("validateAgentConstraints", () => {
  test("should reject AgentVersion without AgentProfile", () => {
    expect(() =>
      validateAgentConstraints({
        service: [{ type: "AgentVersion" }],
      }),
    ).toThrow(DidAiError);
  });

  test("should accept AgentVersion with AgentProfile", () => {
    expect(() =>
      validateAgentConstraints({
        service: [{ type: "AgentVersion" }, { type: "AgentProfile" }],
      }),
    ).not.toThrow();
  });

  test("should reject network serviceEndpoint", () => {
    expect(() =>
      validateAgentConstraints({
        service: [
          { type: "AgentProfile", serviceEndpoint: "https://example.com" },
        ],
      }),
    ).toThrow(DidAiError);
  });

  test("should reject DIDCommMessaging", () => {
    expect(() =>
      validateAgentConstraints({
        service: [{ type: "DIDCommMessaging" }],
      }),
    ).toThrow(DidAiError);
  });

  test("should accept valid agent profile", () => {
    expect(() =>
      validateAgentConstraints({
        service: [{ type: "AgentProfile", name: "Test Agent" }],
      }),
    ).not.toThrow();
  });
});

describe("validateVersionStatus", () => {
  test("should accept active status", () => {
    expect(() => validateVersionStatus("active")).not.toThrow();
  });

  test("should accept degraded status", () => {
    expect(() => validateVersionStatus("degraded")).not.toThrow();
  });

  test("should accept deprecated status", () => {
    expect(() => validateVersionStatus("deprecated")).not.toThrow();
  });

  test("should reject eol status", () => {
    expect(() => validateVersionStatus("eol")).toThrow(DidAiError);
  });

  test("should reject invalid status", () => {
    expect(() => validateVersionStatus("invalid")).toThrow(DidAiError);
  });
});

describe("validateSkillBindings", () => {
  test("should accept valid primary binding", () => {
    expect(() =>
      validateSkillBindings([
        {
          skillFamilyDid: "did:ai:hub:skill:abc",
          versionPolicy: "locked",
          lockedVersion: "1.0.0",
          role: "primary",
        },
      ]),
    ).not.toThrow();
  });

  test("should accept valid fallback binding", () => {
    expect(() =>
      validateSkillBindings([
        {
          skillFamilyDid: "did:ai:hub:skill:abc",
          versionPolicy: "auto_patch",
          role: "fallback",
        },
      ]),
    ).not.toThrow();
  });

  test("should reject role optional", () => {
    expect(() =>
      validateSkillBindings([
        {
          skillFamilyDid: "did:ai:hub:skill:abc",
          versionPolicy: "auto_minor",
          role: "optional" as "primary",
        },
      ]),
    ).toThrow(DidAiError);
  });

  test("should reject locked policy without lockedVersion", () => {
    expect(() =>
      validateSkillBindings([
        {
          skillFamilyDid: "did:ai:hub:skill:abc",
          versionPolicy: "locked",
          role: "primary",
        },
      ]),
    ).toThrow(DidAiError);
  });

  test("should reject invalid versionPolicy", () => {
    expect(() =>
      validateSkillBindings([
        {
          skillFamilyDid: "did:ai:hub:skill:abc",
          versionPolicy: "invalid" as "locked",
          role: "primary",
        },
      ]),
    ).toThrow(DidAiError);
  });
});
