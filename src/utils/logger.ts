import { appendFileSync } from "node:fs";
import { inspect } from "node:util";
import { config } from "../config.js";

// IMPORTANT: never write to stdout — it carries the MCP JSON-RPC protocol.
// All diagnostics go to stderr (visible in the MCP client's server logs) and,
// optionally, to the file named by GRAPH_LOG_FILE.
function write(line: string): void {
  process.stderr.write(line + "\n");
  if (config.logFile) {
    try {
      appendFileSync(config.logFile, line + "\n");
    } catch {
      // never let logging break a request
    }
  }
}

function stamp(scope: string): string {
  return `[${new Date().toISOString()}] [graph:${scope}]`;
}

export function logDebug(scope: string, message: string, data?: unknown): void {
  if (!config.debug) return;
  let line = `${stamp(scope)} ${message}`;
  if (data !== undefined) line += " " + inspect(data, { depth: 4, breakLength: 120 });
  write(line);
}

// Reduces an unknown thrown value to the fields that matter for Graph debugging.
export function serializeError(err: unknown): Record<string, unknown> {
  if (typeof err === "object" && err !== null) {
    const e = err as Record<string, unknown>;
    return {
      name: e.name,
      message: e.message,
      code: e.code,
      statusCode: e.statusCode,
      requestId: e.requestId,
      body: e.body,
      ...(config.debug ? { stack: e.stack } : {}),
    };
  }
  return { value: String(err) };
}

export function logError(scope: string, message: string, err: unknown): void {
  if (!config.debug) return;
  write(`${stamp(scope)} ${message} ` + inspect(serializeError(err), { depth: 5, breakLength: 120 }));
}
