import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  createAgentFamily,
  publishAgentVersion,
  getAgentFamily,
  getAgentVersion,
  getAgentVersions,
} from "../services/agent.service.js";
import { didAuthMiddleware } from "../middleware/did-auth.middleware.js";

export async function agentRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/",
    { preHandler: didAuthMiddleware },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const callerDid = (req as FastifyRequest & { callerDid: string })
        .callerDid;
      const body = req.body as {
        name: string;
        description?: string;
        tags?: string[];
        visibility?: "public" | "unlisted" | "private";
        namespace?: string;
      };

      const result = await createAgentFamily({
        ownerDid: callerDid,
        name: body.name,
        description: body.description,
        tags: body.tags,
        visibility: body.visibility,
        namespace: body.namespace ?? "hub",
      });

      return reply.status(201).send({ success: true, data: result });
    },
  );

  app.get<{ Params: { familyDid: string } }>(
    "/:familyDid",
    async (req, reply) => {
      const family = await getAgentFamily(req.params.familyDid);
      if (!family) {
        return reply.status(404).send({
          success: false,
          error: {
            code: "FAMILY_NOT_FOUND",
            message: "Agent family not found",
          },
        });
      }
      return reply.send({ success: true, data: family });
    },
  );

  app.get<{ Params: { familyDid: string } }>(
    "/:familyDid/versions",
    async (req, reply) => {
      const versions = await getAgentVersions(req.params.familyDid);
      return reply.send({ success: true, data: versions });
    },
  );

  app.get<{ Params: { familyDid: string; versionDid: string } }>(
    "/:familyDid/versions/:versionDid",
    async (req, reply) => {
      const version = await getAgentVersion(req.params.versionDid);
      if (!version) {
        return reply.status(404).send({
          success: false,
          error: {
            code: "VERSION_NOT_FOUND",
            message: "Agent version not found",
          },
        });
      }
      return reply.send({ success: true, data: version });
    },
  );

  app.post<{ Params: { familyDid: string } }>(
    "/:familyDid/versions",
    { preHandler: didAuthMiddleware },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const callerDid = (req as FastifyRequest & { callerDid: string })
        .callerDid;
      const params = req.params as { familyDid: string };
      const body = req.body as {
        version: string;
        bumpType: "patch" | "minor" | "major";
        content: {
          skill_bindings: Array<{
            skillFamilyDid: string;
            versionPolicy: string;
            lockedVersion?: string;
            role: string;
          }>;
          orchestration_mode: "standalone" | "barn_role";
          orchestration_flow?: object;
          aggregated_tools?: object[];
          capabilities?: {
            inputFormats: string[];
            outputFormats: string[];
          };
          agent_config?: object;
          name: string;
          description?: string;
          tags?: string[];
          visibility: "public" | "unlisted" | "private";
          version: string;
          family_did: string;
        };
        contentHash: string;
        creatorSig: string;
        changelog: {
          summary: string;
          details?: object;
          migrationGuide?: object;
        };
        namespace?: string;
      };

      const result = await publishAgentVersion({
        familyDid: params.familyDid,
        ownerDid: callerDid,
        version: body.version,
        bumpType: body.bumpType,
        content: body.content,
        creatorSig: body.creatorSig,
        changelog: body.changelog,
        namespace: body.namespace ?? "hub",
      });

      return reply.status(201).send({ success: true, data: result });
    },
  );
}
