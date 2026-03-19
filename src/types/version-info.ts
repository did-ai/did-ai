export interface SkillBinding {
  skillFamilyDid: string;
  versionPolicy: string;
  lockedVersion?: string;
  role: string;
}

export interface SkillVersionEntry {
  version: string;
  status: "active" | "degraded" | "deprecated";
  contentHash: string;
  creatorSig: string;
  inputSchema?: object;
  outputSchema?: object;
  executionMode?: string;
  toolDeclarations?: object[];
}

export interface AgentVersionEntry extends SkillVersionEntry {
  skillBindings?: SkillBinding[];
  orchestrationMode?: "standalone" | "barn_role";
  orchestrationFlow?: object;
  aggregatedTools?: object[];
}

export interface SkillVersionInfo {
  "@context": "https://did-ai.io/contexts/v1";
  type: "VersionInfo";
  familyDid: string;
  version: string;
  status: "active" | "degraded" | "deprecated";
  contentHash: string;
  creatorSig: string;
  inputSchema: object;
  outputSchema: object;
  executionMode?: string;
  toolDeclarations?: object[];
  content?: object;
}

export interface AgentVersionInfo {
  "@context": "https://did-ai.io/contexts/v1";
  type: "VersionInfo";
  familyDid: string;
  version: string;
  status: "active" | "degraded" | "deprecated";
  contentHash: string;
  creatorSig: string;
  inputSchema: object;
  outputSchema: object;
  executionMode?: string;
  toolDeclarations?: object[];
  skillBindings?: SkillBinding[];
  orchestrationMode?: "standalone" | "barn_role";
  orchestrationFlow?: object;
  aggregatedTools?: object[];
  content?: object;
}
