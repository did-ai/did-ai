import { pool } from "../config/database.js";
import { redis } from "../config/redis.js";

const DEPRECIATION_DAYS = 180;

export async function checkDeprecatedVersions(): Promise<number> {
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - DEPRECIATION_DAYS);

  const skillResult = await pool.query(
    `UPDATE skill_versions
     SET status = 'deprecated',
         deprecated_since = now()
     WHERE status = 'degraded'
       AND bump_type = 'major'
       AND degraded_since < $1
     RETURNING version_did`,
    [threshold],
  );

  const agentResult = await pool.query(
    `UPDATE agent_versions
     SET status = 'deprecated',
         deprecated_since = now()
     WHERE status = 'degraded'
       AND bump_type = 'major'
       AND degraded_since < $1
     RETURNING version_did`,
    [threshold],
  );

  const deprecatedCount =
    (skillResult.rowCount ?? 0) + (agentResult.rowCount ?? 0);

  if (deprecatedCount > 0) {
    const didDocResult = await pool.query(
      `SELECT did FROM did_documents 
       WHERE type IN ('skill', 'agent') 
         AND subtype = 'family'`,
    );

    for (const row of didDocResult.rows) {
      await redis.del(`did:resolve:${row.did}`);
    }

    console.log(
      `[VersionDeprecation] Deprecated ${deprecatedCount} versions (180+ days)`,
    );
  }

  return deprecatedCount;
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startVersionDeprecationJob(intervalMs = 86400000): void {
  if (intervalId !== null) {
    console.log("[VersionDeprecation] Job already running");
    return;
  }

  console.log(`[VersionDeprecation] Starting job (interval: ${intervalMs}ms)`);

  checkDeprecatedVersions().catch((err) => {
    console.error("[VersionDeprecation] Error:", err);
  });

  intervalId = setInterval(() => {
    checkDeprecatedVersions().catch((err) => {
      console.error("[VersionDeprecation] Error:", err);
    });
  }, intervalMs);
}

export function stopVersionDeprecationJob(): void {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
    console.log("[VersionDeprecation] Job stopped");
  }
}
