import { homedir } from "node:os";
import { join } from "node:path";

const DEFAULT_CACHE_DIR = join(homedir(), ".mcp-graph");

export const config = {
  clientId: process.env.GRAPH_CLIENT_ID ?? "",
  tenant: process.env.GRAPH_TENANT ?? "common",
  tokenCachePath:
    process.env.GRAPH_TOKEN_CACHE_PATH ?? join(DEFAULT_CACHE_DIR, "token-cache.json"),
  accountsPath:
    process.env.GRAPH_ACCOUNTS_PATH ?? join(DEFAULT_CACHE_DIR, "accounts.json"),
  defaultAccountId: process.env.GRAPH_DEFAULT_ACCOUNT,
  // Debug logging (to stderr / optional file). Enable with GRAPH_DEBUG=1.
  debug: /^(1|true|yes|on)$/i.test(process.env.GRAPH_DEBUG ?? ""),
  logFile: process.env.GRAPH_LOG_FILE,
  scopes: [
    "User.Read",
    "Mail.ReadWrite",
    "Mail.Send",
    "MailboxSettings.ReadWrite",
    "Calendars.ReadWrite",
    "Tasks.ReadWrite",
    "Contacts.ReadWrite",
    "Files.ReadWrite",
    "offline_access",
  ],
};
