import { Client } from "@microsoft/microsoft-graph-client";
import { acquireToken } from "../auth/msal.js";
import { resolveAccountId } from "../auth/accounts.js";

export function getGraphClient(accountId?: string): Client {
  const resolvedId = resolveAccountId(accountId);

  return Client.initWithMiddleware({
    authProvider: {
      getAccessToken: () => acquireToken(resolvedId),
    },
  });
}
