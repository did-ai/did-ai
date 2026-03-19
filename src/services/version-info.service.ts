import type {
  SkillVersionInfo,
  AgentVersionInfo,
  SkillVersionEntry,
  AgentVersionEntry,
} from "../types/version-info.js";

export interface BuildSkillVersionInfoParams {
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

export function buildSkillVersionInfo(
  params: BuildSkillVersionInfoParams,
): SkillVersionInfo {
  return {
    "@context": "https://did-ai.io/contexts/v1",
    type: "VersionInfo",
    familyDid: params.familyDid,
    version: params.version,
    status: params.status,
    contentHash: params.contentHash,
    creatorSig: params.creatorSig,
    inputSchema: params.inputSchema,
    outputSchema: params.outputSchema,
    ...(params.executionMode && { executionMode: params.executionMode }),
    ...(params.toolDeclarations && {
      toolDeclarations: params.toolDeclarations,
    }),
    ...(params.content && { content: params.content }),
  };
}

export interface BuildAgentVersionInfoParams {
  familyDid: string;
  version: string;
  status: "active" | "degraded" | "deprecated";
  contentHash: string;
  creatorSig: string;
  inputSchema: object;
  outputSchema: object;
  executionMode?: string;
  toolDeclarations?: object[];
  skillBindings?: AgentVersionEntry["skillBindings"];
  orchestrationMode?: "standalone" | "barn_role";
  orchestrationFlow?: object;
  aggregatedTools?: object[];
  content?: object;
}

export function buildAgentVersionInfo(
  params: BuildAgentVersionInfoParams,
): AgentVersionInfo {
  return {
    "@context": "https://did-ai.io/contexts/v1",
    type: "VersionInfo",
    familyDid: params.familyDid,
    version: params.version,
    status: params.status,
    contentHash: params.contentHash,
    creatorSig: params.creatorSig,
    inputSchema: params.inputSchema,
    outputSchema: params.outputSchema,
    ...(params.executionMode && { executionMode: params.executionMode }),
    ...(params.toolDeclarations && {
      toolDeclarations: params.toolDeclarations,
    }),
    ...(params.skillBindings && { skillBindings: params.skillBindings }),
    ...(params.orchestrationMode && {
      orchestrationMode: params.orchestrationMode,
    }),
    ...(params.orchestrationFlow && {
      orchestrationFlow: params.orchestrationFlow,
    }),
    ...(params.aggregatedTools && { aggregatedTools: params.aggregatedTools }),
    ...(params.content && { content: params.content }),
  };
}

export function buildSkillVersionEntry(
  params: Omit<BuildSkillVersionInfoParams, "familyDid" | "content">,
): SkillVersionEntry {
  return {
    version: params.version,
    status: params.status,
    contentHash: params.contentHash,
    creatorSig: params.creatorSig,
    ...(params.inputSchema && { inputSchema: params.inputSchema }),
    ...(params.outputSchema && { outputSchema: params.outputSchema }),
    ...(params.executionMode && { executionMode: params.executionMode }),
    ...(params.toolDeclarations && {
      toolDeclarations: params.toolDeclarations,
    }),
  };
}

export function buildAgentVersionEntry(
  params: Omit<BuildAgentVersionInfoParams, "familyDid" | "content">,
): AgentVersionEntry {
  return {
    version: params.version,
    status: params.status,
    contentHash: params.contentHash,
    creatorSig: params.creatorSig,
    ...(params.inputSchema && { inputSchema: params.inputSchema }),
    ...(params.outputSchema && { outputSchema: params.outputSchema }),
    ...(params.executionMode && { executionMode: params.executionMode }),
    ...(params.toolDeclarations && {
      toolDeclarations: params.toolDeclarations,
    }),
    ...(params.skillBindings && { skillBindings: params.skillBindings }),
    ...(params.orchestrationMode && {
      orchestrationMode: params.orchestrationMode,
    }),
    ...(params.orchestrationFlow && {
      orchestrationFlow: params.orchestrationFlow,
    }),
    ...(params.aggregatedTools && { aggregatedTools: params.aggregatedTools }),
  };
}
