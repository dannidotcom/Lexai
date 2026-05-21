const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export function apiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return API_BASE ? `${API_BASE}${normalized}` : normalized;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function parseJson<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export async function apiGet<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  const url = new URL(apiUrl(path), window.location.origin);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }
  const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  if (!res.ok) {
    const body = await res.text().catch(() => undefined);
    throw new ApiError(`GET ${path} failed`, res.status, body);
  }
  return parseJson<T>(res);
}

export async function apiPost<T>(path: string, data?: unknown): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: data !== undefined ? JSON.stringify(data) : undefined,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => undefined);
    throw new ApiError(`POST ${path} failed`, res.status, body);
  }
  return parseJson<T>(res);
}

export async function apiDelete(path: string): Promise<void> {
  const res = await fetch(apiUrl(path), { method: "DELETE" });
  if (!res.ok) {
    const body = await res.text().catch(() => undefined);
    throw new ApiError(`DELETE ${path} failed`, res.status, body);
  }
}
