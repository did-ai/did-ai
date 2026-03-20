export interface VerificationMethod {
  id: string;
  type: "Ed25519VerificationKey2020" | "X25519KeyAgreementKey2020";
  controller: string;
  publicKeyMultibase: string;
}

export interface ServiceEndpoint {
  id: string;
  type: string;
  serviceEndpoint: string;
  [key: string]: unknown;
}

export interface DIDDocument {
  "@context": string[];
  id: string;
  controller: string;
  verificationMethod?: VerificationMethod[];
  assertionMethod?: string[];
  authentication?: string[];
  capabilityInvocation?: string[];
  capabilityDelegation?: string[];
  keyAgreement?: string[];
  service?: ServiceEndpoint[];
  subtype?: string;
}

export interface DIDDocumentMetadata {
  readonly created: string;
  readonly updated: string;
  readonly deactivated: boolean;
  readonly versionId?: string;
}

export interface DIDResolutionMetadata {
  readonly contentType?: string;
  readonly error?: string;
  readonly deprecatedNetwork?: boolean;
}

export interface DIDResolutionResult {
  readonly didDocument: DIDDocument | null;
  readonly didDocumentMetadata: DIDDocumentMetadata;
  readonly didResolutionMetadata: DIDResolutionMetadata;
}

export interface KeyProvider {
  type: "keychain" | "memory" | "custom";
  sign: (payload: Uint8Array) => Promise<Uint8Array>;
  getPublicKey: () => Promise<string>;
  resolveDid?: (publicKey: string) => Promise<string>;
}

export interface SDKConfig {
  apiUrl: string;
  keyProvider: KeyProvider;
  environment?: "production" | "sandbox";
  networkId?: string;
  timeout?: number;
  maxRetries?: number;
}

export interface SkillContent {
  systemPrompt: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  testCases?: Array<{
    input: Record<string, unknown>;
    expectedOutput: Record<string, unknown>;
  }>;
  executionMode?: "prompt" | "tool_enabled" | "code_enabled" | "agent";
  toolDeclarations?: Array<{
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    required: boolean;
  }>;
}

export interface SkillBinding {
  skillFamilyDid: string;
  versionPolicy: "locked" | "auto_patch" | "auto_minor";
  lockedVersion?: string;
  role: "primary" | "fallback";
}

export interface Changelog {
  summary: string;
  details?: {
    breaking?: string[];
    added?: string[];
    fixed?: string[];
    changed?: string[];
  };
  migrationGuide?: {
    breakingChanges: string;
    migrationSteps: string;
    codeExample?: string;
  };
}

export interface AgentContent {
  skillBindings: SkillBinding[];
  orchestrationMode: "standalone" | "barn_role";
  orchestrationFlow?: Record<string, unknown>;
  aggregatedTools?: Record<string, unknown>[];
  capabilities?: {
    inputFormats: string[];
    outputFormats: string[];
  };
  agentConfig?: Record<string, unknown>;
  name: string;
  description?: string;
  tags?: string[];
  visibility: "public" | "unlisted" | "private";
}

export interface DeveloperProfile {
  displayName: string;
  bio?: string;
  links?: Record<string, string>;
}

export interface PlatformKeys {
  signing: string;
  encryption: string;
}

export interface DiscoveryResult<T> {
  items: T[];
  total: number;
  limit?: number;
  offset?: number;
}

export interface SkillFamilySummary {
  familyDid: string;
  name: string;
  description?: string;
  category?: string;
  tags: string[];
  latestVersion?: string;
  latestVersionDid?: string;
  controller: string;
  createdAt: string;
  updatedAt: string;
}

export interface SkillVersionSummary {
  versionDid: string;
  familyDid: string;
  version: string;
  status: "active" | "degraded" | "deprecated";
  bumpType: "patch" | "minor" | "major";
  contentHash: string;
  creatorSig: string;
  createdAt: string;
}

export interface SkillVersionDetail extends SkillVersionSummary {
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  executionMode?: string;
  toolDeclarations?: Array<Record<string, unknown>>;
  content?: Record<string, unknown>;
}

export interface SkillChangelog {
  version: string;
  summary: string;
  details?: {
    breaking?: string[];
    added?: string[];
    fixed?: string[];
    changed?: string[];
  };
  migrationGuide?: {
    breakingChanges: string;
    migrationSteps: string;
    codeExample?: string;
  };
}

export interface AgentFamilySummary {
  familyDid: string;
  name: string;
  description?: string;
  tags: string[];
  visibility: "public" | "unlisted" | "private";
  latestVersion?: string;
  latestVersionDid?: string;
  controller: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentVersionSummary {
  versionDid: string;
  familyDid: string;
  version: string;
  status: "active" | "degraded" | "deprecated";
  bumpType: "patch" | "minor" | "major";
  contentHash: string;
  creatorSig: string;
  createdAt: string;
}

export interface AgentVersionDetail extends AgentVersionSummary {
  skillBindings: SkillBinding[];
  orchestrationMode: string;
  orchestrationFlow?: Record<string, unknown>;
  aggregatedTools?: Record<string, unknown>[];
  capabilities?: {
    inputFormats: string[];
    outputFormats: string[];
  };
  content?: Record<string, unknown>;
}

export interface VersionList {
  versions: Array<{
    version: string;
    status: "active" | "degraded" | "deprecated";
    previousVersion?: string;
    contentHash: string;
    creatorSig: string;
  }>;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
