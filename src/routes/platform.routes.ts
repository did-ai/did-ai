import type { FastifyInstance } from "fastify";

export async function platformRoutes(app: FastifyInstance) {
  app.get("/public-key", async () => ({
    success: true,
    data: {
      signingKey: {
        publicKeyMultibase: process.env.PLATFORM_SIGNING_PUBLIC_KEY ?? "",
        keyType: "Ed25519VerificationKey2020",
        usage: ["assertionMethod", "authentication"],
        description: "Used to verify platform-issued VCs",
      },
      encryptionKey: {
        publicKeyMultibase: process.env.PLATFORM_ENCRYPTION_PUBLIC_KEY ?? "",
        keyType: "X25519KeyAgreementKey2020",
        usage: ["keyAgreement"],
        description: "Used to wrap Skill content encryption keys (CEK)",
      },
    },
  }));
}
