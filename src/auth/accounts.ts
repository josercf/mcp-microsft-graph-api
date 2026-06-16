import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import type { Account, AccountsFile } from "../types.js";
import { config } from "../config.js";

function loadFile(): AccountsFile {
  if (!existsSync(config.accountsPath)) {
    return { defaultAccountId: null, accounts: {} };
  }
  try {
    return JSON.parse(readFileSync(config.accountsPath, "utf-8")) as AccountsFile;
  } catch {
    return { defaultAccountId: null, accounts: {} };
  }
}

function saveFile(file: AccountsFile): void {
  const dir = dirname(config.accountsPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(config.accountsPath, JSON.stringify(file, null, 2), { encoding: "utf-8", mode: 0o600 });
}

export function listAccounts(): Account[] {
  return Object.values(loadFile().accounts);
}

export function getAccount(accountId: string): Account | undefined {
  return loadFile().accounts[accountId];
}

export function getDefaultAccountId(): string | null {
  return config.defaultAccountId ?? loadFile().defaultAccountId;
}

export function resolveAccountId(accountId?: string): string {
  const id = accountId ?? getDefaultAccountId();
  if (!id) {
    throw new Error(
      "NO_ACCOUNT: No account specified and no default account is set. Use add_account to connect a Microsoft account."
    );
  }
  if (!getAccount(id)) {
    throw new Error(`ACCOUNT_NOT_FOUND: Account '${id}' is not connected. Use list_accounts to see available accounts.`);
  }
  return id;
}

export function upsertAccount(account: Account): void {
  const file = loadFile();
  file.accounts[account.accountId] = account;
  if (!file.defaultAccountId) {
    file.defaultAccountId = account.accountId;
  }
  saveFile(file);
}

export function setDefaultAccount(accountId: string): void {
  const file = loadFile();
  if (!file.accounts[accountId]) {
    throw new Error(`ACCOUNT_NOT_FOUND: Account '${accountId}' not found.`);
  }
  file.defaultAccountId = accountId;
  saveFile(file);
}

export function removeAccount(accountId: string): { newDefaultAccountId: string | null } {
  const file = loadFile();
  if (!file.accounts[accountId]) {
    throw new Error(`ACCOUNT_NOT_FOUND: Account '${accountId}' not found.`);
  }
  delete file.accounts[accountId];

  if (file.defaultAccountId === accountId) {
    const remaining = Object.keys(file.accounts);
    file.defaultAccountId = remaining.length > 0 ? remaining[0] : null;
  }
  saveFile(file);
  return { newDefaultAccountId: file.defaultAccountId };
}
