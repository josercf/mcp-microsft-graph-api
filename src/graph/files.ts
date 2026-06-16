import type { Client } from "@microsoft/microsoft-graph-client";
import type { DriveItem, Permission } from "@microsoft/microsoft-graph-types";

// ── Field selectors ──────────────────────────────────────────────────────────

const ITEM_SUMMARY_FIELDS =
  "id,name,size,file,folder,lastModifiedDateTime,webUrl,parentReference";

// ── Types ────────────────────────────────────────────────────────────────────

interface NormalisedItem {
  id: string | undefined;
  name: string | undefined;
  type: "file" | "folder";
  size: number | undefined;
  mimeType: string | undefined;
  childCount: number | undefined;
  lastModifiedDateTime: string | undefined;
  webUrl: string | undefined;
  parentPath: string | undefined;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function itemApiByRef(
  client: Client,
  params: { itemId?: string; path?: string }
): ReturnType<Client["api"]> {
  if (params.itemId) return client.api(`/me/drive/items/${params.itemId}`);
  if (params.path) {
    const p = params.path.startsWith("/") ? params.path : `/${params.path}`;
    return client.api(`/me/drive/root:${p}:`);
  }
  throw new Error("ITEM_REF_REQUIRED: Provide either itemId or path.");
}

function childrenApiByRef(
  client: Client,
  params: { folderId?: string; path?: string }
): ReturnType<Client["api"]> {
  if (params.folderId) return client.api(`/me/drive/items/${params.folderId}/children`);
  if (params.path) {
    const p = params.path.startsWith("/") ? params.path : `/${params.path}`;
    return client.api(`/me/drive/root:${p}:/children`);
  }
  return client.api("/me/drive/root/children");
}

function normalise(raw: Partial<DriveItem>): NormalisedItem {
  return {
    id: raw.id ?? undefined,
    name: raw.name ?? undefined,
    type: raw.folder ? "folder" : "file",
    size: raw.size ?? undefined,
    mimeType: (raw.file as { mimeType?: string } | undefined)?.mimeType,
    childCount: (raw.folder as { childCount?: number } | undefined)?.childCount,
    lastModifiedDateTime: raw.lastModifiedDateTime ?? undefined,
    webUrl: raw.webUrl ?? undefined,
    parentPath: (raw.parentReference as { path?: string } | undefined)?.path,
  };
}

// ── Navigation ────────────────────────────────────────────────────────────────

export async function listDriveItems(
  client: Client,
  params: { folderId?: string; path?: string; top?: number; nextLink?: string }
): Promise<{ items: NormalisedItem[]; nextLink?: string }> {
  let response: { value: Partial<DriveItem>[]; "@odata.nextLink"?: string };

  if (params.nextLink) {
    response = (await client.api(params.nextLink).get()) as typeof response;
  } else {
    response = (await childrenApiByRef(client, params)
      .select(ITEM_SUMMARY_FIELDS)
      .top(params.top ?? 50)
      .orderby("name")
      .get()) as typeof response;
  }

  return {
    items: (response.value ?? []).map(normalise),
    nextLink: response["@odata.nextLink"],
  };
}

export async function searchDrive(
  client: Client,
  params: { query: string; top?: number; nextLink?: string }
): Promise<{ items: NormalisedItem[]; nextLink?: string }> {
  let response: { value: Partial<DriveItem>[]; "@odata.nextLink"?: string };

  if (params.nextLink) {
    response = (await client.api(params.nextLink).get()) as typeof response;
  } else {
    const q = encodeURIComponent(params.query);
    response = (await client
      .api(`/me/drive/root/search(q='${q}')`)
      .select(ITEM_SUMMARY_FIELDS)
      .top(params.top ?? 25)
      .get()) as typeof response;
  }

  return {
    items: (response.value ?? []).map(normalise),
    nextLink: response["@odata.nextLink"],
  };
}

export async function getDriveItem(
  client: Client,
  params: { itemId?: string; path?: string }
): Promise<NormalisedItem> {
  const raw = (await itemApiByRef(client, params)
    .select(ITEM_SUMMARY_FIELDS)
    .get()) as Partial<DriveItem>;
  return normalise(raw);
}

export async function listRecentFiles(
  client: Client,
  params: { top?: number }
): Promise<NormalisedItem[]> {
  const response = (await client
    .api("/me/drive/recent")
    .select(ITEM_SUMMARY_FIELDS)
    .top(params.top ?? 20)
    .get()) as { value: Partial<DriveItem>[] };
  return (response.value ?? []).map(normalise);
}

export async function listSharedWithMe(
  client: Client,
  params: { top?: number }
): Promise<NormalisedItem[]> {
  const response = (await client
    .api("/me/drive/sharedWithMe")
    .select(ITEM_SUMMARY_FIELDS)
    .top(params.top ?? 20)
    .get()) as { value: Partial<DriveItem>[] };
  return (response.value ?? []).map(normalise);
}

// ── Content ───────────────────────────────────────────────────────────────────

const INLINE_MAX_BYTES = 4 * 1024 * 1024; // 4 MB

export async function downloadFile(
  client: Client,
  params: { itemId?: string; path?: string }
): Promise<{ name: string; mimeType?: string; size?: number; contentBase64: string }> {
  // Request the pre-authorised download URL alongside metadata.
  const raw = (await itemApiByRef(client, params)
    .select("id,name,size,file,folder,@microsoft.graph.downloadUrl")
    .get()) as Partial<DriveItem> & { "@microsoft.graph.downloadUrl"?: string };

  if (raw.folder) throw new Error("IS_A_FOLDER: Cannot download a folder as a file.");

  const size = raw.size ?? 0;
  if (size > INLINE_MAX_BYTES) {
    throw new Error(
      `FILE_TOO_LARGE: File is ${Math.round(size / 1024 / 1024)} MB. ` +
        "Only files ≤ 4 MB can be downloaded inline. Use the webUrl to download manually."
    );
  }

  // The @microsoft.graph.downloadUrl is a short-lived pre-authed URL — no auth header needed.
  const downloadUrl = raw["@microsoft.graph.downloadUrl"];
  if (!downloadUrl) throw new Error("DOWNLOAD_URL_MISSING: Could not obtain a download URL.");

  const res = await fetch(downloadUrl);
  if (!res.ok) throw new Error(`DOWNLOAD_FAILED: HTTP ${res.status} from download URL.`);

  const buffer = Buffer.from(await res.arrayBuffer());
  return {
    name: raw.name ?? "file",
    mimeType: (raw.file as { mimeType?: string } | undefined)?.mimeType,
    size,
    contentBase64: buffer.toString("base64"),
  };
}

export async function uploadFile(
  client: Client,
  params: {
    path: string;
    contentBase64: string;
    conflictBehavior?: "rename" | "replace" | "fail";
  }
): Promise<NormalisedItem> {
  const p = params.path.startsWith("/") ? params.path : `/${params.path}`;
  const conflict = params.conflictBehavior ?? "replace";
  const content = Buffer.from(params.contentBase64, "base64");

  if (content.byteLength <= INLINE_MAX_BYTES) {
    // Simple single-request PUT upload.
    const raw = (await client
      .api(`/me/drive/root:${p}:/content`)
      .query({ "@microsoft.graph.conflictBehavior": conflict })
      .put(content)) as Partial<DriveItem>;
    return normalise(raw);
  }

  // Large file: create an upload session and send in 5 MB chunks.
  const session = (await client
    .api(`/me/drive/root:${p}:/createUploadSession`)
    .post({
      item: {
        "@microsoft.graph.conflictBehavior": conflict,
        name: p.split("/").pop(),
      },
    })) as { uploadUrl: string };

  const chunkSize = 5 * 1024 * 1024;
  let offset = 0;
  let lastRaw: Partial<DriveItem> = {};

  while (offset < content.byteLength) {
    const chunk = content.subarray(offset, offset + chunkSize);
    const end = offset + chunk.byteLength - 1;

    const res = await fetch(session.uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Length": String(chunk.byteLength),
        "Content-Range": `bytes ${offset}-${end}/${content.byteLength}`,
        "Content-Type": "application/octet-stream",
      },
      body: chunk,
    });

    if (res.status === 200 || res.status === 201) {
      lastRaw = (await res.json()) as Partial<DriveItem>;
    } else if (res.status !== 202) {
      const msg = await res.text();
      throw new Error(`UPLOAD_CHUNK_FAILED: HTTP ${res.status} — ${msg}`);
    }

    offset += chunk.byteLength;
  }

  return normalise(lastRaw);
}

// ── Organisation ──────────────────────────────────────────────────────────────

export async function createFolder(
  client: Client,
  params: { name: string; parentId?: string; parentPath?: string }
): Promise<NormalisedItem> {
  let endpoint: string;
  if (params.parentId) {
    endpoint = `/me/drive/items/${params.parentId}/children`;
  } else if (params.parentPath) {
    const p = params.parentPath.startsWith("/") ? params.parentPath : `/${params.parentPath}`;
    endpoint = `/me/drive/root:${p}:/children`;
  } else {
    endpoint = "/me/drive/root/children";
  }

  const raw = (await client.api(endpoint).post({
    name: params.name,
    folder: {},
    "@microsoft.graph.conflictBehavior": "rename",
  })) as Partial<DriveItem>;

  return normalise(raw);
}

export async function moveItem(
  client: Client,
  params: {
    itemId?: string;
    path?: string;
    destinationParentId?: string;
    destinationParentPath?: string;
    newName?: string;
  }
): Promise<NormalisedItem> {
  const patch: Record<string, unknown> = {};

  if (params.destinationParentId) {
    patch.parentReference = { id: params.destinationParentId };
  } else if (params.destinationParentPath) {
    const p = params.destinationParentPath.startsWith("/")
      ? params.destinationParentPath
      : `/${params.destinationParentPath}`;
    patch.parentReference = { path: `/me/drive/root:${p}` };
  }

  if (params.newName) patch.name = params.newName;

  if (!patch.parentReference && !patch.name) {
    throw new Error(
      "MOVE_NEEDS_TARGET: Provide destinationParentId, destinationParentPath, or newName."
    );
  }

  const raw = (await itemApiByRef(client, params).patch(patch)) as Partial<DriveItem>;
  return normalise(raw);
}

export async function deleteItem(
  client: Client,
  params: { itemId?: string; path?: string }
): Promise<void> {
  await itemApiByRef(client, params).delete();
}

// ── Sharing ───────────────────────────────────────────────────────────────────

export async function createShareLink(
  client: Client,
  params: {
    itemId?: string;
    path?: string;
    type?: "view" | "edit";
    scope?: "anonymous" | "organization";
  }
): Promise<Partial<Permission>> {
  // Resolve to an itemId so we can call /createLink.
  let itemId = params.itemId;
  if (!itemId) {
    const meta = await getDriveItem(client, { path: params.path });
    if (!meta.id) throw new Error("ITEM_NOT_FOUND: Could not resolve item ID from path.");
    itemId = meta.id;
  }

  return client.api(`/me/drive/items/${itemId}/createLink`).post({
    type: params.type ?? "view",
    scope: params.scope ?? "anonymous",
  }) as Promise<Partial<Permission>>;
}
