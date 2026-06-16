import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync } from "node:fs";
import { dirname } from "node:path";
import type { ICachePlugin, TokenCacheContext } from "@azure/msal-node";

export function createCachePlugin(cachePath: string): ICachePlugin {
  return {
    beforeCacheAccess(ctx: TokenCacheContext): Promise<void> {
      if (existsSync(cachePath)) {
        try {
          const data = readFileSync(cachePath, "utf-8");
          ctx.tokenCache.deserialize(data);
        } catch {
          // corrupt cache — start fresh
        }
      }
      return Promise.resolve();
    },

    afterCacheAccess(ctx: TokenCacheContext): Promise<void> {
      if (ctx.cacheHasChanged) {
        try {
          const dir = dirname(cachePath);
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          const data = ctx.tokenCache.serialize();
          writeFileSync(cachePath, data, { encoding: "utf-8", mode: 0o600 });
          // Ensure restrictive permissions even if the file already existed.
          chmodSync(cachePath, 0o600);
        } catch (err) {
          // Non-fatal: tokens exist in memory; next startup will re-auth.
          process.stderr.write(`[mcp-graph] Warning: failed to persist token cache: ${err}\n`);
        }
      }
      return Promise.resolve();
    },
  };
}
