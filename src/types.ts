export interface Account {
  accountId: string;       // homeAccountId from MSAL
  username: string;        // email/UPN
  name: string;            // display name
  type: "personal" | "work";
  tenantId: string;
  addedAt: string;         // ISO date
}

export interface AccountsFile {
  defaultAccountId: string | null;
  accounts: Record<string, Account>;
}

export interface GraphError {
  error: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

export interface PagedResult<T> {
  items: T[];
  nextLink?: string;
}

export interface PendingAuth {
  promise: Promise<import("@azure/msal-node").AuthenticationResult | null>;
  userCode: string;
  verificationUri: string;
  message: string;
  expiresAt: Date;
}
