import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  discoverSkills,
  discoverAgents,
} from "../services/discovery.service.js";

export async function discoveryRoutes(app: FastifyInstance): Promise<void> {
  app.get("/skills", async (req: FastifyRequest, reply: FastifyReply) => {
    const query = req.query as {
      q?: string;
      tags?: string;
      limit?: string;
      offset?: string;
    };

    const result = await discoverSkills({
      q: query.q,
      tags: query.tags ? query.tags.split(",") : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      offset: query.offset ? parseInt(query.offset, 10) : undefined,
    });

    return reply
      .header("Cache-Control", "max-age=300")
      .send({ success: true, data: result });
  });

  app.get("/agents", async (req: FastifyRequest, reply: FastifyReply) => {
    const query = req.query as {
      q?: string;
      tags?: string;
      limit?: string;
      offset?: string;
    };

    const result = await discoverAgents({
      q: query.q,
      tags: query.tags ? query.tags.split(",") : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      offset: query.offset ? parseInt(query.offset, 10) : undefined,
    });

    return reply
      .header("Cache-Control", "max-age=300")
      .send({ success: true, data: result });
  });
}
