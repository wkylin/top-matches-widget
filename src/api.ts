import type { TopMatchesResponse } from "./types";

const BASE_URL = "/gateway/api";

export async function fetchTopMatches(siteCode: string): Promise<TopMatchesResponse> {
  const url = `${BASE_URL}/sportradar/v1/uof/top-matches?filter=All&siteCode=${encodeURIComponent(siteCode)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Top matches API failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<TopMatchesResponse>;
}
