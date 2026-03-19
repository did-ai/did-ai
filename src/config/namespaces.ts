export const RESERVED_NAMESPACES = new Set([
  "hub",
  "platform",
  "system",
  "admin",
  "root",
  "registry",
  "resolver",
  "did-ai",
  "didaei",
  "official",
  "verified",
  "certified",
  "trusted",
  "real",
  "openai",
  "anthropic",
  "google",
  "microsoft",
  "apple",
  "meta",
  "amazon",
  "alibaba",
  "tencent",
  "baidu",
  "barn",
  "cowshed",
  "call",
  "host",
]);

export function isReservedNamespace(namespace: string): boolean {
  return RESERVED_NAMESPACES.has(namespace.toLowerCase());
}
