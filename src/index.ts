import Fastify from "fastify";
import cors from "@fastify/cors";
import { config, validateEnv } from "./config/index.js";
import { testConnection as testDb } from "./config/database.js";
import { testConnection as testRedis } from "./config/redis.js";
import { DidAiError, ErrorCode } from "./errors/index.js";
import { platformRoutes } from "./routes/platform.routes.js";
import { didRoutes } from "./routes/did.routes.js";
import { skillRoutes } from "./routes/skill.routes.js";
import { agentRoutes } from "./routes/agent.routes.js";
import { discoveryRoutes } from "./routes/discovery.routes.js";

const fastify = Fastify({
  logger: {
    level: config.logLevel,
  },
});

await fastify.register(cors, {
  origin: true,
  credentials: true,
});

await fastify.register(platformRoutes, { prefix: "/api/v1/platform" });
await fastify.register(didRoutes, { prefix: "/api/v1/dids" });
await fastify.register(skillRoutes, { prefix: "/api/v1/skills" });
await fastify.register(agentRoutes, { prefix: "/api/v1/agents" });
await fastify.register(discoveryRoutes, { prefix: "/api/v1/discover" });

fastify.get("/health", async () => {
  const dbHealth = await testDb();
  const redisHealth = await testRedis();

  return {
    status: dbHealth && redisHealth ? "healthy" : "unhealthy",
    timestamp: new Date().toISOString(),
    services: {
      database: dbHealth ? "connected" : "disconnected",
      redis: redisHealth ? "connected" : "disconnected",
    },
  };
});

fastify.setErrorHandler((error, _request, reply) => {
  if (error instanceof DidAiError) {
    return reply.status(error.status).send(error.toJSON());
  }

  fastify.log.error(error);
  return reply.status(500).send({
    code: ErrorCode.INTERNAL_ERROR,
    message: "Internal server error",
  });
});

async function start() {
  try {
    validateEnv();

    const dbConnected = await testDb();
    if (!dbConnected) {
      throw new Error("Failed to connect to database");
    }

    const redisConnected = await testRedis();
    if (!redisConnected) {
      throw new Error("Failed to connect to Redis");
    }

    await fastify.listen({ port: config.port, host: "0.0.0.0" });
    console.log(`Server running at http://localhost:${config.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();

export { fastify };
