import type { GraphError } from "../types.js";
import { logError } from "./logger.js";

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

// Builds a human-readable message from an unknown thrown value. Graph SDK errors
// carry the useful detail in `code`/`statusCode`/`body` rather than just `message`
// (e.g. a 400 surfaces as "Invalid request" unless we read the body), so pull
// those out to make failures actionable instead of opaque.
export function describeError(err: unknown): string {
  // Surface the full error to the debug log (no-op unless GRAPH_DEBUG is set).
  logError("tool", "operation failed:", err);

  if (typeof err === "object" && err !== null) {
    const e = err as {
      code?: unknown;
      statusCode?: unknown;
      message?: unknown;
      body?: unknown;
    };

    let bodyMessage: string | undefined;
    if (typeof e.body === "string" && e.body) {
      try {
        const parsed = JSON.parse(e.body) as { error?: { message?: string }; message?: string };
        bodyMessage = parsed?.error?.message ?? parsed?.message;
      } catch {
        // body wasn't JSON — ignore
      }
    }

    const code = typeof e.code === "string" ? e.code : undefined;
    const detail = bodyMessage ?? (typeof e.message === "string" ? e.message : undefined);
    const head = [code, detail].filter(Boolean).join(": ");
    if (head) {
      return typeof e.statusCode === "number" ? `${head} (HTTP ${e.statusCode})` : head;
    }
  }

  if (err instanceof Error) return err.message;
  return String(err);
}

export function toolResult(data: unknown): { content: [{ type: "text"; text: string }] } {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}
