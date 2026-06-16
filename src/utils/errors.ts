import type { GraphError } from "../types.js";

// Known Graph error codes that are worth retrying (throttling, transient).
const RETRYABLE_CODES = new Set([
  "activityLimitReached",
  "serviceNotAvailable",
  "timeout",
  "tooManyRetries",
]);

export function normalizeGraphError(err: unknown): GraphError {
  if (isGraphError(err)) {
    return {
      error: {
        code: err.code ?? "UnknownError",
        message: err.message ?? "An unexpected error occurred.",
        retryable: RETRYABLE_CODES.has(err.code ?? ""),
      },
    };
  }
  if (err instanceof Error) {
    return {
      error: { code: "ClientError", message: err.message, retryable: false },
    };
  }
  return {
    error: { code: "UnknownError", message: String(err), retryable: false },
  };
}

// Graph client surfaces errors as objects with a `code` property. `message` is
// optional, but when present it must be a string so it can safely flow into the
// GraphError contract.
function isGraphError(err: unknown): err is { code: string; message?: string } {
  if (typeof err !== "object" || err === null || !("code" in err)) {
    return false;
  }
  const record = err as Record<string, unknown>;
  if (typeof record.code !== "string") return false;
  return record.message === undefined || typeof record.message === "string";
}

export function toolError(message: string): { content: [{ type: "text"; text: string }] } {
  return { content: [{ type: "text" as const, text: `Error: ${message}` }] };
}

export function toolResult(data: unknown): { content: [{ type: "text"; text: string }] } {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}
