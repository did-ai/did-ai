import type { FastifyInstance } from "fastify";
import { getPlatformKeys } from "../config/platform-keys.js";

export async function platformRoutes(app: FastifyInstance) {
  app.get("/public-key", async (_req, reply) => {
    const keys = getPlatformKeys();
    return reply.send({
      success: true,
      data: keys,
    });
  });
}
