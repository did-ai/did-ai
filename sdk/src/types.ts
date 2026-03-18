export interface KeyProvider {
  type: "keychain" | "memory" | "custom";
  sign: (payload: Uint8Array) => Promise<Uint8Array>;
  getPublicKey: () => Promise<string>;
}

export interface SDKConfig {
  apiUrl: string;
  keyProvider: KeyProvider;
  environment?: "production" | "sandbox";
  timeout?: number;
  maxRetries?: number;
}

export interface SkillContent {
  systemPrompt: string;
  inputSchema: object;
  outputSchema: object;
  testCases?: Array<{ input: object; expectedOutput: object }>;
  executionMode?: "prompt" | "tool_enabled" | "code_enabled" | "agent";
  toolDeclarations?: Array<{
    name: string;
    description: string;
    inputSchema: object;
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
