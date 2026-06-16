import {
  PublicClientApplication,
  type Configuration,
  type AuthenticationResult,
  type AccountInfo,
  InteractionRequiredAuthError,
} from "@azure/msal-node";
import { config } from "../config.js";
import { createCachePlugin } from "./tokenCache.js";
import { upsertAccount } from "./accounts.js";
import type { Account, PendingAuth } from "../types.js";

let _pca: PublicClientApplication | null = null;

function getPca(): PublicClientApplication {
  if (_pca) return _pca;

  if (!config.clientId) {
    throw new Error(
      "MISSING_CLIENT_ID: GRAPH_CLIENT_ID environment variable is not set. " +
        "Register an app in Azure AD and set the client ID."
    );
  }

  const msalConfig: Configuration = {
    auth: {
      clientId: config.clientId,
      authority: `https://login.microsoftonline.com/${config.tenant}`,
    },
    cache: {
      cachePlugin: createCachePlugin(config.tokenCachePath),
    },
    system: {
      loggerOptions: {
        loggerCallback: () => {},
        piiLoggingEnabled: false,
      },
    },
  };

  _pca = new PublicClientApplication(msalConfig);
  return _pca;
}

// Maps userCode → pending auth state so tools can be split across two calls.
const pendingAuths = new Map<string, PendingAuth>();

// Drop any pending auths whose device code has already expired. This keeps the
// Map from growing without bound when a user starts add_account but never
// confirms it in a long-running server process.
function prunePendingAuths(): void {
  const now = Date.now();
  for (const [code, pending] of pendingAuths) {
    if (now > pending.expiresAt.getTime()) {
      pendingAuths.delete(code);
    }
  }
}

export async function initiateDeviceCodeFlow(tenant?: string): Promise<PendingAuth> {
  prunePendingAuths();
  const pca = tenant ? buildPcaForTenant(tenant) : getPca();

  let resolvePending!: (info: { userCode: string; verificationUri: string; message: string }) => void;
  const pendingInfo = new Promise<{ userCode: string; verificationUri: string; message: string }>(
    (res) => { resolvePending = res; }
  );

  const authPromise = pca.acquireTokenByDeviceCode({
    scopes: config.scopes,
    deviceCodeCallback: (response) => {
      resolvePending({
        userCode: response.userCode,
        verificationUri: response.verificationUri,
        message: response.message,
      });
    },
  });

  // Wait only for the device code to arrive, not for the user to authenticate.
  const { userCode, verificationUri, message } = await pendingInfo;

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min default
  const pending: PendingAuth = {
    promise: authPromise,
    userCode,
    verificationUri,
    message,
    expiresAt,
  };
  pendingAuths.set(userCode, pending);

  // Guarantee the entry is dropped once the code expires even if the user never
  // calls confirm_account_auth. unref() so this timer never keeps the process alive.
  const ttl = Math.max(0, expiresAt.getTime() - Date.now());
  const cleanup = setTimeout(() => {
    if (pendingAuths.get(userCode) === pending) {
      pendingAuths.delete(userCode);
    }
  }, ttl);
  if (typeof cleanup.unref === "function") cleanup.unref();

  // The auth promise may reject (e.g. code expires) without ever being awaited by
  // confirm_account_auth. Attach a no-op catch to avoid an unhandled rejection.
  authPromise.catch(() => {});

  return pending;
}

export async function completeDeviceCodeFlow(userCode: string): Promise<Account> {
  const pending = pendingAuths.get(userCode);
  if (!pending) {
    throw new Error(
      `PENDING_AUTH_NOT_FOUND: No pending authentication for code '${userCode}'. ` +
        "Start a new flow with add_account."
    );
  }

  if (new Date() > pending.expiresAt) {
    pendingAuths.delete(userCode);
    throw new Error("DEVICE_CODE_EXPIRED: The authentication code has expired. Use add_account to start again.");
  }

  let result: AuthenticationResult | null;
  try {
    result = await pending.promise;
  } catch (err) {
    pendingAuths.delete(userCode);
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`AUTH_FAILED: Authentication failed: ${msg}`);
  }

  pendingAuths.delete(userCode);

  if (!result?.account) {
    throw new Error("AUTH_FAILED: Authentication completed but no account was returned.");
  }

  const account = msalAccountToAccount(result.account);
  upsertAccount(account);
  return account;
}

export async function acquireToken(accountId: string): Promise<string> {
  const pca = getPca();
  const msalAccounts = await pca.getTokenCache().getAllAccounts();
  const msalAccount = msalAccounts.find((a) => a.homeAccountId === accountId);

  if (!msalAccount) {
    throw new Error(
      `REAUTH_REQUIRED: Account '${accountId}' not found in token cache. Use add_account to re-authenticate.`
    );
  }

  try {
    const result = await pca.acquireTokenSilent({
      scopes: config.scopes,
      account: msalAccount,
    });
    if (!result?.accessToken) throw new Error("Empty token result");
    return result.accessToken;
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) {
      throw new Error(
        `REAUTH_REQUIRED: The token for account '${accountId}' has expired or was revoked. ` +
          "Use add_account to re-authenticate."
      );
    }
    throw err;
  }
}

export async function removeMsalAccount(accountId: string): Promise<void> {
  const pca = getPca();
  const accounts = await pca.getTokenCache().getAllAccounts();
  const account = accounts.find((a) => a.homeAccountId === accountId);
  if (account) {
    await pca.getTokenCache().removeAccount(account);
  }
}

function msalAccountToAccount(info: AccountInfo): Account {
  const tenantId = info.tenantId ?? "unknown";
  const isPersonal =
    tenantId === "9188040d-6c67-4c5b-b112-36a304b66dad" || // MSA tenant
    info.environment?.includes("consumers") ||
    info.username?.endsWith("@outlook.com") ||
    info.username?.endsWith("@hotmail.com") ||
    info.username?.endsWith("@live.com");

  return {
    accountId: info.homeAccountId,
    username: info.username,
    name: info.name ?? info.username,
    type: isPersonal ? "personal" : "work",
    tenantId,
    addedAt: new Date().toISOString(),
  };
}

function buildPcaForTenant(tenant: string): PublicClientApplication {
  if (!config.clientId) throw new Error("MISSING_CLIENT_ID: GRAPH_CLIENT_ID is not set.");
  return new PublicClientApplication({
    auth: {
      clientId: config.clientId,
      authority: `https://login.microsoftonline.com/${tenant}`,
    },
    cache: {
      cachePlugin: createCachePlugin(config.tokenCachePath),
    },
    system: { loggerOptions: { loggerCallback: () => {}, piiLoggingEnabled: false } },
  });
}
