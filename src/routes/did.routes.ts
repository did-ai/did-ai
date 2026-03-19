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
    const doc = await resolveDid(req.params.did, { version, service });

    const docString = JSON.stringify(doc);
    const etag = `"${sha256hex(docString).slice(0, 32)}"`;

    return reply
      .header("Cache-Control", "max-age=3600")
      .header("ETag", etag)
      .send({ success: true, data: doc });
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
    async (req) => {
      const callerDid = (req as typeof req & { callerDid: string }).callerDid;
      await deactivateDid(req.params.did, callerDid);
      return { success: true, data: { deactivated: true } };
    },
  );
}
