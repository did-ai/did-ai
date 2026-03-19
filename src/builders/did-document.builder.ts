export type Subtype = "identity" | "family" | "version";

export interface BuilderParams {
  did: string;
  subtype: Subtype;
  controller: string;
  services?: object[];
  signingKeyMultibase?: string;
  rotationKeyMultibase?: string;
}

export function buildDidDocument(params: BuilderParams): object {
  const now = new Date().toISOString();
  const base = {
    "@context": [
      "https://www.w3.org/ns/did/v1",
      "https://did-ai.io/contexts/v1",
    ],
    id: params.did,
    subtype: params.subtype,
    controller: params.controller,
    created: now,
    updated: now,
    service: params.services ?? [],
  };

  if (params.signingKeyMultibase && params.rotationKeyMultibase) {
    return {
      ...base,
      verificationMethod: [
        {
          id: `${params.did}#signing-key`,
          type: "Ed25519VerificationKey2020",
          controller: params.did,
          publicKeyMultibase: params.signingKeyMultibase,
        },
        {
          id: `${params.did}#rotation-key`,
          type: "Ed25519VerificationKey2020",
          controller: params.did,
          publicKeyMultibase: params.rotationKeyMultibase,
        },
      ],
      assertionMethod: [`${params.did}#signing-key`],
      authentication: [`${params.did}#signing-key`],
      capabilityDelegation: [`${params.did}#rotation-key`],
    };
  }

  return base;
}

export interface DeveloperProfileServiceParams {
  did: string;
  shortId: string;
  displayName: string;
  bio?: string;
  links?: Record<string, string>;
}

export function buildDeveloperProfileService(
  params: DeveloperProfileServiceParams,
): object {
  return {
    id: `${params.did}#profile`,
    type: "DeveloperProfile",
    serviceEndpoint: `https://did-ai.io/dev/hub/${params.shortId}/profile`,
    displayName: params.displayName,
    bio: params.bio,
    links: params.links,
  };
}

export interface PublishedAssetsServiceParams {
  did: string;
  shortId: string;
}

export function buildPublishedAssetsService(
  params: PublishedAssetsServiceParams,
): object {
  return {
    id: `${params.did}#published`,
    type: "PublishedAssets",
    serviceEndpoint: `https://did-ai.io/dev/hub/${params.shortId}/assets`,
  };
}

export interface SkillFamilyServiceParams {
  familyDid: string;
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
  latestVersion?: string;
  latestVersionDid?: string;
}

export function buildSkillFamilyService(
  params: SkillFamilyServiceParams,
): object {
  const shortId = params.familyDid.split(":").pop()!;
  return {
    id: `${params.familyDid}#family`,
    type: "SkillFamily",
    serviceEndpoint: `https://did-ai.io/skills/hub/${shortId}`,
    name: params.name,
    description: params.description,
    category: params.category,
    tags: params.tags ?? [],
    latestVersion: params.latestVersion,
    latestVersionDid: params.latestVersionDid,
  };
}

export interface SkillVersionServiceParams {
  versionDid: string;
  familyDid: string;
  version: string;
  bumpType: "patch" | "minor" | "major";
  status: string;
  previousVersion?: string;
  inputSchema: object;
  outputSchema: object;
  contentHash: string;
  creatorSig: string;
}

export function buildSkillVersionService(
  params: SkillVersionServiceParams,
): object {
  return {
    id: `${params.versionDid}#version`,
    type: "SkillVersion",
    familyDid: params.familyDid,
    version: params.version,
    bumpType: params.bumpType,
    status: params.status,
    previousVersion: params.previousVersion,
    inputSchema: params.inputSchema,
    outputSchema: params.outputSchema,
    contentHash: params.contentHash,
    creatorSig: params.creatorSig,
  };
}

export interface AgentFamilyServiceParams {
  familyDid: string;
  name: string;
  description?: string;
  tags?: string[];
  visibility: "public" | "unlisted" | "private";
  latestVersion?: string;
  latestVersionDid?: string;
}

export function buildAgentFamilyService(
  params: AgentFamilyServiceParams,
): object {
  const shortId = params.familyDid.split(":").pop()!;
  return {
    id: `${params.familyDid}#family`,
    type: "AgentFamily",
    serviceEndpoint: `https://did-ai.io/agents/hub/${shortId}`,
    name: params.name,
    description: params.description,
    tags: params.tags ?? [],
    visibility: params.visibility,
    latestVersion: params.latestVersion,
    latestVersionDid: params.latestVersionDid,
  };
}

export interface AgentVersionServiceParams {
  versionDid: string;
  familyDid: string;
  version: string;
  bumpType: string;
  status: string;
  previousVersion?: string;
  skillBindings: SkillBinding[];
  orchestrationMode: "standalone" | "barn_role";
  orchestrationFlow?: object;
  aggregatedTools?: object[];
  contentHash: string;
  creatorSig: string;
}

export interface SkillBinding {
  skillFamilyDid: string;
  versionPolicy: string;
  lockedVersion?: string;
  role: string;
}

export function buildAgentVersionService(
  params: AgentVersionServiceParams,
): object {
  return {
    id: `${params.versionDid}#version`,
    type: "AgentVersion",
    familyDid: params.familyDid,
    version: params.version,
    bumpType: params.bumpType,
    status: params.status,
    previousVersion: params.previousVersion,
    skillBindings: params.skillBindings,
    orchestrationMode: params.orchestrationMode,
    orchestrationFlow: params.orchestrationFlow,
    aggregatedTools: params.aggregatedTools,
    contentHash: params.contentHash,
    creatorSig: params.creatorSig,
  };
}

export interface AgentProfileServiceParams {
  versionDid: string;
  name: string;
  description?: string;
  tags?: string[];
  visibility: "public" | "unlisted" | "private";
  capabilities: {
    inputFormats: string[];
    outputFormats: string[];
  };
}

export function buildAgentProfileService(
  params: AgentProfileServiceParams,
): object {
  return {
    id: `${params.versionDid}#profile`,
    type: "AgentProfile",
    name: params.name,
    description: params.description,
    tags: params.tags ?? [],
    visibility: params.visibility,
    capabilities: params.capabilities,
  };
}

export interface VersionEntry {
  version: string;
  status: "active" | "degraded" | "deprecated";
  previousVersion?: string;
  contentHash: string;
  creatorSig: string;
  inputSchema?: object;
  outputSchema?: object;
  executionMode?: string;
  toolDeclarations?: object[];
  skillBindings?: SkillBinding[];
  orchestrationMode?: string;
  orchestrationFlow?: object;
  aggregatedTools?: object[];
}

export interface VersionListServiceParams {
  familyDid: string;
  type: "skill" | "agent";
  versions: VersionEntry[];
}

export function buildVersionListService(
  params: VersionListServiceParams,
): object {
  const shortId = params.familyDid.split(":").pop()!;
  const type = params.type;

  return {
    id: `${params.familyDid}#versions`,
    type: "VersionList",
    serviceEndpoint: `https://did-ai.io/${type}s/hub/${shortId}/versions`,
    versions: params.versions,
  };
}
