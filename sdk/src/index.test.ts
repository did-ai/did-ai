import { test, describe, expect, vi, beforeEach } from "vitest";
import {
  DidAiSDK,
  DidAiError,
  ErrorCode,
  type SkillContent,
  type AgentContent,
  type Changelog,
} from "./index.js";

const MOCK_DID = "did:ai:main:dev:Kf8RXsKZXWHLgIOlGH8SAs";
const MOCK_PUBLIC_KEY = "zabc123def456";

const mockKeyProvider = {
  type: "memory" as const,
  sign: vi.fn().mockResolvedValue(new Uint8Array(64)),
  getPublicKey: vi.fn().mockResolvedValue(MOCK_PUBLIC_KEY),
  resolveDid: vi.fn().mockResolvedValue(MOCK_DID),
};

function createSDK(
  overrides?: Partial<{
    apiUrl: string;
    keyProvider: typeof mockKeyProvider;
    networkId: string;
  }>,
) {
  return new DidAiSDK({
    apiUrl: overrides?.apiUrl ?? "https://api.did-ai.io",
    keyProvider: overrides?.keyProvider ?? mockKeyProvider,
    networkId: overrides?.networkId ?? "main",
  } as Parameters<typeof DidAiSDK>[0]);
}

describe("DidAiSDK", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    test("should create SDK with default config", () => {
      const sdk = createSDK();
      expect(sdk).toBeInstanceOf(DidAiSDK);
    });

    test("should create sandbox SDK", () => {
      const sdk = DidAiSDK.sandbox();
      expect(sdk).toBeInstanceOf(DidAiSDK);
    });

    test("should normalize apiUrl by removing trailing slash", () => {
      const sdk = createSDK({ apiUrl: "https://api.did-ai.io/" });
      expect(sdk).toBeInstanceOf(DidAiSDK);
    });
  });

  describe("DidAiError", () => {
    test("should create error with all properties", () => {
      const error = new DidAiError(
        ErrorCode.DID_NOT_FOUND,
        "DID not found",
        404,
        "req-123",
        false,
      );
      expect(error.code).toBe(ErrorCode.DID_NOT_FOUND);
      expect(error.message).toBe("DID not found");
      expect(error.statusCode).toBe(404);
      expect(error.requestId).toBe("req-123");
      expect(error.retryable).toBe(false);
      expect(error.name).toBe("DidAiError");
    });

    test("should default retryable to false", () => {
      const error = new DidAiError(ErrorCode.NETWORK_ERROR, "Network error");
      expect(error.retryable).toBe(false);
    });
  });

  describe("platform", () => {
    test("should have platform namespace", () => {
      const sdk = createSDK();
      expect(sdk.platform).toBeDefined();
      expect(typeof sdk.platform.getPublicKeys).toBe("function");
    });
  });

  describe("developers", () => {
    test("should have developers namespace", () => {
      const sdk = createSDK();
      expect(sdk.developers).toBeDefined();
      expect(typeof sdk.developers.create).toBe("function");
      expect(typeof sdk.developers.update).toBe("function");
      expect(typeof sdk.developers.resolve).toBe("function");
    });
  });

  describe("skills", () => {
    test("should have skills namespace", () => {
      const sdk = createSDK();
      expect(sdk.skills).toBeDefined();
      expect(typeof sdk.skills.createFamily).toBe("function");
      expect(typeof sdk.skills.getFamily).toBe("function");
      expect(typeof sdk.skills.listVersions).toBe("function");
      expect(typeof sdk.skills.getVersion).toBe("function");
      expect(typeof sdk.skills.publishVersion).toBe("function");
      expect(typeof sdk.skills.getContent).toBe("function");
      expect(typeof sdk.skills.getChangelog).toBe("function");
      expect(typeof sdk.skills.discover).toBe("function");
    });

    test("should validate major version bump requires migrationGuide", async () => {
      const sdk = createSDK();
      global.fetch = vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            success: false,
            error: { code: "MISSING_MIGRATION_GUIDE" },
          }),
        status: 400,
      });

      const content: SkillContent = {
        systemPrompt: "Test",
        inputSchema: {},
        outputSchema: {},
      };
      const changelog: Changelog = {
        summary: "Test",
      };

      await expect(
        sdk.skills.publishVersion({
          familyDid: "did:ai:main:skill:test",
          version: "2.0.0",
          bumpType: "major",
          content,
          changelog,
        }),
      ).rejects.toThrow("Major version bump requires migrationGuide");
    });
  });

  describe("agents", () => {
    test("should have agents namespace", () => {
      const sdk = createSDK();
      expect(sdk.agents).toBeDefined();
      expect(typeof sdk.agents.createFamily).toBe("function");
      expect(typeof sdk.agents.getFamily).toBe("function");
      expect(typeof sdk.agents.listVersions).toBe("function");
      expect(typeof sdk.agents.getVersion).toBe("function");
      expect(typeof sdk.agents.publishVersion).toBe("function");
      expect(typeof sdk.agents.discover).toBe("function");
    });

    test("should validate locked skill binding requires lockedVersion", async () => {
      const sdk = createSDK();
      global.fetch = vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            success: false,
            error: { code: "INVALID_SKILL_BINDING" },
          }),
        status: 400,
      });

      const content: AgentContent = {
        name: "Test Agent",
        skillBindings: [
          {
            skillFamilyDid: "did:ai:main:skill:test",
            versionPolicy: "locked",
            role: "primary",
          },
        ],
        orchestrationMode: "standalone",
        visibility: "public",
      };
      const changelog: Changelog = {
        summary: "Test",
      };

      await expect(
        sdk.agents.publishVersion({
          familyDid: "did:ai:main:agent:test",
          version: "1.0.0",
          bumpType: "patch",
          content,
          changelog,
        }),
      ).rejects.toThrow("missing lockedVersion");
    });

    test("should validate skill binding role", async () => {
      const sdk = createSDK();

      const content: AgentContent = {
        name: "Test Agent",
        skillBindings: [
          {
            skillFamilyDid: "did:ai:main:skill:test",
            versionPolicy: "auto_patch",
            role: "invalid" as "primary",
          },
        ],
        orchestrationMode: "standalone",
        visibility: "public",
      };
      const changelog: Changelog = {
        summary: "Test",
      };

      await expect(
        sdk.agents.publishVersion({
          familyDid: "did:ai:main:agent:test",
          version: "1.0.0",
          bumpType: "patch",
          content,
          changelog,
        }),
      ).rejects.toThrow("must be 'primary' or 'fallback'");
    });
  });

  describe("did", () => {
    test("should have did namespace", () => {
      const sdk = createSDK();
      expect(sdk.did).toBeDefined();
      expect(typeof sdk.did.resolve).toBe("function");
      expect(typeof sdk.did.resolveWithVersion).toBe("function");
      expect(typeof sdk.did.resolveWithService).toBe("function");
      expect(typeof sdk.did.resolveFragment).toBe("function");
      expect(typeof sdk.did.getVersionHistory).toBe("function");
      expect(typeof sdk.did.update).toBe("function");
      expect(typeof sdk.did.deactivate).toBe("function");
    });
  });
});
