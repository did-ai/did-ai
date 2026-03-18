import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  createSkillFamily,
  publishSkillVersion,
  getSkillFamily,
  getSkillVersion,
  getSkillVersions,
  getSkillContent,
  getSkillChangelog,
} from "../services/skill.service.js";
import { didAuthMiddleware } from "../middleware/did-auth.middleware.js";

export async function skillRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/",
    { preHandler: didAuthMiddleware },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const callerDid = (req as FastifyRequest & { callerDid: string })
        .callerDid;
      const body = req.body as {
        name: string;
        description?: string;
        category?: string;
        tags?: string[];
        namespace?: string;
      };

      const result = await createSkillFamily({
        ownerDid: callerDid,
        name: body.name,
        description: body.description,
        category: body.category,
        tags: body.tags,
        namespace: body.namespace ?? "hub",
      });

      return reply.status(201).send({ success: true, data: result });
    },
  );

  app.get<{ Params: { familyDid: string } }>(
    "/:familyDid",
    async (req, reply) => {
      const family = await getSkillFamily(req.params.familyDid);
      if (!family) {
        return reply.status(404).send({
          success: false,
          error: {
            code: "FAMILY_NOT_FOUND",
            message: "Skill family not found",
          },
        });
      }
      return reply.send({ success: true, data: family });
    },
  );

  app.get<{ Params: { familyDid: string }; Querystring: { version?: string } }>(
    "/:familyDid/versions",
    async (req, reply) => {
      const versions = await getSkillVersions(req.params.familyDid);
      return reply.send({ success: true, data: versions });
    },
  );

  app.get<{ Params: { familyDid: string; versionDid: string } }>(
    "/:familyDid/versions/:versionDid",
    async (req, reply) => {
      const version = await getSkillVersion(req.params.versionDid);
      if (!version) {
        return reply.status(404).send({
          success: false,
          error: {
            code: "VERSION_NOT_FOUND",
            message: "Skill version not found",
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
          system_prompt: string;
          input_schema: object;
          output_schema: object;
          test_cases: object[];
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

      const result = await publishSkillVersion({
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

  app.get<{ Params: { familyDid: string } }>(
    "/:familyDid/content",
    async (req, reply) => {
      const content = await getSkillContent(req.params.familyDid);
      if (!content) {
        return reply.status(404).send({
          success: false,
          error: {
            code: "VERSION_NOT_FOUND",
            message: "No active version found",
          },
        });
      }
      return reply.send({ success: true, data: content });
    },
  );

  app.get<{ Params: { familyDid: string } }>(
    "/:familyDid/changelog/:version",
    async (req, reply) => {
      const params = req.params as { familyDid: string; version: string };
      const changelog = await getSkillChangelog(
        params.familyDid,
        params.version,
      );
      if (!changelog) {
        return reply.status(404).send({
          success: false,
          error: { code: "VERSION_NOT_FOUND", message: "Changelog not found" },
        });
      }
      return reply.send({ success: true, data: changelog });
    },
  );
}
