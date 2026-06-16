import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getGraphClient } from "../graph/client.js";
import { toolResult, toolError } from "../utils/errors.js";
import {
  listDriveItems,
  searchDrive,
  getDriveItem,
  listRecentFiles,
  listSharedWithMe,
  downloadFile,
  uploadFile,
  createFolder,
  moveItem,
  deleteItem,
  createShareLink,
} from "../graph/files.js";

const accountIdField = z
  .string()
  .optional()
  .describe("Account to use. Defaults to the default account.");

// Either itemId or path must be supplied for operations on existing items.
const itemRefFields = {
  itemId: z
    .string()
    .optional()
    .describe("OneDrive item ID. Provide this or path."),
  path: z
    .string()
    .optional()
    .describe("Item path relative to root (e.g. '/Documents/report.pdf'). Provide this or itemId."),
};

// The schema can't express "at least one of itemId/path" in a flat shape, so
// enforce it explicitly up front for a clear, early error instead of letting it
// surface deeper in the Graph call.
function requireItemRef(ref: { itemId?: string; path?: string }): void {
  if (!ref.itemId && !ref.path) {
    throw new Error("ITEM_REF_REQUIRED: Provide either itemId or path.");
  }
}

export function registerFileTools(server: McpServer): void {
  // ── list_drive_items ───────────────────────────────────────────────────────
  server.tool(
    "list_drive_items",
    "Lists files and folders inside a OneDrive folder. " +
      "Omit both folderId and path to list the root. Results include type (file/folder), size and last modified date.",
    {
      folderId: z.string().optional().describe("Folder item ID."),
      path: z
        .string()
        .optional()
        .describe("Folder path (e.g. '/Documents'). Omit for root."),
      top: z.number().int().min(1).max(200).optional().describe("Max results. Default: 50."),
      nextLink: z.string().optional().describe("Pagination cursor from previous response."),
      accountId: accountIdField,
    },
    async ({ folderId, path, top, nextLink, accountId }) => {
      try {
        const client = getGraphClient(accountId);
        const result = await listDriveItems(client, { folderId, path, top, nextLink });
        return toolResult(result);
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── search_drive ───────────────────────────────────────────────────────────
  server.tool(
    "search_drive",
    "Searches OneDrive for files and folders by name or content.",
    {
      query: z.string().describe("Search query (file name, keyword, etc.)."),
      top: z.number().int().min(1).max(100).optional().describe("Max results. Default: 25."),
      nextLink: z.string().optional().describe("Pagination cursor from previous response."),
      accountId: accountIdField,
    },
    async ({ query, top, nextLink, accountId }) => {
      try {
        const client = getGraphClient(accountId);
        const result = await searchDrive(client, { query, top, nextLink });
        return toolResult(result);
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── get_drive_item ─────────────────────────────────────────────────────────
  server.tool(
    "get_drive_item",
    "Gets metadata of a OneDrive file or folder (name, size, type, last modified, web URL).",
    {
      ...itemRefFields,
      accountId: accountIdField,
    },
    async ({ itemId, path, accountId }) => {
      try {
        requireItemRef({ itemId, path });
        const client = getGraphClient(accountId);
        const item = await getDriveItem(client, { itemId, path });
        return toolResult(item);
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── list_recent_files ──────────────────────────────────────────────────────
  server.tool(
    "list_recent_files",
    "Lists the most recently accessed files in OneDrive.",
    {
      top: z.number().int().min(1).max(100).optional().describe("Max results. Default: 20."),
      accountId: accountIdField,
    },
    async ({ top, accountId }) => {
      try {
        const client = getGraphClient(accountId);
        const items = await listRecentFiles(client, { top });
        return toolResult({ items, total: items.length });
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── list_shared_with_me ────────────────────────────────────────────────────
  server.tool(
    "list_shared_with_me",
    "Lists files and folders that others have shared with the account.",
    {
      top: z.number().int().min(1).max(100).optional().describe("Max results. Default: 20."),
      accountId: accountIdField,
    },
    async ({ top, accountId }) => {
      try {
        const client = getGraphClient(accountId);
        const items = await listSharedWithMe(client, { top });
        return toolResult({ items, total: items.length });
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── download_file ──────────────────────────────────────────────────────────
  server.tool(
    "download_file",
    "Downloads the content of a OneDrive file and returns it as base64. " +
      "Limited to files ≤ 4 MB. For larger files, use the webUrl returned by get_drive_item.",
    {
      ...itemRefFields,
      accountId: accountIdField,
    },
    async ({ itemId, path, accountId }) => {
      try {
        requireItemRef({ itemId, path });
        const client = getGraphClient(accountId);
        const result = await downloadFile(client, { itemId, path });
        return toolResult(result);
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── upload_file ────────────────────────────────────────────────────────────
  server.tool(
    "upload_file",
    "Uploads a file to OneDrive. Provide the destination path and file content as base64. " +
      "Files ≤ 4 MB are uploaded in a single request; larger files use a chunked upload session. " +
      "conflictBehavior controls what happens if a file already exists at the path.",
    {
      path: z
        .string()
        .describe("Destination path including filename (e.g. '/Documents/report.pdf')."),
      contentBase64: z
        .string()
        .describe("File content encoded as base64."),
      conflictBehavior: z
        .enum(["rename", "replace", "fail"])
        .optional()
        .describe("What to do if the file already exists. Default: replace."),
      accountId: accountIdField,
    },
    async ({ path, contentBase64, conflictBehavior, accountId }) => {
      try {
        const client = getGraphClient(accountId);
        const item = await uploadFile(client, { path, contentBase64, conflictBehavior });
        return toolResult(item);
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── create_folder ──────────────────────────────────────────────────────────
  server.tool(
    "create_folder",
    "Creates a new folder in OneDrive. If a folder with that name already exists, the new one is auto-renamed.",
    {
      name: z.string().describe("Folder name."),
      parentId: z.string().optional().describe("Parent folder item ID."),
      parentPath: z
        .string()
        .optional()
        .describe("Parent folder path (e.g. '/Documents'). Creates in root if omitted."),
      accountId: accountIdField,
    },
    async ({ name, parentId, parentPath, accountId }) => {
      try {
        const client = getGraphClient(accountId);
        const folder = await createFolder(client, { name, parentId, parentPath });
        return toolResult(folder);
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── move_item ──────────────────────────────────────────────────────────────
  server.tool(
    "move_item",
    "Moves and/or renames a OneDrive file or folder. " +
      "Provide at least one of: destinationParentId, destinationParentPath, or newName.",
    {
      ...itemRefFields,
      destinationParentId: z
        .string()
        .optional()
        .describe("Item ID of the destination folder."),
      destinationParentPath: z
        .string()
        .optional()
        .describe("Path of the destination folder (e.g. '/Archive')."),
      newName: z
        .string()
        .optional()
        .describe("New name for the item (rename). Can be combined with moving."),
      accountId: accountIdField,
    },
    async ({
      itemId,
      path,
      destinationParentId,
      destinationParentPath,
      newName,
      accountId,
    }) => {
      try {
        requireItemRef({ itemId, path });
        if (!destinationParentId && !destinationParentPath && !newName) {
          throw new Error(
            "MOVE_NEEDS_TARGET: Provide at least one of destinationParentId, destinationParentPath, or newName."
          );
        }
        const client = getGraphClient(accountId);
        const item = await moveItem(client, {
          itemId,
          path,
          destinationParentId,
          destinationParentPath,
          newName,
        });
        return toolResult(item);
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── delete_item ────────────────────────────────────────────────────────────
  server.tool(
    "delete_item",
    "Moves a OneDrive file or folder to the Recycle Bin. The item can be restored from there.",
    {
      ...itemRefFields,
      accountId: accountIdField,
    },
    async ({ itemId, path, accountId }) => {
      try {
        requireItemRef({ itemId, path });
        const client = getGraphClient(accountId);
        await deleteItem(client, { itemId, path });
        return toolResult({ deleted: true });
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── create_share_link ──────────────────────────────────────────────────────
  server.tool(
    "create_share_link",
    "Generates a sharing link for a OneDrive file or folder. " +
      "type 'view' = read-only, 'edit' = read-write. " +
      "scope 'anonymous' = anyone with the link, 'organization' = only people in the same org (work accounts only).",
    {
      ...itemRefFields,
      type: z
        .enum(["view", "edit"])
        .optional()
        .describe("Link permission type. Default: view."),
      scope: z
        .enum(["anonymous", "organization"])
        .optional()
        .describe("Link scope. Default: anonymous. 'organization' requires a work account."),
      accountId: accountIdField,
    },
    async ({ itemId, path, type, scope, accountId }) => {
      try {
        requireItemRef({ itemId, path });
        const client = getGraphClient(accountId);
        const permission = await createShareLink(client, { itemId, path, type, scope });
        const link = (permission as { link?: { webUrl?: string; type?: string; scope?: string } }).link;
        return toolResult({
          link: link?.webUrl,
          type: link?.type,
          scope: link?.scope,
        });
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );
}
