import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pool } from "../config/database.js";

const MIGRATION_DIR =
  process.env.MIGRATION_DIR ?? join(process.cwd(), "db", "migrations");

const MIGRATION_FILES = [
  "001_identity.sql",
  "002_skills.sql",
  "003_agents.sql",
];

async function getAppliedMigrations(client: {
  query: (
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: Array<{ version: string }> }>;
}): Promise<Set<string>> {
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        description TEXT
      )
    `);
    const result = await client.query("SELECT version FROM schema_migrations");
    return new Set(result.rows.map((r) => r.version));
  } catch {
    return new Set();
  }
}

async function migrate() {
  console.log("Running migrations...");
  console.log(`Migration directory: ${MIGRATION_DIR}`);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const appliedMigrations = await getAppliedMigrations(client);

    for (const migrationFile of MIGRATION_FILES) {
      const migrationName = migrationFile.replace(".sql", "");

      if (appliedMigrations.has(migrationName)) {
        console.log(`Skipping ${migrationFile} (already applied)`);
        continue;
      }

      console.log(`Applying ${migrationFile}...`);
      const migrationPath = join(MIGRATION_DIR, migrationFile);
      const migration = readFileSync(migrationPath, "utf-8");

      await client.query(migration);
      await client.query(
        "INSERT INTO schema_migrations (version) VALUES ($1)",
        [migrationName],
      );

      console.log(`${migrationFile} applied successfully`);
    }

    await client.query("COMMIT");
    console.log("All migrations completed successfully");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((error) => {
  console.error(error);
  process.exit(1);
});
