export const API_BASE_URL =
  (import.meta.env['VITE_API_BASE_URL'] as string | undefined) ?? "http://localhost:8000";

export type DocResult = {
  id: number;
  source: string;
  service: string | null;
  page: number | null;
  chunk_index: number;
  content: string;
  score: number;
};

export type IncidentResult = {
  id: number;
  source: string;
  incident_no: string | null;
  service: string | null;
  problem: string | null;
  cause: string | null;
  workaround: string | null;
  score: number;
};

export type SearchMode = "docs" | "incidents";

export type UploadResponse = {
  filename: string;
  saved_path: string;
  service: string | null;
  status: string;
};

export class ApiError extends Error {}

async function parseError(res: Response): Promise<never> {
  let detail = `เกิดข้อผิดพลาด (${res.status})`;
  try {
    const body = (await res.json()) as { detail?: unknown };
    if (typeof body?.detail === "string") detail = body.detail;
    else if (body?.detail) detail = JSON.stringify(body.detail);
  } catch {
    /* ignore */
  }
  throw new ApiError(detail);
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/health`);
    if (!res.ok) return false;
    const body = (await res.json()) as { status?: string };
    return body?.status === "ok";
  } catch {
    return false;
  }
}

export async function searchDocs(params: {
  q: string;
  top_k: number;
  service?: string;
}): Promise<{ query: string; results: DocResult[] }> {
  const url = new URL(`${API_BASE_URL}/search`);
  url.searchParams.set("q", params.q);
  url.searchParams.set("top_k", String(params.top_k));
  if (params.service) url.searchParams.set("service", params.service);
  const res = await fetch(url.toString());
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function searchIncidents(params: {
  q: string;
  top_k: number;
  service?: string;
}): Promise<{ query: string; results: IncidentResult[] }> {
  const url = new URL(`${API_BASE_URL}/search/incidents`);
  url.searchParams.set("q", params.q);
  url.searchParams.set("top_k", String(params.top_k));
  if (params.service) url.searchParams.set("service", params.service);
  const res = await fetch(url.toString());
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function uploadSource(file: File, service?: string): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);
  if (service) form.append("service", service);
  const res = await fetch(`${API_BASE_URL}/upload`, { method: "POST", body: form });
  if (!res.ok) await parseError(res);
  return res.json();
}

export const ACCEPTED_EXT = [".pdf", ".txt", ".epub", ".xps", ".fb2", ".cbz", ".csv"];
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

export function fileExt(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i).toLowerCase();
}
