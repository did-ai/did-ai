export interface VerificationMethod {
  id: string;
  type: string;
  controller: string;
  publicKeyMultibase: string;
}

export interface ServiceEndpoint {
  id: string;
  type: string;
  serviceEndpoint: string;
}

export interface DIDDocument {
  "@context": string[];
  id: string;
  controller?: string | string[];
  verificationMethod?: VerificationMethod[];
  authentication?: (string | VerificationMethod)[];
  assertionMethod?: (string | VerificationMethod)[];
  capabilityDelegation?: (string | VerificationMethod)[];
  capabilityInvocation?: (string | VerificationMethod)[];
  keyAgreement?: (string | VerificationMethod)[];
  service?: ServiceEndpoint[];
  created?: string;
  updated?: string;
  deactivated?: boolean;
}

export interface DIDMetadata {
  created: string;
  updated: string;
  versionId: number;
  deactivated: boolean;
}

export interface DIDState {
  document: DIDDocument;
  metadata: DIDMetadata;
}

export interface DIDResolutionResult {
  "@context": string;
  didResolutionMetadata: {
    contentType: string;
    error?: string;
  };
  didDocument?: DIDDocument;
  didDocumentMetadata?: DIDMetadata;
}

export enum DIDType {
  Developer = "Developer",
  SkillFamily = "SkillFamily",
  SkillVersion = "SkillVersion",
  AgentFamily = "AgentFamily",
  AgentVersion = "AgentVersion",
}

export const REQUIRED_SERVICE_TYPES: Record<DIDType, string[]> = {
  [DIDType.Developer]: ["DeveloperProfile", "PublishedAssets"],
  [DIDType.SkillFamily]: ["SkillFamily"],
  [DIDType.SkillVersion]: ["SkillVersion"],
  [DIDType.AgentFamily]: ["AgentFamily"],
  [DIDType.AgentVersion]: ["AgentVersion", "AgentProfile"],
};
