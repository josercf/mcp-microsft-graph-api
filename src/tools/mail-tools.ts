import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getGraphClient } from "../graph/client.js";
import { toolResult, toolError } from "../utils/errors.js";
import {
  listEmails,
  searchEmails,
  getEmail,
  downloadAttachment,
  sendEmail,
  createDraft,
  replyEmail,
  forwardEmail,
  moveEmail,
  deleteEmail,
  updateEmailProperties,
  listMailFolders,
  createMailFolder,
  listCategories,
  createCategory,
} from "../graph/mail.js";

const accountIdField = z
  .string()
  .optional()
  .describe("Account to use. Defaults to the default account.");

const attachmentSchema = z.object({
  name: z.string().describe("File name (e.g. 'report.pdf')."),
  contentType: z.string().describe("MIME type (e.g. 'application/pdf')."),
  contentBase64: z.string().describe("File content encoded in base64."),
});

export function registerMailTools(server: McpServer): void {
  // ── list_emails ────────────────────────────────────────────────────────────
  server.tool(
    "list_emails",
    "Lists emails in a mailbox folder, ordered by newest first. " +
      "Well-known folder IDs: inbox, archive, drafts, sentitems, deleteditems, junkemail.",
    {
      folderId: z
        .string()
        .optional()
        .describe("Folder ID or well-known name (inbox, archive…). Default: inbox."),
      unreadOnly: z.boolean().optional().describe("Return only unread emails. Default: false."),
      top: z.number().int().min(1).max(100).optional().describe("Max results. Default: 25."),
      nextLink: z
        .string()
        .optional()
        .describe("Pagination cursor from a previous list_emails response."),
      accountId: accountIdField,
    },
    async ({ folderId, unreadOnly, top, nextLink, accountId }) => {
      try {
        const client = getGraphClient(accountId);
        const result = await listEmails(client, { folderId, unreadOnly, top, nextLink });
        return toolResult(result);
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── search_emails ──────────────────────────────────────────────────────────
  server.tool(
    "search_emails",
    "Full-text search across all emails using KQL syntax. " +
      "Examples: 'project proposal', 'from:boss@company.com', 'subject:invoice', 'hasAttachments:true'.",
    {
      query: z.string().describe("KQL search query string."),
      top: z.number().int().min(1).max(100).optional().describe("Max results. Default: 25."),
      nextLink: z.string().optional().describe("Pagination cursor from previous response."),
      accountId: accountIdField,
    },
    async ({ query, top, nextLink, accountId }) => {
      try {
        const client = getGraphClient(accountId);
        const result = await searchEmails(client, { query, top, nextLink });
        return toolResult(result);
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── get_email ──────────────────────────────────────────────────────────────
  server.tool(
    "get_email",
    "Gets the full content of an email including body, all recipients and attachment list. " +
      "Use download_attachment to retrieve attachment content.",
    {
      messageId: z.string().describe("The email message ID."),
      includeAttachments: z
        .boolean()
        .optional()
        .describe("Include attachment metadata (name, type, size). Default: true if email has attachments."),
      accountId: accountIdField,
    },
    async ({ messageId, includeAttachments, accountId }) => {
      try {
        const client = getGraphClient(accountId);
        const result = await getEmail(client, {
          messageId,
          includeAttachments: includeAttachments ?? true,
        });
        return toolResult(result);
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── download_attachment ────────────────────────────────────────────────────
  server.tool(
    "download_attachment",
    "Downloads the content of an email attachment. Returns name, MIME type and content as base64. " +
      "Attachments larger than ~4 MB may fail — consider noting the attachment name/type instead.",
    {
      messageId: z.string().describe("The email message ID."),
      attachmentId: z.string().describe("The attachment ID (from get_email)."),
      accountId: accountIdField,
    },
    async ({ messageId, attachmentId, accountId }) => {
      try {
        const client = getGraphClient(accountId);
        const result = await downloadAttachment(client, { messageId, attachmentId });
        return toolResult(result);
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── send_email ─────────────────────────────────────────────────────────────
  server.tool(
    "send_email",
    "Sends an email. Supports plain text and HTML body, CC, BCC and inline attachments (max ~4 MB each).",
    {
      to: z.array(z.string().email()).min(1).describe("Recipient email addresses."),
      subject: z.string().describe("Email subject."),
      body: z.string().describe("Email body content."),
      bodyType: z
        .enum(["text", "html"])
        .optional()
        .describe("Body content type. Default: text."),
      cc: z.array(z.string().email()).optional().describe("CC recipients."),
      bcc: z.array(z.string().email()).optional().describe("BCC recipients."),
      attachments: z.array(attachmentSchema).optional().describe("Files to attach."),
      saveToSentItems: z
        .boolean()
        .optional()
        .describe("Save a copy in Sent Items. Default: true."),
      accountId: accountIdField,
    },
    async ({ to, subject, body, bodyType, cc, bcc, attachments, saveToSentItems, accountId }) => {
      try {
        const client = getGraphClient(accountId);
        await sendEmail(client, { to, subject, body, bodyType, cc, bcc, attachments, saveToSentItems });
        return toolResult({ sent: true });
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── create_draft ───────────────────────────────────────────────────────────
  server.tool(
    "create_draft",
    "Creates an email draft (does not send). Returns the draft ID for later use.",
    {
      to: z.array(z.string().email()).min(1).describe("Recipient email addresses."),
      subject: z.string().describe("Email subject."),
      body: z.string().describe("Email body content."),
      bodyType: z.enum(["text", "html"]).optional().describe("Body type. Default: text."),
      cc: z.array(z.string().email()).optional(),
      bcc: z.array(z.string().email()).optional(),
      attachments: z.array(attachmentSchema).optional(),
      accountId: accountIdField,
    },
    async ({ to, subject, body, bodyType, cc, bcc, attachments, accountId }) => {
      try {
        const client = getGraphClient(accountId);
        const draft = await createDraft(client, { to, subject, body, bodyType, cc, bcc, attachments });
        return toolResult({ id: draft.id, subject: draft.subject, status: "draft" });
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── reply_email ────────────────────────────────────────────────────────────
  server.tool(
    "reply_email",
    "Replies to an email. Use replyAll to include all original recipients.",
    {
      messageId: z.string().describe("ID of the email to reply to."),
      body: z.string().describe("Reply body text."),
      replyAll: z
        .boolean()
        .optional()
        .describe("Reply to all recipients. Default: false."),
      accountId: accountIdField,
    },
    async ({ messageId, body, replyAll, accountId }) => {
      try {
        const client = getGraphClient(accountId);
        await replyEmail(client, { messageId, body, replyAll });
        return toolResult({ sent: true, replyAll: replyAll ?? false });
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── forward_email ──────────────────────────────────────────────────────────
  server.tool(
    "forward_email",
    "Forwards an email to one or more recipients.",
    {
      messageId: z.string().describe("ID of the email to forward."),
      to: z.array(z.string().email()).min(1).describe("Forward-to addresses."),
      comment: z.string().optional().describe("Optional message to prepend to the forward."),
      accountId: accountIdField,
    },
    async ({ messageId, to, comment, accountId }) => {
      try {
        const client = getGraphClient(accountId);
        await forwardEmail(client, { messageId, to, comment });
        return toolResult({ sent: true });
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── move_email ─────────────────────────────────────────────────────────────
  server.tool(
    "move_email",
    "Moves an email to a different folder. " +
      "Well-known destinations: inbox, archive, drafts, sentitems, deleteditems, junkemail.",
    {
      messageId: z.string().describe("Email ID to move."),
      destinationFolderId: z
        .string()
        .describe("Destination folder ID or well-known name (e.g. 'archive')."),
      accountId: accountIdField,
    },
    async ({ messageId, destinationFolderId, accountId }) => {
      try {
        const client = getGraphClient(accountId);
        const moved = await moveEmail(client, { messageId, destinationFolderId });
        return toolResult({ id: moved.id, parentFolderId: moved.parentFolderId });
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── archive_email ──────────────────────────────────────────────────────────
  server.tool(
    "archive_email",
    "Archives an email (moves it to the Archive folder).",
    {
      messageId: z.string().describe("Email ID to archive."),
      accountId: accountIdField,
    },
    async ({ messageId, accountId }) => {
      try {
        const client = getGraphClient(accountId);
        const moved = await moveEmail(client, { messageId, destinationFolderId: "archive" });
        return toolResult({ archived: true, id: moved.id });
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── delete_email ───────────────────────────────────────────────────────────
  server.tool(
    "delete_email",
    "Deletes an email. By default moves to Deleted Items. Set permanent=true to delete forever.",
    {
      messageId: z.string().describe("Email ID to delete."),
      permanent: z
        .boolean()
        .optional()
        .describe("Permanently delete without moving to Deleted Items. Default: false."),
      accountId: accountIdField,
    },
    async ({ messageId, permanent, accountId }) => {
      try {
        const client = getGraphClient(accountId);
        await deleteEmail(client, { messageId, permanent });
        return toolResult({ deleted: true, permanent: permanent ?? false });
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── set_email_categories ───────────────────────────────────────────────────
  server.tool(
    "set_email_categories",
    "Applies Outlook categories (colour tags) to an email. Replaces all existing categories. " +
      "Use list_categories to see available categories, or create_category to add new ones.",
    {
      messageId: z.string().describe("Email ID."),
      categories: z
        .array(z.string())
        .describe("Category display names to apply (e.g. ['Work', 'Urgent'])."),
      accountId: accountIdField,
    },
    async ({ messageId, categories, accountId }) => {
      try {
        const client = getGraphClient(accountId);
        const updated = await updateEmailProperties(client, { messageId, categories });
        return toolResult({ id: updated.id, categories: updated.categories });
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── mark_email ─────────────────────────────────────────────────────────────
  server.tool(
    "mark_email",
    "Marks an email as read/unread, flags it, or sets importance.",
    {
      messageId: z.string().describe("Email ID."),
      isRead: z.boolean().optional().describe("true = mark as read, false = mark as unread."),
      flag: z
        .enum(["flagged", "complete", "notFlagged"])
        .optional()
        .describe("Follow-up flag status."),
      importance: z
        .enum(["low", "normal", "high"])
        .optional()
        .describe("Email importance level."),
      accountId: accountIdField,
    },
    async ({ messageId, isRead, flag, importance, accountId }) => {
      try {
        const client = getGraphClient(accountId);
        const updated = await updateEmailProperties(client, {
          messageId,
          isRead,
          flag,
          importance,
        });
        return toolResult({
          id: updated.id,
          isRead: updated.isRead,
          flag: updated.flag,
          importance: updated.importance,
        });
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── list_mail_folders ──────────────────────────────────────────────────────
  server.tool(
    "list_mail_folders",
    "Lists mail folders. Omit parentFolderId to list root folders; provide it to list subfolders.",
    {
      parentFolderId: z
        .string()
        .optional()
        .describe("Parent folder ID to list subfolders of."),
      accountId: accountIdField,
    },
    async ({ parentFolderId, accountId }) => {
      try {
        const client = getGraphClient(accountId);
        const folders = await listMailFolders(client, { parentFolderId });
        return toolResult({ folders, total: folders.length });
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── create_mail_folder ─────────────────────────────────────────────────────
  server.tool(
    "create_mail_folder",
    "Creates a new mail folder. Provide parentFolderId to create a subfolder.",
    {
      displayName: z.string().describe("Folder name."),
      parentFolderId: z
        .string()
        .optional()
        .describe("Parent folder ID. Creates at root level if omitted."),
      accountId: accountIdField,
    },
    async ({ displayName, parentFolderId, accountId }) => {
      try {
        const client = getGraphClient(accountId);
        const folder = await createMailFolder(client, { displayName, parentFolderId });
        return toolResult({ id: folder.id, displayName: folder.displayName });
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── list_categories ────────────────────────────────────────────────────────
  server.tool(
    "list_categories",
    "Lists all Outlook colour categories available in the account (the master category palette).",
    { accountId: accountIdField },
    async ({ accountId }) => {
      try {
        const client = getGraphClient(accountId);
        const categories = await listCategories(client);
        return toolResult({ categories, total: categories.length });
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── create_category ────────────────────────────────────────────────────────
  server.tool(
    "create_category",
    "Creates a new Outlook colour category. " +
      "Color presets: preset0 (red) through preset24. Leave blank for no colour.",
    {
      displayName: z.string().describe("Category name."),
      color: z
        .string()
        .optional()
        .describe("Colour preset (preset0..preset24) or omit for no colour."),
      accountId: accountIdField,
    },
    async ({ displayName, color, accountId }) => {
      try {
        const client = getGraphClient(accountId);
        const category = await createCategory(client, { displayName, color });
        return toolResult(category);
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );
}
