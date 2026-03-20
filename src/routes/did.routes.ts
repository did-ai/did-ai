import type { FastifyInstance } from "fastify";
import { resolveDid, deactivateDid } from "../services/did.service.js";
import { didAuthMiddleware } from "../middleware/did-auth.middleware.js";
import { sha256hex } from "../crypto/keys.js";

export async function didRoutes(app: FastifyInstance) {
  app.get<{
    Params: { did: string };
    Querystring: { version?: string; service?: string };
  }>("/:did", async (req, reply) => {
    const { version, service } = req.query;
    const result = await resolveDid(req.params.did, { version, service });

    if (result.didResolutionMetadata.error === "notFound") {
      return reply.status(404).send(result);
    }
    if (result.didResolutionMetadata.error === "deactivated") {
      return reply.status(410).send(result);
    }
    if (result.didResolutionMetadata.error === "saidMismatch") {
      return reply.status(400).send(result);
    }

    const docString = JSON.stringify(result.didDocument);
    const etag = `"${sha256hex(docString).slice(0, 32)}"`;

    return reply
      .header("Cache-Control", "max-age=3600")
      .header("ETag", etag)
      .send(result);
  });

  app.post("/", { preHandler: didAuthMiddleware }, async (_req) => {
    return { success: true, data: {} };
  });

  app.patch<{ Params: { did: string } }>(
    "/:did",
    { preHandler: didAuthMiddleware },
    async (_req) => {
      return { success: true, data: {} };
    },
  );

  app.delete<{ Params: { did: string } }>(
    "/:did",
    { preHandler: didAuthMiddleware },
    async (req, reply) => {
      const callerDid = (req as typeof req & { callerDid: string }).callerDid;
      await deactivateDid(req.params.did, callerDid);
      return reply.status(410).send({
        success: true,
        data: { deactivated: true },
        didResolutionMetadata: {},
        didDocumentMetadata: { deactivated: true },
      });
    },
  );
}
