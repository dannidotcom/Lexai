import axios, { AxiosError, AxiosHeaders } from "axios";
import { useAuthStore } from "@/stores/auth-store";

export type Role = "USER" | "ADMIN";

export type User = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
};

export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
  user: User;
};

export const authApi = axios.create({
  baseURL: "/api",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

let refreshPromise: Promise<TokenResponse> | null = null;

authApi.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

authApi.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (typeof error.config & { _retry?: boolean }) | undefined;
    if (error.response?.status !== 401 || !original || original._retry || original.url?.includes("/auth/refresh")) {
      return Promise.reject(error);
    }
    original._retry = true;
    refreshPromise ??= authApi.post<TokenResponse>("/auth/refresh").then((r) => r.data).finally(() => {
      refreshPromise = null;
    });
    const data = await refreshPromise;
    useAuthStore.getState().setSession(data.user, data.access_token);
    original.headers = AxiosHeaders.from(original.headers);
    original.headers.set("Authorization", `Bearer ${data.access_token}`);
    return authApi(original);
  },
);

export function apiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return detail[0]?.msg ?? "Validation error";
  }
  return "Unexpected error";
}
