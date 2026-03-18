import canonicalize from "canonicalize";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";
import { nanoid } from "nanoid";
import type {
  SDKConfig,
  SkillContent,
  SkillBinding,
  Changelog,
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
  INVALID_SIGNATURE = "INVALID_SIGNATURE",
  MISSING_MIGRATION_GUIDE = "MISSING_MIGRATION_GUIDE",
  LICENSE_REQUIRED = "LICENSE_REQUIRED",
  RATE_LIMITED = "RATE_LIMITED",
  NETWORK_ERROR = "NETWORK_ERROR",
}

export class DidAiError extends Error {
  constructor(
    public readonly code: ErrorCode,
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
  private config: Required<SDKConfig>;

  constructor(config: SDKConfig) {
    this.config = {
      environment: "production",
      timeout: 30000,
      maxRetries: 3,
      ...config,
    };
  }

  static sandbox(config?: Partial<SDKConfig>): DidAiSDK {
    return new DidAiSDK({
      apiUrl: "https://sandbox.did-ai.io",
      keyProvider: {
        type: "memory",
        sign: async () => new Uint8Array(64),
        getPublicKey: async () => "",
      },
      environment: "sandbox",
      ...config,
    });
  }

  private async request<T>(
    method: string,
    path: string,
    body?: object,
    auth: "none" | "didauth" | "session" = "none",
    sessionToken?: string,
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

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(this.config.timeout),
    });

    const json = (await response.json()) as {
      success: boolean;
      data?: T;
      error?: { code: string; message: string };
    };
    if (!json.success) {
      throw new DidAiError(
        (json.error?.code ?? "NETWORK_ERROR") as ErrorCode,
        json.error?.message ?? "Unknown error",
        response.status,
      );
    }
    return json.data as T;
  }

  private async buildDIDAuthHeader(
    method: string,
    path: string,
    body?: object,
  ): Promise<string> {
    const nonce = nanoid();
    const timestamp = Math.floor(Date.now() / 1000);
    const bodyStr = body ? JSON.stringify(body) : "";
    const bodyHash = bytesToHex(sha256(new TextEncoder().encode(bodyStr)));

    const publicKey = await this.config.keyProvider.getPublicKey();
    const did = await this.resolveMyDid(publicKey);

    const payload = canonicalize({
      did,
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

  private async resolveMyDid(_publicKey: string): Promise<string> {
    throw new Error("resolveMyDid must be implemented by KeyProvider");
  }

  developers = {
    create: async (params: {
      email: string;
      password: string;
      displayName: string;
      bio?: string;
      links?: Record<string, string>;
    }) => {
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
    ) => {
      return this.request(
        "PATCH",
        "/api/v1/account/profile",
        params,
        "session",
        sessionToken,
      );
    },
  };

  skills = {
    createFamily: async (params: {
      name: string;
      description?: string;
      category?: string;
      tags?: string[];
      namespace?: string;
    }) => {
      return this.request<{ familyDid: string }>(
        "POST",
        "/api/v1/skills",
        { ...params, namespace: params.namespace ?? "hub" },
        "didauth",
      );
    },

    publishVersion: async (params: {
      familyDid: string;
      version: string;
      bumpType: "patch" | "minor" | "major";
      content: SkillContent;
      changelog: Changelog;
    }) => {
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
        { ...params, contentHash, creatorSig },
        "didauth",
      );
    },

    getContent: async (familyDid: string) => {
      return this.request<SkillContent>(
        "GET",
        `/api/v1/skills/${familyDid}/content`,
      );
    },

    discover: async (
      params: {
        q?: string;
        tags?: string[];
        limit?: number;
        offset?: number;
      } = {},
    ) => {
      const qs = new URLSearchParams();
      if (params.q) qs.set("q", params.q);
      if (params.tags) qs.set("tags", params.tags.join(","));
      if (params.limit) qs.set("limit", String(params.limit));
      if (params.offset) qs.set("offset", String(params.offset));
      return this.request<{ items: object[]; total: number }>(
        "GET",
        `/api/v1/discover/skills?${qs}`,
      );
    },
  };

  agents = {
    createFamily: async (params: {
      name: string;
      description?: string;
      tags?: string[];
      visibility?: "public" | "unlisted" | "private";
      namespace?: string;
    }) => {
      return this.request<{ familyDid: string }>(
        "POST",
        "/api/v1/agents",
        { ...params, namespace: params.namespace ?? "hub" },
        "didauth",
      );
    },

    publishVersion: async (params: {
      familyDid: string;
      version: string;
      bumpType: "patch" | "minor" | "major";
      skillBindings: SkillBinding[];
      orchestrationMode: "standalone" | "barn_role";
      orchestrationFlow?: object;
      changelog: Changelog;
    }) => {
      if (params.bumpType === "major" && !params.changelog.migrationGuide) {
        throw new DidAiError(
          ErrorCode.MISSING_MIGRATION_GUIDE,
          "Major version bump requires migrationGuide in changelog",
        );
      }

      for (const b of params.skillBindings) {
        if (b.versionPolicy === "locked" && !b.lockedVersion) {
          throw new DidAiError(
            ErrorCode.INVALID_SIGNATURE,
            `Skill binding for ${b.skillFamilyDid} uses 'locked' policy but missing lockedVersion`,
          );
        }
        if (!["primary", "fallback"].includes(b.role)) {
          throw new DidAiError(
            ErrorCode.INVALID_SIGNATURE,
            `Invalid role '${b.role}' — must be 'primary' or 'fallback'`,
          );
        }
      }

      return this.request<{ versionDid: string }>(
        "POST",
        `/api/v1/agents/${params.familyDid}/versions`,
        params,
        "didauth",
      );
    },

    discover: async (
      params: {
        q?: string;
        limit?: number;
        offset?: number;
      } = {},
    ) => {
      const qs = new URLSearchParams();
      if (params.q) qs.set("q", params.q);
      if (params.limit) qs.set("limit", String(params.limit));
      if (params.offset) qs.set("offset", String(params.offset));
      return this.request<{ items: object[]; total: number }>(
        "GET",
        `/api/v1/discover/agents?${qs}`,
      );
    },
  };

  did = {
    resolve: async (did: string) => {
      return this.request<object>("GET", `/api/v1/dids/${did}`);
    },
    getVersionHistory: async (did: string) => {
      return this.request<object[]>("GET", `/api/v1/dids/${did}/versions`);
    },
  };
}
