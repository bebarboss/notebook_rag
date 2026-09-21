import { clearSession, getToken } from "./auth";

export const API_BASE_URL =
  (import.meta.env["VITE_API_BASE_URL"] as string | undefined) ?? "http://localhost:8000";

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// เมื่อ backend อยู่หลัง ngrok free tier มันจะคืนหน้า "browser warning" HTML แทน response
// จริงให้กับ request ที่มาจาก browser จริง (ไม่ใช่ curl) จนกว่าจะเห็น header นี้ — ไม่มีผล
// อะไรถ้า backend ไม่ได้อยู่หลัง ngrok จึงใส่ไว้เสมอโดยไม่ต้องเช็คว่า URL เป็น ngrok หรือไม่
function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  return fetch(input, {
    ...init,
    headers: {
      "ngrok-skip-browser-warning": "true",
      ...(init.headers as Record<string, string> | undefined),
    },
  });
}

export type Citation = {
  number: number;
  kind: "doc" | "incident" | "case_category";
  source: string;
  service: string | null;
  score: number;
  page?: number | null;
  chunk_index?: number | null;
  content?: string | null;
  incident_no?: string | null;
  problem?: string | null;
  cause?: string | null;
  workaround?: string | null;
};

export type UploadResponse = {
  filename: string;
  saved_path: string;
  service: string | null;
  status: string;
};

export class ApiError extends Error {}

async function parseError(res: Response): Promise<never> {
  if (res.status === 401) {
    clearSession();
    if (typeof window !== "undefined" && window.location.pathname !== "/login") {
      window.location.assign("/login");
    }
  }
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

export type AuthResult = {
  access_token: string;
  token_type: string;
  username: string;
};

export async function registerUser(username: string, password: string): Promise<AuthResult> {
  const res = await apiFetch(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function loginUser(username: string, password: string): Promise<AuthResult> {
  const res = await apiFetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function loginWithGoogle(credential: string): Promise<AuthResult> {
  const res = await apiFetch(`${API_BASE_URL}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential }),
  });
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await apiFetch(`${API_BASE_URL}/health`);
    if (!res.ok) return false;
    const body = (await res.json()) as { status?: string };
    return body?.status === "ok";
  } catch {
    return false;
  }
}

export type AskResult = {
  question: string;
  answer: string;
  citations: Citation[];
  // true = AI ขอข้อมูลเพิ่มจาก user แทนที่จะตอบเลย (คำตอบขึ้นต้นด้วย [ต้องการข้อมูลเพิ่มเติม])
  needs_clarification: boolean;
};

export type HistoryMessage = { role: "user" | "assistant"; content: string };

export async function askQuestion(params: {
  question: string;
  top_k: number;
  service?: string | undefined;
  documents_only?: boolean;
  history?: HistoryMessage[];
}): Promise<AskResult> {
  const res = await apiFetch(`${API_BASE_URL}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({
      question: params.question,
      top_k: params.top_k,
      service: params.service || null,
      documents_only: params.documents_only ?? false,
      history: params.history ?? [],
    }),
  });
  if (!res.ok) await parseError(res);
  return res.json();
}

export type SourceInfo = {
  source: string;
  filename: string;
  ext: string;
  kind: "doc" | "incident";
  service: string | null;
  count: number;
  created_at: string;
};

export async function listSources(): Promise<{ sources: SourceInfo[] }> {
  const res = await apiFetch(`${API_BASE_URL}/sources`, { headers: authHeaders() });
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function fetchSourceFile(source: string): Promise<Blob> {
  const url = new URL(`${API_BASE_URL}/sources/file`);
  url.searchParams.set("source", source);
  const res = await apiFetch(url.toString(), { headers: authHeaders() });
  if (!res.ok) await parseError(res);
  return res.blob();
}

export async function uploadSource(file: File, service: string): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);
  form.append("service", service);
  const res = await apiFetch(`${API_BASE_URL}/upload`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function deleteSource(
  source: string,
  service?: string | null,
): Promise<{ source: string; service: string | null; status: string }> {
  const url = new URL(`${API_BASE_URL}/sources`);
  url.searchParams.set("source", source);
  if (service) url.searchParams.set("service", service);
  const res = await apiFetch(url.toString(), { method: "DELETE", headers: authHeaders() });
  if (!res.ok) await parseError(res);
  return res.json();
}

export type AppSettings = {
  typhoon_model: string | null;
  default_top_k: number | null;
  typhoon_api_key_set: boolean;
  typhoon_env_key_set: boolean;
  channels: string[];
  is_admin: boolean;
};

export async function getSettings(): Promise<AppSettings> {
  const res = await apiFetch(`${API_BASE_URL}/settings`, { headers: authHeaders() });
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function updateSettings(patch: {
  typhoon_model?: string;
  default_top_k?: number;
  typhoon_api_key?: string;
}): Promise<AppSettings> {
  const res = await apiFetch(`${API_BASE_URL}/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(patch),
  });
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function addChannel(name: string): Promise<void> {
  const res = await apiFetch(`${API_BASE_URL}/settings/channels`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) await parseError(res);
}

export async function removeChannel(name: string): Promise<void> {
  const res = await apiFetch(`${API_BASE_URL}/settings/channels/${encodeURIComponent(name)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) await parseError(res);
}

export type UserInfo = {
  username: string;
  is_admin: boolean;
  permissions: string[];
};

export async function listUsers(): Promise<{ users: UserInfo[] }> {
  const res = await apiFetch(`${API_BASE_URL}/admin/users`, { headers: authHeaders() });
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function grantUserPermission(username: string, service: string): Promise<void> {
  const res = await apiFetch(
    `${API_BASE_URL}/admin/users/${encodeURIComponent(username)}/permissions`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ service }),
    },
  );
  if (!res.ok) await parseError(res);
}

export async function revokeUserPermission(username: string, service: string): Promise<void> {
  const res = await apiFetch(
    `${API_BASE_URL}/admin/users/${encodeURIComponent(username)}/permissions/${encodeURIComponent(service)}`,
    { method: "DELETE", headers: authHeaders() },
  );
  if (!res.ok) await parseError(res);
}

export type CaseCategory = {
  id: number;
  name: string;
  service: string | null;
  detail: string;
  incident_count: number;
  created_at: string;
  updated_at: string;
};

export async function listCaseCategories(): Promise<{ categories: CaseCategory[] }> {
  const res = await apiFetch(`${API_BASE_URL}/case-categories`, { headers: authHeaders() });
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function createCaseCategory(patch: {
  name: string;
  service?: string;
  detail: string;
}): Promise<CaseCategory> {
  const res = await apiFetch(`${API_BASE_URL}/case-categories`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(patch),
  });
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function updateCaseCategory(
  id: number,
  patch: { name?: string; service?: string; detail?: string },
): Promise<CaseCategory> {
  const res = await apiFetch(`${API_BASE_URL}/case-categories/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(patch),
  });
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function deleteCaseCategory(id: number): Promise<void> {
  const res = await apiFetch(`${API_BASE_URL}/case-categories/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) await parseError(res);
}

export type IncidentBrief = {
  incident_no: string;
  service: string | null;
  problem: string | null;
  case_category_id: number | null;
  case_category_name: string | null;
};

export async function listLinkedIncidentsBrief(): Promise<{ incidents: IncidentBrief[] }> {
  // linked_only=true: หน้า "หมวดปัญหา" ต้องการแค่ incident ที่ผูกหมวดไว้แล้ว (จำนวนน้อย) ไม่ใช่
  // incident ทั้งหมดในระบบ (อาจมีเป็นพันแถว) กันหน้า settings โหลดช้า/payload ใหญ่โดยไม่จำเป็น
  const res = await apiFetch(`${API_BASE_URL}/incidents?linked_only=true`, {
    headers: authHeaders(),
  });
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function linkIncidentCategory(categoryId: number, incidentNo: string): Promise<void> {
  const res = await apiFetch(`${API_BASE_URL}/case-categories/${categoryId}/incidents`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ incident_no: incidentNo }),
  });
  if (!res.ok) await parseError(res);
}

export async function unlinkIncidentCategory(incidentNo: string): Promise<void> {
  const res = await apiFetch(
    `${API_BASE_URL}/incidents/${encodeURIComponent(incidentNo)}/case-category`,
    { method: "DELETE", headers: authHeaders() },
  );
  if (!res.ok) await parseError(res);
}

export type AiProvider = "typhoon" | "openai" | "anthropic" | "gemini";

export type AiSource = "personal" | "system_admin" | "system_env" | "provider_default" | "none";

export type MyAiSettings = {
  ai_provider: AiProvider | null;
  ai_model: string | null;
  ai_base_url: string | null;
  ai_api_key_set: boolean;
  effective_provider: AiProvider;
  effective_model: string;
  effective_api_key_available: boolean;
  effective_source: AiSource;
};

export async function getMyAiSettings(): Promise<MyAiSettings> {
  const res = await apiFetch(`${API_BASE_URL}/me/ai-settings`, { headers: authHeaders() });
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function updateMyAiSettings(patch: {
  ai_provider?: AiProvider;
  ai_model?: string;
  ai_api_key?: string;
  ai_base_url?: string;
}): Promise<MyAiSettings> {
  const res = await apiFetch(`${API_BASE_URL}/me/ai-settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(patch),
  });
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function clearMyAiSettings(): Promise<MyAiSettings> {
  const res = await apiFetch(`${API_BASE_URL}/me/ai-settings`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) await parseError(res);
  return res.json();
}

export const ACCEPTED_EXT = [".pdf", ".txt", ".epub", ".xps", ".fb2", ".cbz", ".pptx", ".csv"];
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

export function fileExt(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i).toLowerCase();
}
