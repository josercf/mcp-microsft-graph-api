import type { Client } from "@microsoft/microsoft-graph-client";
import type {
  Message,
  Recipient,
  FileAttachment,
  MailFolder,
  OutlookCategory,
  MessageRule,
} from "@microsoft/microsoft-graph-types";

// ── Field selectors ──────────────────────────────────────────────────────────

const SUMMARY_FIELDS =
  "id,subject,from,receivedDateTime,isRead,hasAttachments,bodyPreview," +
  "categories,importance,flag,parentFolderId";

const FULL_FIELDS =
  "id,subject,from,toRecipients,ccRecipients,bccRecipients,replyTo," +
  "receivedDateTime,sentDateTime,isRead,hasAttachments,body," +
  "categories,importance,flag,parentFolderId,conversationId";

const FOLDER_FIELDS = "id,displayName,unreadItemCount,totalItemCount,childFolderCount";

// ── Types ────────────────────────────────────────────────────────────────────

export interface EmailAttachmentInput {
  name: string;
  contentType: string;
  contentBase64: string;
}

export interface SendEmailInput {
  to: string[];
  subject: string;
  body: string;
  bodyType?: "text" | "html";
  cc?: string[];
  bcc?: string[];
  attachments?: EmailAttachmentInput[];
  saveToSentItems?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function toRecipientList(addresses: string[]): Recipient[] {
  return addresses.map((address) => ({ emailAddress: { address } }));
}

function buildAttachments(inputs: EmailAttachmentInput[]) {
  return inputs.map((a) => ({
    "@odata.type": "#microsoft.graph.fileAttachment",
    name: a.name,
    contentType: a.contentType,
    contentBytes: a.contentBase64,
  }));
}

// ── Listing & search ─────────────────────────────────────────────────────────

export async function listEmails(
  client: Client,
  params: {
    folderId?: string;
    unreadOnly?: boolean;
    top?: number;
    nextLink?: string;
  }
): Promise<{ items: Partial<Message>[]; nextLink?: string }> {
  const folder = params.folderId ?? "inbox";
  const top = params.top ?? 25;

  let response: { value: Partial<Message>[]; "@odata.nextLink"?: string };

  if (params.nextLink) {
    response = await client.api(params.nextLink).get() as typeof response;
  } else {
    let api = client
      .api(`/me/mailFolders/${folder}/messages`)
      .select(SUMMARY_FIELDS)
      .top(top)
      .orderby("receivedDateTime desc");

    if (params.unreadOnly) {
      api = api.filter("isRead eq false");
    }

    response = await api.get() as typeof response;
  }

  return {
    items: response.value ?? [],
    nextLink: response["@odata.nextLink"],
  };
}

export async function searchEmails(
  client: Client,
  params: { query: string; top?: number; nextLink?: string }
): Promise<{ items: Partial<Message>[]; nextLink?: string }> {
  const top = params.top ?? 25;

  let response: { value: Partial<Message>[]; "@odata.nextLink"?: string };

  if (params.nextLink) {
    response = await client.api(params.nextLink).get() as typeof response;
  } else {
    // $search and $orderby cannot be combined — omit orderby.
    // Pass the query through as-is so KQL operators (from:, subject:,
    // hasAttachments:true, …) are honoured. Wrapping it in quotes would turn the
    // whole thing into a literal phrase search and break those operators.
    response = await client
      .api("/me/messages")
      .select(SUMMARY_FIELDS)
      .top(top)
      .search(params.query)
      .get() as typeof response;
  }

  return {
    items: response.value ?? [],
    nextLink: response["@odata.nextLink"],
  };
}

export async function getEmail(
  client: Client,
  params: { messageId: string; includeAttachments?: boolean }
): Promise<{ message: Partial<Message>; attachments?: Partial<FileAttachment>[] }> {
  const message = await client
    .api(`/me/messages/${params.messageId}`)
    .select(FULL_FIELDS)
    .get() as Partial<Message>;

  let attachments: Partial<FileAttachment>[] | undefined;
  if (params.includeAttachments && message.hasAttachments) {
    const attResponse = await client
      .api(`/me/messages/${params.messageId}/attachments`)
      .select("id,name,contentType,size")
      .get() as { value: Partial<FileAttachment>[] };
    attachments = attResponse.value;
  }

  return { message, attachments };
}

export async function downloadAttachment(
  client: Client,
  params: { messageId: string; attachmentId: string }
): Promise<Partial<FileAttachment>> {
  return client
    .api(`/me/messages/${params.messageId}/attachments/${params.attachmentId}`)
    .get() as Promise<Partial<FileAttachment>>;
}

// ── Compose & send ───────────────────────────────────────────────────────────

export async function sendEmail(client: Client, input: SendEmailInput): Promise<void> {
  const body: Record<string, unknown> = {
    message: {
      subject: input.subject,
      body: {
        contentType: input.bodyType === "html" ? "HTML" : "Text",
        content: input.body,
      },
      toRecipients: toRecipientList(input.to),
      ...(input.cc?.length && { ccRecipients: toRecipientList(input.cc) }),
      ...(input.bcc?.length && { bccRecipients: toRecipientList(input.bcc) }),
      ...(input.attachments?.length && { attachments: buildAttachments(input.attachments) }),
    },
    saveToSentItems: input.saveToSentItems ?? true,
  };

  await client.api("/me/sendMail").post(body);
}

export async function createDraft(
  client: Client,
  input: SendEmailInput
): Promise<Partial<Message>> {
  const body = {
    subject: input.subject,
    body: {
      contentType: input.bodyType === "html" ? "HTML" : "Text",
      content: input.body,
    },
    toRecipients: toRecipientList(input.to),
    ...(input.cc?.length && { ccRecipients: toRecipientList(input.cc) }),
    ...(input.bcc?.length && { bccRecipients: toRecipientList(input.bcc) }),
    ...(input.attachments?.length && { attachments: buildAttachments(input.attachments) }),
  };

  return client.api("/me/messages").post(body) as Promise<Partial<Message>>;
}

export async function replyEmail(
  client: Client,
  params: { messageId: string; body: string; replyAll?: boolean }
): Promise<void> {
  const endpoint = params.replyAll
    ? `/me/messages/${params.messageId}/replyAll`
    : `/me/messages/${params.messageId}/reply`;

  await client.api(endpoint).post({
    message: {
      body: { contentType: "Text", content: params.body },
    },
  });
}

export async function forwardEmail(
  client: Client,
  params: { messageId: string; to: string[]; comment?: string }
): Promise<void> {
  await client.api(`/me/messages/${params.messageId}/forward`).post({
    toRecipients: toRecipientList(params.to),
    ...(params.comment && { comment: params.comment }),
  });
}

// ── Organisation ─────────────────────────────────────────────────────────────

export async function moveEmail(
  client: Client,
  params: { messageId: string; destinationFolderId: string }
): Promise<Partial<Message>> {
  return client
    .api(`/me/messages/${params.messageId}/move`)
    .post({ destinationId: params.destinationFolderId }) as Promise<Partial<Message>>;
}

export async function deleteEmail(
  client: Client,
  params: { messageId: string; permanent?: boolean }
): Promise<void> {
  if (params.permanent) {
    // Permanent deletion is a dedicated Graph action — a plain DELETE only moves
    // the message to Deleted Items (recoverable), not "forever".
    await client.api(`/me/messages/${params.messageId}/permanentDelete`).post({});
  } else {
    await client
      .api(`/me/messages/${params.messageId}/move`)
      .post({ destinationId: "deleteditems" });
  }
}

export async function updateEmailProperties(
  client: Client,
  params: {
    messageId: string;
    isRead?: boolean;
    categories?: string[];
    importance?: "low" | "normal" | "high";
    flag?: "flagged" | "complete" | "notFlagged";
  }
): Promise<Partial<Message>> {
  const patch: Record<string, unknown> = {};

  if (params.isRead !== undefined) patch.isRead = params.isRead;
  if (params.categories !== undefined) patch.categories = params.categories;
  if (params.importance !== undefined) patch.importance = params.importance;
  if (params.flag !== undefined) patch.flag = { flagStatus: params.flag };

  return client
    .api(`/me/messages/${params.messageId}`)
    .patch(patch) as Promise<Partial<Message>>;
}

// ── Folders ──────────────────────────────────────────────────────────────────

export async function listMailFolders(
  client: Client,
  params: { parentFolderId?: string }
): Promise<Partial<MailFolder>[]> {
  const endpoint = params.parentFolderId
    ? `/me/mailFolders/${params.parentFolderId}/childFolders`
    : "/me/mailFolders";

  const response = await client
    .api(endpoint)
    .select(FOLDER_FIELDS)
    .top(100)
    .get() as { value: Partial<MailFolder>[] };

  return response.value ?? [];
}

export async function createMailFolder(
  client: Client,
  params: { displayName: string; parentFolderId?: string }
): Promise<Partial<MailFolder>> {
  const endpoint = params.parentFolderId
    ? `/me/mailFolders/${params.parentFolderId}/childFolders`
    : "/me/mailFolders";

  return client
    .api(endpoint)
    .post({ displayName: params.displayName }) as Promise<Partial<MailFolder>>;
}

// ── Categories (Outlook tags) ────────────────────────────────────────────────

export async function listCategories(
  client: Client
): Promise<Partial<OutlookCategory>[]> {
  const response = await client
    .api("/me/outlook/masterCategories")
    .get() as { value: Partial<OutlookCategory>[] };
  return response.value ?? [];
}

export async function createCategory(
  client: Client,
  params: { displayName: string; color?: string }
): Promise<Partial<OutlookCategory>> {
  return client.api("/me/outlook/masterCategories").post({
    displayName: params.displayName,
    ...(params.color && { color: params.color }),
  }) as Promise<Partial<OutlookCategory>>;
}

// ── Inbox rules (message rules) ───────────────────────────────────────────────

export interface CreateInboxRuleInput {
  displayName: string;
  sequence?: number;
  isEnabled?: boolean;
  // Conditions — a message matches when ALL provided conditions are met.
  fromAddresses?: string[];
  senderContains?: string[];
  subjectContains?: string[];
  bodyContains?: string[];
  // Actions — applied when the rule matches.
  moveToFolderId?: string;
  markAsRead?: boolean;
  delete?: boolean;
  assignCategories?: string[];
  stopProcessingRules?: boolean;
}

export async function listInboxRules(client: Client): Promise<Partial<MessageRule>[]> {
  const response = (await client
    .api("/me/mailFolders/inbox/messageRules")
    .get()) as { value: Partial<MessageRule>[] };
  return response.value ?? [];
}

export async function createInboxRule(
  client: Client,
  input: CreateInboxRuleInput
): Promise<Partial<MessageRule>> {
  const conditions: Record<string, unknown> = {};
  if (input.fromAddresses?.length) {
    conditions.fromAddresses = toRecipientList(input.fromAddresses);
  }
  if (input.senderContains?.length) conditions.senderContains = input.senderContains;
  if (input.subjectContains?.length) conditions.subjectContains = input.subjectContains;
  if (input.bodyContains?.length) conditions.bodyContains = input.bodyContains;

  const actions: Record<string, unknown> = {};
  if (input.moveToFolderId) actions.moveToFolder = input.moveToFolderId;
  if (input.markAsRead) actions.markAsRead = true;
  if (input.delete) actions.delete = true;
  if (input.assignCategories?.length) actions.assignCategories = input.assignCategories;
  if (input.stopProcessingRules) actions.stopProcessingRules = true;

  if (Object.keys(conditions).length === 0) {
    throw new Error(
      "RULE_NEEDS_CONDITION: Provide at least one condition " +
        "(fromAddresses, senderContains, subjectContains or bodyContains)."
    );
  }
  if (Object.keys(actions).length === 0) {
    throw new Error(
      "RULE_NEEDS_ACTION: Provide at least one action " +
        "(moveToFolderId, markAsRead, delete, assignCategories or stopProcessingRules)."
    );
  }

  const body: Record<string, unknown> = {
    displayName: input.displayName,
    isEnabled: input.isEnabled ?? true,
    conditions,
    actions,
    ...(input.sequence !== undefined && { sequence: input.sequence }),
  };

  return client
    .api("/me/mailFolders/inbox/messageRules")
    .post(body) as Promise<Partial<MessageRule>>;
}

export async function deleteInboxRule(
  client: Client,
  params: { ruleId: string }
): Promise<void> {
  await client.api(`/me/mailFolders/inbox/messageRules/${params.ruleId}`).delete();
}
