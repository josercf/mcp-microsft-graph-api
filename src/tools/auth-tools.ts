import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  initiateDeviceCodeFlow,
  completeDeviceCodeFlow,
  removeMsalAccount,
} from "../auth/msal.js";
import {
  listAccounts,
  getDefaultAccountId,
  setDefaultAccount,
  removeAccount,
} from "../auth/accounts.js";
import { getGraphClient } from "../graph/client.js";
import { toolResult, toolError } from "../utils/errors.js";

export function registerAuthTools(server: McpServer): void {
  // ── add_account ────────────────────────────────────────────────────────────
  server.tool(
    "add_account",
    "Starts a Device Code Flow to connect a new Microsoft account (personal or work). " +
      "Returns a verification URL and short code to open in any browser. " +
      "After authenticating, call confirm_account_auth with the returned userCode.",
    {
      tenant: z
        .string()
        .optional()
        .describe(
          "Optional tenant override: 'common' (default), 'consumers' (personal only), " +
            "'organizations' (work only), or a specific tenant GUID."
        ),
    },
    async ({ tenant }) => {
      try {
        const pending = await initiateDeviceCodeFlow(tenant);
        return toolResult({
          status: "pending",
          userCode: pending.userCode,
          verificationUri: pending.verificationUri,
          message: pending.message,
          instructions:
            `1. Open ${pending.verificationUri} in your browser.\n` +
            `2. Enter the code: ${pending.userCode}\n` +
            `3. Sign in with your Microsoft account.\n` +
            `4. After authenticating, call confirm_account_auth with userCode: "${pending.userCode}"`,
          expiresAt: pending.expiresAt.toISOString(),
        });
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── confirm_account_auth ───────────────────────────────────────────────────
  server.tool(
    "confirm_account_auth",
    "Completes account authentication after the user has finished the Device Code Flow. " +
      "Call this with the userCode returned by add_account, after the user has authenticated in the browser.",
    {
      userCode: z.string().describe("The userCode returned by add_account (e.g. 'ABCD-1234')."),
    },
    async ({ userCode }) => {
      try {
        const account = await completeDeviceCodeFlow(userCode);
        return toolResult({
          status: "connected",
          account,
          message: `Account '${account.name}' (${account.username}) connected successfully.`,
        });
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── list_accounts ──────────────────────────────────────────────────────────
  server.tool(
    "list_accounts",
    "Lists all connected Microsoft accounts.",
    {},
    async () => {
      try {
        const accounts = listAccounts();
        const defaultId = getDefaultAccountId();
        return toolResult({
          accounts: accounts.map((a) => ({ ...a, isDefault: a.accountId === defaultId })),
          defaultAccountId: defaultId,
          total: accounts.length,
        });
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── set_default_account ────────────────────────────────────────────────────
  server.tool(
    "set_default_account",
    "Sets which connected account is used by default when no accountId is specified.",
    {
      accountId: z.string().describe("The accountId of the account to set as default."),
    },
    async ({ accountId }) => {
      try {
        setDefaultAccount(accountId);
        return toolResult({ defaultAccountId: accountId });
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── remove_account ─────────────────────────────────────────────────────────
  server.tool(
    "remove_account",
    "Removes a connected account and deletes its tokens from local cache. " +
      "Does NOT revoke consent in Azure — visit https://myapps.microsoft.com for full revocation.",
    {
      accountId: z.string().describe("The accountId of the account to remove."),
    },
    async ({ accountId }) => {
      try {
        await removeMsalAccount(accountId);
        const result = removeAccount(accountId);
        return toolResult({ removed: true, ...result });
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── whoami ─────────────────────────────────────────────────────────────────
  server.tool(
    "whoami",
    "Returns the Microsoft profile of the specified account (or default account), " +
      "confirming authentication is working.",
    {
      accountId: z
        .string()
        .optional()
        .describe("Account to inspect. Defaults to the default account."),
    },
    async ({ accountId }) => {
      try {
        const client = getGraphClient(accountId);
        const me = await client
          .api("/me")
          .select("id,displayName,mail,userPrincipalName,jobTitle,officeLocation")
          .get() as Record<string, unknown>;
        return toolResult(me);
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );
}
