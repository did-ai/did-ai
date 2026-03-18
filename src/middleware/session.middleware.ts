import type { FastifyRequest, FastifyReply } from "fastify";
import { pool } from "../config/database";
import { DidAiError, ErrorCode } from "../errors";

export async function sessionMiddleware(
  req: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new DidAiError(ErrorCode.AUTH_REQUIRED, "Bearer token required");
  }

  const token = authHeader.slice(7);

  const result = await pool.query(
    `SELECT session_id, developer_did, expires_at, revoked 
     FROM user_sessions 
     WHERE session_id = $1`,
    [token],
  );

  if (!result.rows[0]) {
    throw new DidAiError(ErrorCode.AUTH_REQUIRED, "Invalid session");
  }

  const session = result.rows[0];

  if (session.revoked) {
    throw new DidAiError(ErrorCode.AUTH_REQUIRED, "Session revoked");
  }

  if (new Date(session.expires_at) < new Date()) {
    throw new DidAiError(ErrorCode.AUTH_REQUIRED, "Session expired");
  }

  (req as FastifyRequest & { callerDid: string; sessionId: string }).callerDid =
    session.developer_did;
  (req as FastifyRequest & { callerDid: string; sessionId: string }).sessionId =
    session.session_id;
}
