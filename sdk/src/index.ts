import canonicalize from "canonicalize";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";
import { nanoid } from "nanoid";
import type {
  SDKConfig,
  SkillContent,
  SkillBinding,
  Changelog,
  AgentContent,
  DIDResolutionResult,
  DiscoveryResult,
  SkillFamilySummary,
  SkillVersionSummary,
  SkillVersionDetail,
  SkillChangelog,
  AgentFamilySummary,
  AgentVersionSummary,
  AgentVersionDetail,
  PlatformKeys,
  ApiResponse,
  KeyProvider,
  DIDDocument,
} from "./types.js";

function base58Encode(bytes: Uint8Array): string {
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let num = BigInt("0x" + bytesToHex(bytes));
  let encoded = "";
  while (num > 0n) {
    const remainder = num % 58n;
    encoded = ALPHABET[Number(remainder)] + encoded;
    num = num / 58n;
  }
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) {
    encoded = "1" + encoded;
  }
  return encoded;
}

export * from "./types.js";

export enum ErrorCode {
  DID_NOT_FOUND = "DID_NOT_FOUND",
  DID_DEACTIVATED = "DID_DEACTIVATED",
  DID_ALREADY_EXISTS = "DID_ALREADY_EXISTS",
  AUTH_REQUIRED = "AUTH_REQUIRED",
  INVALID_SIGNATURE = "INVALID_SIGNATURE",
  TIMESTAMP_EXPIRED = "TIMESTAMP_EXPIRED",
  NONCE_REPLAYED = "NONCE_REPLAYED",
  NETWORK_ID_MISMATCH = "NETWORK_ID_MISMATCH",
  SAID_MISMATCH = "SAID_MISMATCH",
  INVALID_DID_DOCUMENT = "INVALID_DID_DOCUMENT",
  NETWORK_NOT_FOUND = "NETWORK_NOT_FOUND",
  CROSS_NETWORK_REFERENCE = "CROSS_NETWORK_REFERENCE",
  IMMUTABLE_FIELD = "IMMUTABLE_FIELD",
  KEY_SEPARATION_VIOLATION = "KEY_SEPARATION_VIOLATION",
  AGENT_NOT_CALLABLE = "AGENT_NOT_CALLABLE",
  INVALID_VERSION_STATUS = "INVALID_VERSION_STATUS",
  INVALID_SKILL_BINDING = "INVALID_SKILL_BINDING",
  RATE_LIMITED = "RATE_LIMITED",
  NAMESPACE_INVALID = "NAMESPACE_INVALID",
  NAMESPACE_RESERVED = "NAMESPACE_RESERVED",
  INTERNAL_ERROR = "INTERNAL_ERROR",
  VALIDATION_FAILED = "VALIDATION_FAILED",
  FAMILY_NOT_FOUND = "FAMILY_NOT_FOUND",
  VERSION_NOT_FOUND = "VERSION_NOT_FOUND",
  MISSING_MIGRATION_GUIDE = "MISSING_MIGRATION_GUIDE",
  INVALID_VERSION_BUMP = "INVALID_VERSION_BUMP",
  NETWORK_ERROR = "NETWORK_ERROR",
  LICENSE_REQUIRED = "LICENSE_REQUIRED",
}

export class DidAiError extends Error {
  constructor(
    public readonly code: ErrorCode | string,
    message: string,
    public readonly statusCode?: number,
    public readonly requestId?: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "DidAiError";
  }
}

export class DidAiSDK {
  private config: SDKConfig & {
    environment: "production" | "sandbox";
    timeout: number;
    maxRetries: number;
    networkId: string;
  };

  constructor(config: SDKConfig) {
    this.config = {
      apiUrl: config.apiUrl.replace(/\/$/, ""),
      keyProvider: config.keyProvider,
      environment: config.environment ?? "production",
      networkId: config.networkId ?? "main",
      timeout: config.timeout ?? 30000,
      maxRetries: config.maxRetries ?? 3,
    };
  }

  static sandbox(config?: Partial<SDKConfig>): DidAiSDK {
    return new DidAiSDK({
      apiUrl: "https://sandbox.did-ai.io",
      keyProvider: {
        type: "memory",
        sign: async () => new Uint8Array(64),
        getPublicKey: async () => "",
        resolveDid: async () => "did:ai:sandbox:dev:placeholder",
      },
      environment: "sandbox",
      ...config,
    });
  }

  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>,
    auth: "none" | "didauth" | "session" = "none",
    sessionToken?: string,
    _retryCount = 0,
  ): Promise<T> {
    const url = `${this.config.apiUrl}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (auth === "didauth") {
      headers["Authorization"] = await this.buildDIDAuthHeader(
        method,
        path,
        body,
      );
    }
    if (auth === "session" && sessionToken) {
      headers["Authorization"] = `Bearer ${sessionToken}`;
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(this.config.timeout),
      });
    } catch (error) {
      if (_retryCount < this.config.maxRetries) {
        return this.request(
          method,
          path,
          body,
          auth,
          sessionToken,
          _retryCount + 1,
        );
      }
      throw new DidAiError(
        ErrorCode.NETWORK_ERROR,
        error instanceof Error ? error.message : "Network request failed",
        undefined,
        undefined,
        true,
      );
    }

    const json = (await response.json()) as ApiResponse<T>;

    if (!json.success) {
      const statusCode = response.status;
      const retryable = statusCode === 429 || statusCode >= 500;

      if (retryable && _retryCount < this.config.maxRetries) {
        const delay = Math.pow(2, _retryCount) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.request(
          method,
          path,
          body,
          auth,
          sessionToken,
          _retryCount + 1,
        );
      }

      throw new DidAiError(
        json.error?.code ?? "UNKNOWN_ERROR",
        json.error?.message ?? "Unknown error",
        statusCode,
        undefined,
        retryable,
      );
    }

    return json.data as T;
  }

  private async buildDIDAuthHeader(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<string> {
    const nonce = nanoid();
    const timestamp = new Date().toISOString();
    const bodyStr = body ? JSON.stringify(body) : "";
    const bodyHash = bytesToHex(sha256(new TextEncoder().encode(bodyStr)));

    const publicKey = await this.config.keyProvider.getPublicKey();
    const did = await this.resolveMyDid(publicKey);

    const payload = canonicalize({
      did,
      networkId: this.config.networkId,
      nonce,
      timestamp,
      method,
      path,
      bodyHash,
    })!;

    const sig = await this.config.keyProvider.sign(
      new TextEncoder().encode(payload),
    );
    const sigStr = "z" + base58Encode(sig);

    return `DIDAuth did="${did}", nonce="${nonce}", timestamp="${timestamp}", sig="${sigStr}"`;
  }

  private async resolveMyDid(publicKey: string): Promise<string> {
    if (this.config.keyProvider.resolveDid) {
      return this.config.keyProvider.resolveDid(publicKey);
    }
    throw new Error(
      "KeyProvider must implement resolveDid or DID must be configured manually",
    );
  }

  readonly platform = {
    getPublicKeys: async (): Promise<PlatformKeys> => {
      return this.request<PlatformKeys>("GET", "/api/v1/platform/public-key");
    },
  };

  readonly developers = {
    create: async (params: {
      email: string;
      password: string;
      displayName: string;
      bio?: string;
      links?: Record<string, string>;
    }): Promise<{ did: string; rotationKeyMnemonic: string }> => {
      return this.request<{ did: string; rotationKeyMnemonic: string }>(
        "POST",
        "/api/v1/auth/register",
        params,
      );
    },

    update: async (
      params: {
        did: string;
        displayName?: string;
        bio?: string;
        links?: Record<string, string>;
      },
      sessionToken: string,
    ): Promise<void> => {
      return this.request<void>(
        "PATCH",
        "/api/v1/account/profile",
        params,
        "session",
        sessionToken,
      );
    },

    resolve: async (did: string): Promise<DIDResolutionResult> => {
      return this.request<DIDResolutionResult>("GET", `/api/v1/dids/${did}`);
    },
  };

  readonly skills = {
    createFamily: async (params: {
      name: string;
      description?: string;
      category?: string;
      tags?: string[];
      namespace?: string;
    }): Promise<{ familyDid: string }> => {
      return this.request<{ familyDid: string }>(
        "POST",
        "/api/v1/skills",
        { ...params, namespace: params.namespace ?? "hub" },
        "didauth",
      );
    },

    getFamily: async (
      familyDid: string,
    ): Promise<SkillFamilySummary | null> => {
      return this.request<SkillFamilySummary | null>(
        "GET",
        `/api/v1/skills/${familyDid}`,
      ).catch(() => null);
    },

    listVersions: async (familyDid: string): Promise<SkillVersionSummary[]> => {
      return this.request<SkillVersionSummary[]>(
        "GET",
        `/api/v1/skills/${familyDid}/versions`,
      );
    },

    getVersion: async (
      familyDid: string,
      versionDid: string,
    ): Promise<SkillVersionDetail | null> => {
      return this.request<SkillVersionDetail | null>(
        "GET",
        `/api/v1/skills/${familyDid}/versions/${versionDid}`,
      ).catch(() => null);
    },

    publishVersion: async (params: {
      familyDid: string;
      version: string;
      bumpType: "patch" | "minor" | "major";
      content: SkillContent;
      changelog: Changelog;
      namespace?: string;
    }): Promise<{ versionDid: string; contentHash: string }> => {
      if (params.bumpType === "major" && !params.changelog.migrationGuide) {
        throw new DidAiError(
          ErrorCode.MISSING_MIGRATION_GUIDE,
          "Major version bump requires migrationGuide in changelog",
        );
      }

      const canonical = canonicalize({
        system_prompt: params.content.systemPrompt,
        input_schema: params.content.inputSchema,
        output_schema: params.content.outputSchema,
        test_cases: params.content.testCases ?? [],
        version: params.version,
        family_did: params.familyDid,
      })!;
      const contentHash = bytesToHex(
        sha256(new TextEncoder().encode(canonical)),
      );

      const sig = await this.config.keyProvider.sign(
        new TextEncoder().encode(contentHash),
      );
      const creatorSig = "z" + base58Encode(sig);

      return this.request<{ versionDid: string; contentHash: string }>(
        "POST",
        `/api/v1/skills/${params.familyDid}/versions`,
        {
          version: params.version,
          bumpType: params.bumpType,
          content: {
            system_prompt: params.content.systemPrompt,
            input_schema: params.content.inputSchema,
            output_schema: params.content.outputSchema,
            test_cases: params.content.testCases ?? [],
          },
          contentHash,
          creatorSig,
          changelog: params.changelog,
          namespace: params.namespace ?? "hub",
        },
        "didauth",
      );
    },

    getContent: async (familyDid: string): Promise<SkillContent | null> => {
      return this.request<SkillContent | null>(
        "GET",
        `/api/v1/skills/${familyDid}/content`,
      ).catch(() => null);
    },

    getChangelog: async (
      familyDid: string,
      version: string,
    ): Promise<SkillChangelog | null> => {
      return this.request<SkillChangelog | null>(
        "GET",
        `/api/v1/skills/${familyDid}/changelog/${version}`,
      ).catch(() => null);
    },

    discover: async (
      params: {
        q?: string;
        tags?: string[];
        limit?: number;
        offset?: number;
      } = {},
    ): Promise<DiscoveryResult<SkillFamilySummary>> => {
      const qs = new URLSearchParams();
      if (params.q) qs.set("q", params.q);
      if (params.tags) qs.set("tags", params.tags.join(","));
      if (params.limit) qs.set("limit", String(params.limit));
      if (params.offset) qs.set("offset", String(params.offset));
      return this.request<DiscoveryResult<SkillFamilySummary>>(
        "GET",
        `/api/v1/discover/skills?${qs}`,
      );
    },
  };

  readonly agents = {
    createFamily: async (params: {
      name: string;
      description?: string;
      tags?: string[];
      visibility?: "public" | "unlisted" | "private";
      namespace?: string;
    }): Promise<{ familyDid: string }> => {
      return this.request<{ familyDid: string }>(
        "POST",
        "/api/v1/agents",
        { ...params, namespace: params.namespace ?? "hub" },
        "didauth",
      );
    },

    getFamily: async (
      familyDid: string,
    ): Promise<AgentFamilySummary | null> => {
      return this.request<AgentFamilySummary | null>(
        "GET",
        `/api/v1/agents/${familyDid}`,
      ).catch(() => null);
    },

    listVersions: async (familyDid: string): Promise<AgentVersionSummary[]> => {
      return this.request<AgentVersionSummary[]>(
        "GET",
        `/api/v1/agents/${familyDid}/versions`,
      );
    },

    getVersion: async (
      familyDid: string,
      versionDid: string,
    ): Promise<AgentVersionDetail | null> => {
      return this.request<AgentVersionDetail | null>(
        "GET",
        `/api/v1/agents/${familyDid}/versions/${versionDid}`,
      ).catch(() => null);
    },

    publishVersion: async (params: {
      familyDid: string;
      version: string;
      bumpType: "patch" | "minor" | "major";
      content: AgentContent;
      changelog: Changelog;
      namespace?: string;
    }): Promise<{ versionDid: string }> => {
      if (params.bumpType === "major" && !params.changelog.migrationGuide) {
        throw new DidAiError(
          ErrorCode.MISSING_MIGRATION_GUIDE,
          "Major version bump requires migrationGuide in changelog",
        );
      }

      for (const b of params.content.skillBindings) {
        if (b.versionPolicy === "locked" && !b.lockedVersion) {
          throw new DidAiError(
            ErrorCode.INVALID_SKILL_BINDING,
            `Skill binding for ${b.skillFamilyDid} uses 'locked' policy but missing lockedVersion`,
          );
        }
        if (!["primary", "fallback"].includes(b.role)) {
          throw new DidAiError(
            ErrorCode.INVALID_SKILL_BINDING,
            `Invalid role '${b.role}' — must be 'primary' or 'fallback'`,
          );
        }
      }

      const canonical = canonicalize({
        skill_bindings: params.content.skillBindings,
        orchestration_mode: params.content.orchestrationMode,
        orchestration_flow: params.content.orchestrationFlow,
        aggregated_tools: params.content.aggregatedTools,
        capabilities: params.content.capabilities,
        agent_config: params.content.agentConfig,
        name: params.content.name,
        description: params.content.description,
        tags: params.content.tags,
        visibility: params.content.visibility,
        version: params.version,
        family_did: params.familyDid,
      })!;
      const contentHash = bytesToHex(
        sha256(new TextEncoder().encode(canonical)),
      );

      const sig = await this.config.keyProvider.sign(
        new TextEncoder().encode(contentHash),
      );
      const creatorSig = "z" + base58Encode(sig);

      return this.request<{ versionDid: string }>(
        "POST",
        `/api/v1/agents/${params.familyDid}/versions`,
        {
          version: params.version,
          bumpType: params.bumpType,
          content: {
            skill_bindings: params.content.skillBindings,
            orchestration_mode: params.content.orchestrationMode,
            orchestration_flow: params.content.orchestrationFlow,
            aggregated_tools: params.content.aggregatedTools,
            capabilities: params.content.capabilities,
            agent_config: params.content.agentConfig,
            name: params.content.name,
            description: params.content.description,
            tags: params.content.tags,
            visibility: params.content.visibility,
          },
          contentHash,
          creatorSig,
          changelog: params.changelog,
          namespace: params.namespace ?? "hub",
        },
        "didauth",
      );
    },

    discover: async (
      params: {
        q?: string;
        tags?: string[];
        limit?: number;
        offset?: number;
      } = {},
    ): Promise<DiscoveryResult<AgentFamilySummary>> => {
      const qs = new URLSearchParams();
      if (params.q) qs.set("q", params.q);
      if (params.tags) qs.set("tags", params.tags.join(","));
      if (params.limit) qs.set("limit", String(params.limit));
      if (params.offset) qs.set("offset", String(params.offset));
      return this.request<DiscoveryResult<AgentFamilySummary>>(
        "GET",
        `/api/v1/discover/agents?${qs}`,
      );
    },
  };

  readonly did = {
    resolve: async (did: string): Promise<DIDResolutionResult> => {
      return this.request<DIDResolutionResult>("GET", `/api/v1/dids/${did}`);
    },

    resolveWithVersion: async (
      did: string,
      version: string,
    ): Promise<DIDDocument | null> => {
      return this.request<DIDDocument | null>(
        "GET",
        `/api/v1/dids/${did}?version=${version}`,
      ).catch(() => null);
    },

    resolveWithService: async (
      did: string,
      service: string,
    ): Promise<{ serviceEndpoint: string } | null> => {
      return this.request<{ serviceEndpoint: string } | null>(
        "GET",
        `/api/v1/dids/${did}?service=${service}`,
      ).catch(() => null);
    },

    resolveFragment: async (
      did: string,
      fragment: string,
    ): Promise<Record<string, unknown> | null> => {
      return this.request<Record<string, unknown> | null>(
        "GET",
        `/api/v1/dids/${did}#${fragment}`,
      ).catch(() => null);
    },

    getVersionHistory: async (did: string): Promise<DIDDocument[]> => {
      return this.request<DIDDocument[]>("GET", `/api/v1/dids/${did}/versions`);
    },

    update: async (
      did: string,
      updates: {
        displayName?: string;
        bio?: string;
        links?: Record<string, string>;
      },
    ): Promise<void> => {
      return this.request<void>(
        "PATCH",
        `/api/v1/dids/${did}`,
        updates,
        "didauth",
      );
    },

    deactivate: async (did: string): Promise<void> => {
      return this.request<void>(
        "DELETE",
        `/api/v1/dids/${did}`,
        undefined,
        "didauth",
      );
    },
  };
}
