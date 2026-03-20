import { DidAiError, ErrorCode } from "../errors/index.js";

interface VerificationMethod {
  id: string;
  type: string;
  controller: string;
  publicKeyMultibase: string;
}

interface DIDDocument {
  verificationMethod?: VerificationMethod[];
  assertionMethod?: string[];
  authentication?: string[];
  capabilityInvocation?: string[];
  capabilityDelegation?: string[];
  keyAgreement?: string[];
  service?: Array<{ type: string; [key: string]: unknown }>;
}

interface SkillBinding {
  skillFamilyDid: string;
  versionPolicy: string;
  lockedVersion?: string;
  role: string;
}

export function validateKeySeparation(doc: DIDDocument): void {
  if (!doc.verificationMethod) return;

  const vmIds = new Set<string>();

  for (const vm of doc.verificationMethod) {
    if (vmIds.has(vm.id)) {
      throw new DidAiError(
        ErrorCode.INVALID_DID_DOCUMENT,
        `Duplicate VM id: ${vm.id}`,
      );
    }
    vmIds.add(vm.id);

    if (vm.type === "Ed25519VerificationKey2020") {
      const isInKeyAgreement = doc.keyAgreement?.some(
        (ref) =>
          ref === vm.id ||
          ref ===
            `${doc.verificationMethod?.find((v) => v.id === vm.id)?.controller}#encryption-key`,
      );
      if (isInKeyAgreement) {
        throw new DidAiError(
          ErrorCode.KEY_SEPARATION_VIOLATION,
          `Ed25519 key ${vm.id} must not be in keyAgreement`,
        );
      }
    }

    if (vm.type === "X25519KeyAgreementKey2020") {
      const isInSigningRole =
        doc.assertionMethod?.some((ref) => ref === vm.id) ||
        doc.authentication?.some((ref) => ref === vm.id) ||
        doc.capabilityInvocation?.some((ref) => ref === vm.id);

      if (isInSigningRole) {
        throw new DidAiError(
          ErrorCode.KEY_SEPARATION_VIOLATION,
          `X25519 key ${vm.id} must not be in assertionMethod/authentication/capabilityInvocation`,
        );
      }
    }
  }

  const signingKey = doc.verificationMethod?.find((vm) =>
    doc.assertionMethod?.includes(vm.id),
  );
  const rotationKey = doc.verificationMethod?.find((vm) =>
    doc.capabilityInvocation?.includes(vm.id),
  );

  if (
    signingKey &&
    rotationKey &&
    signingKey.publicKeyMultibase === rotationKey.publicKeyMultibase
  ) {
    throw new DidAiError(
      ErrorCode.KEY_SEPARATION_VIOLATION,
      "Signing Key and Rotation Key must be distinct",
    );
  }
}

export function validateSkillAgentConstraints(doc: DIDDocument): void {
  if (doc.verificationMethod?.length) {
    throw new DidAiError(
      ErrorCode.INVALID_DID_DOCUMENT,
      "Skill/Agent DID must not contain verificationMethod",
    );
  }

  if (
    doc.assertionMethod?.length ||
    doc.authentication?.length ||
    doc.capabilityInvocation?.length ||
    doc.keyAgreement?.length
  ) {
    throw new DidAiError(
      ErrorCode.INVALID_DID_DOCUMENT,
      "Skill/Agent DID must not contain verification relationships",
    );
  }
}

export function validateAgentConstraints(doc: DIDDocument): void {
  validateSkillAgentConstraints(doc);

  const services = doc.service ?? [];
  const serviceTypes = services.map((s) => s.type);

  if (serviceTypes.includes("AgentVersion")) {
    if (!serviceTypes.includes("AgentProfile")) {
      throw new DidAiError(
        ErrorCode.AGENT_NOT_CALLABLE,
        "AgentVersion MUST include an AgentProfile service",
      );
    }
  }

  for (const svc of services) {
    if ("serviceEndpoint" in svc) {
      const endpoint = svc.serviceEndpoint;
      if (typeof endpoint === "string" && /^https?:\/\//i.test(endpoint)) {
        throw new DidAiError(
          ErrorCode.AGENT_NOT_CALLABLE,
          "Agent DID must not contain network serviceEndpoint",
        );
      }
      if (typeof endpoint === "object" && endpoint !== null) {
        const uri = (endpoint as { uri?: string }).uri;
        if (uri && /^https?:\/\//i.test(uri)) {
          throw new DidAiError(
            ErrorCode.AGENT_NOT_CALLABLE,
            "Agent DID must not contain network serviceEndpoint",
          );
        }
      }
    }

    if (svc.type === "DIDCommMessaging") {
      throw new DidAiError(
        ErrorCode.AGENT_NOT_CALLABLE,
        "Agent DID must not contain DIDCommMessaging service",
      );
    }
  }
}

export function validateVersionStatus(status: string): void {
  const VALID_STATUSES = ["active", "degraded", "deprecated"];
  if (!VALID_STATUSES.includes(status)) {
    throw new DidAiError(
      ErrorCode.INVALID_VERSION_STATUS,
      `Invalid status "${status}". Must be one of: ${VALID_STATUSES.join(", ")}`,
    );
  }
}

export function validateSkillBindings(bindings: SkillBinding[]): void {
  const VALID_ROLES = ["primary", "fallback"];
  const VALID_POLICIES = ["locked", "auto_patch", "auto_minor"];

  for (const binding of bindings) {
    if (!VALID_ROLES.includes(binding.role)) {
      throw new DidAiError(
        ErrorCode.INVALID_SKILL_BINDING,
        `Invalid role "${binding.role}". Must be one of: ${VALID_ROLES.join(", ")}`,
      );
    }

    if (!VALID_POLICIES.includes(binding.versionPolicy)) {
      throw new DidAiError(
        ErrorCode.INVALID_SKILL_BINDING,
        `Invalid versionPolicy "${binding.versionPolicy}". Must be one of: ${VALID_POLICIES.join(", ")}`,
      );
    }

    if (binding.versionPolicy === "locked" && !binding.lockedVersion) {
      throw new DidAiError(
        ErrorCode.INVALID_SKILL_BINDING,
        `locked policy requires lockedVersion for ${binding.skillFamilyDid}`,
      );
    }
  }
}
