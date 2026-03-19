import { randomBytes } from "node:crypto";

const REQUIRED_ENV_VARS = [
  "NODE_ENV",
  "PORT",
  "POSTGRES_HOST",
  "POSTGRES_PORT",
  "POSTGRES_USER",
  "POSTGRES_PASSWORD",
  "POSTGRES_DB",
  "REDIS_HOST",
  "REDIS_PORT",
] as const;

function generateSecretIfNeeded(
  _key: string,
  value: string | undefined,
): string {
  if (value && value !== "change_me_in_production") {
    return value;
  }
  return randomBytes(32).toString("hex");
}

function getEnv(key: string): string {
  const value = process.env[key];
  if (!value && key !== "JWT_SECRET") {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value ?? "";
}

export const config = {
  nodeEnv: getEnv("NODE_ENV"),
  port: parseInt(getEnv("PORT"), 10),

  postgres: {
    host: getEnv("POSTGRES_HOST"),
    port: parseInt(getEnv("POSTGRES_PORT"), 10),
    user: getEnv("POSTGRES_USER"),
    password: getEnv("POSTGRES_PASSWORD"),
    database: getEnv("POSTGRES_DB"),
  },

  redis: {
    host: getEnv("REDIS_HOST"),
    port: parseInt(getEnv("REDIS_PORT"), 10),
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
  },

  jwtSecret: generateSecretIfNeeded("JWT_SECRET", process.env.JWT_SECRET),
  logLevel: process.env.LOG_LEVEL ?? "info",

  cacheTtl: {
    did: parseInt(process.env.CACHE_TTL_DID ?? "3600", 10),
    document: parseInt(process.env.CACHE_TTL_DOCUMENT ?? "86400", 10),
    metadata: parseInt(process.env.CACHE_TTL_METADATA ?? "300", 10),
  },
} as const;

export function validateEnv(): void {
  for (const key of REQUIRED_ENV_VARS) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
}
