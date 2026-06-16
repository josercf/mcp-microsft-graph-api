// Extracts a skipToken from a Graph @odata.nextLink URL.
export function extractSkipToken(nextLink: string): string {
  const url = new URL(nextLink);
  return url.searchParams.get("$skiptoken") ?? url.searchParams.get("skiptoken") ?? nextLink;
}

// Appends $skiptoken to a base URL for use as a query parameter.
export function applySkipToken(params: Record<string, string>, skipToken?: string): void {
  if (skipToken) {
    params["$skiptoken"] = skipToken;
  }
}
