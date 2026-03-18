import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pool } from "../config/database.js";

const MIGRATION_DIR = process.env.MIGRATION_DIR ?? join(process.cwd(), "db", "migrations");

async function migrate() {
  console.log("Running migrations...");
  console.log(`Migration directory: ${MIGRATION_DIR}`);
  
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");
    
    const migrationPath = join(MIGRATION_DIR, "001_initial.sql");
    const migration = readFileSync(migrationPath, "utf-8");
    
    await client.query(migration);
    
    await client.query("COMMIT");
    console.log("Migrations completed successfully");
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
