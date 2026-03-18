import { ErrorCode, ERROR_STATUS } from "./codes.js";

export { ErrorCode, ERROR_STATUS };

export class DidAiError extends Error {
  public readonly code: ErrorCode;
  public readonly status: number;
  public readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "DidAiError";
    this.code = code;
    this.status = ERROR_STATUS[code];
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}
