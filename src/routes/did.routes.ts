import type { FastifyInstance } from "fastify";
import { resolveDid, deactivateDid } from "../services/did.service.js";
import { didAuthMiddleware } from "../middleware/did-auth.middleware.js";

export async function didRoutes(app: FastifyInstance) {
  app.get<{ Params: { did: string } }>("/:did", async (req, reply) => {
    const doc = await resolveDid(req.params.did);
    return reply
      .header("Cache-Control", "max-age=3600")
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
