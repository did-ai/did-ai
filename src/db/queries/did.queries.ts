import { pool } from "../../config/database.js";

export interface DIDDocumentRow {
  id: string;
  did: string;
  type: string;
  subtype: string;
  namespace: string;
  unique_id: string;
  document: object;
  status: string;
  is_platform: boolean;
  created_at: Date;
  updated_at: Date;
}

export async function findDidByDid(
  did: string,
): Promise<DIDDocumentRow | null> {
  const result = await pool.query(
    "SELECT * FROM did_documents WHERE did = $1",
    [did],
  );
  return result.rows[0] ?? null;
}

export async function findDidsByNamespace(
  namespace: string,
): Promise<DIDDocumentRow[]> {
  const result = await pool.query(
    "SELECT * FROM did_documents WHERE namespace = $1 ORDER BY created_at DESC",
    [namespace],
  );
  return result.rows;
}

export async function findDidsByType(type: string): Promise<DIDDocumentRow[]> {
  const result = await pool.query(
    "SELECT * FROM did_documents WHERE type = $1 ORDER BY created_at DESC",
    [type],
  );
  return result.rows;
}

export async function insertDidDocument(params: {
  did: string;
  type: string;
  subtype: string;
  namespace: string;
  unique_id: string;
  document: object;
  status?: string;
  is_platform?: boolean;
}): Promise<DIDDocumentRow> {
  const result = await pool.query(
    `INSERT INTO did_documents 
     (did, type, subtype, namespace, unique_id, document, status, is_platform)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      params.did,
      params.type,
      params.subtype,
      params.namespace,
      params.unique_id,
      JSON.stringify(params.document),
      params.status ?? "active",
      params.is_platform ?? false,
    ],
  );
  return result.rows[0];
}

export async function updateDidDocument(
  did: string,
  updates: { document?: object; status?: string },
): Promise<DIDDocumentRow | null> {
  const setClauses: string[] = ["updated_at = now()"];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (updates.document !== undefined) {
    setClauses.push(`document = $${paramIndex++}`);
    values.push(JSON.stringify(updates.document));
  }
  if (updates.status !== undefined) {
    setClauses.push(`status = $${paramIndex++}`);
    values.push(updates.status);
  }

  values.push(did);

  const result = await pool.query(
    `UPDATE did_documents SET ${setClauses.join(", ")} WHERE did = $${paramIndex} RETURNING *`,
    values,
  );
  return result.rows[0] ?? null;
}

export async function insertDidVersion(params: {
  did_id: string;
  did: string;
  version_num: number;
  document: object;
  changed_by: string;
}): Promise<void> {
  await pool.query(
    `INSERT INTO did_versions (did_id, did, version_num, document, changed_by)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      params.did_id,
      params.did,
      params.version_num,
      JSON.stringify(params.document),
      params.changed_by,
    ],
  );
}

export async function findDidVersions(
  did: string,
): Promise<
  Array<{ id: string; version_num: number; document: object; created_at: Date }>
> {
  const result = await pool.query(
    "SELECT id, version_num, document, created_at FROM did_versions WHERE did = $1 ORDER BY version_num DESC",
    [did],
  );
  return result.rows;
}
