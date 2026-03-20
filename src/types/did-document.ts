export interface VerificationMethod {
  id: string;
  type: "Ed25519VerificationKey2020" | "X25519KeyAgreementKey2020";
  controller: string;
  publicKeyMultibase: string;
}

export interface ServiceEntry {
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
  service?: ServiceEntry[];
  subtype?: string;
}
