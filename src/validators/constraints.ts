import { DidAiError, ErrorCode } from "../errors";

interface DIDDocument {
  verificationMethod?: Array<{
    id: string;
    type: string;
    keyAgreement?: string[];
    assertionMethod?: string[];
  }>;
  service?: Array<{ type: string; [key: string]: unknown }>;
}

interface SkillBinding {
  skillFamilyDid: string;
  versionPolicy: string;
  lockedVersion?: string;
  role: string;
}

const KEY_SEPARATION = {
  assertionMethod: ["Ed25519VerificationKey2020"] as const,
  keyAgreement: ["X25519KeyAgreementKey2020"] as const,
} as const;

export function validateKeySeparation(doc: DIDDocument): void {
  if (!doc.verificationMethod) return;

  for (const vm of doc.verificationMethod) {
    const keyType = vm.type;

    if (
      vm.assertionMethod?.length &&
      !(KEY_SEPARATION.assertionMethod as readonly string[]).includes(keyType)
    ) {
      throw new DidAiError(
        ErrorCode.KEY_SEPARATION_VIOLATION,
        `Key ${vm.id} in assertionMethod must be Ed25519, got ${keyType}`,
      );
    }

    if (
      vm.keyAgreement?.length &&
      !(KEY_SEPARATION.keyAgreement as readonly string[]).includes(keyType)
    ) {
      throw new DidAiError(
        ErrorCode.KEY_SEPARATION_VIOLATION,
        `Key ${vm.id} in keyAgreement must be X25519, got ${keyType}`,
      );
    }
  }
}

export function validateAgentConstraints(doc: DIDDocument): void {
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
