import { test, describe, expect } from "vitest";
import { DidAiError, ErrorCode, ERROR_STATUS } from "./index.js";

describe("DidAiError", () => {
  test("should create error with code and message", () => {
    const error = new DidAiError(ErrorCode.DID_NOT_FOUND, "DID not found");
    expect(error.code).toBe(ErrorCode.DID_NOT_FOUND);
    expect(error.message).toBe("DID not found");
    expect(error.status).toBe(404);
    expect(error.name).toBe("DidAiError");
  });

  test("should include details when provided", () => {
    const error = new DidAiError(
      ErrorCode.VALIDATION_FAILED,
      "Validation failed",
      { field: "name", reason: "required" },
    );
    expect(error.details).toEqual({ field: "name", reason: "required" });
  });

  test("should have correct status codes for error codes", () => {
    expect(new DidAiError(ErrorCode.DID_NOT_FOUND, "").status).toBe(404);
    expect(new DidAiError(ErrorCode.DID_DEACTIVATED, "").status).toBe(410);
    expect(new DidAiError(ErrorCode.AUTH_REQUIRED, "").status).toBe(401);
    expect(new DidAiError(ErrorCode.INVALID_SIGNATURE, "").status).toBe(401);
    expect(new DidAiError(ErrorCode.RATE_LIMITED, "").status).toBe(429);
    expect(new DidAiError(ErrorCode.INTERNAL_ERROR, "").status).toBe(500);
  });

  test("should serialize to JSON correctly", () => {
    const error = new DidAiError(ErrorCode.DID_NOT_FOUND, "DID not found");
    const json = error.toJSON();
    expect(json).toEqual({
      code: "DID_NOT_FOUND",
      message: "DID not found",
      details: undefined,
    });
  });
});

describe("ERROR_STATUS", () => {
  test("should have status for all auth errors", () => {
    expect(ERROR_STATUS[ErrorCode.AUTH_REQUIRED]).toBe(401);
    expect(ERROR_STATUS[ErrorCode.INVALID_SIGNATURE]).toBe(401);
    expect(ERROR_STATUS[ErrorCode.TIMESTAMP_EXPIRED]).toBe(401);
    expect(ERROR_STATUS[ErrorCode.NONCE_REPLAYED]).toBe(401);
  });

  test("should have status for validation errors", () => {
    expect(ERROR_STATUS[ErrorCode.KEY_SEPARATION_VIOLATION]).toBe(400);
    expect(ERROR_STATUS[ErrorCode.AGENT_NOT_CALLABLE]).toBe(400);
    expect(ERROR_STATUS[ErrorCode.INVALID_VERSION_STATUS]).toBe(400);
    expect(ERROR_STATUS[ErrorCode.INVALID_SKILL_BINDING]).toBe(400);
  });
});
