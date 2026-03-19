export type NamespaceTier = "personal" | "organization" | "ecosystem";

export interface NamespaceTierConfig {
  minLength: number;
  maxLength: number;
  allowedHosting: ("hosted" | "self_hosted")[];
}

export const TIER_RULES: Record<NamespaceTier, NamespaceTierConfig> = {
  personal: {
    minLength: 3,
    maxLength: 20,
    allowedHosting: ["hosted"],
  },
  organization: {
    minLength: 3,
    maxLength: 30,
    allowedHosting: ["hosted", "self_hosted"],
  },
  ecosystem: {
    minLength: 3,
    maxLength: 32,
    allowedHosting: ["self_hosted"],
  },
};

export function validateNamespaceLength(
  namespace: string,
  tier: NamespaceTier,
): boolean {
  const rules = TIER_RULES[tier];
  return (
    namespace.length >= rules.minLength && namespace.length <= rules.maxLength
  );
}

export function validateNamespaceTier(
  namespace: string,
  tier: NamespaceTier,
  hosting: "hosted" | "self_hosted",
): { valid: boolean; error?: string } {
  const rules = TIER_RULES[tier];

  if (
    namespace.length < rules.minLength ||
    namespace.length > rules.maxLength
  ) {
    return {
      valid: false,
      error: `Namespace length must be between ${rules.minLength} and ${rules.maxLength} characters for ${tier} tier`,
    };
  }

  if (!rules.allowedHosting.includes(hosting)) {
    return {
      valid: false,
      error: `${tier} tier namespaces can only use ${rules.allowedHosting.join(", ")} hosting`,
    };
  }

  return { valid: true };
}
