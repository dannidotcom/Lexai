import {
  useMutation,
  useQuery,
  type UseMutationOptions,
  type UseMutationResult,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { apiDelete, apiGet, apiPost } from "./client";

// ─── Types ──────────────────────────────────────────────────────────────────

export type HealthStatus = {
  status: string;
  version: string;
  database: string;
  vectorStore: string;
};

export type OllamaStatus = {
  available: boolean;
  models: string[];
  embeddingModel?: string;
  llmModel?: string;
  error?: string;
};

export type SessionSummary = {
  id: string;
  title: string;
  domain?: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
};

export type SessionMessage = {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  citations: unknown[];
  createdAt: string;
};

export type DocumentSummary = {
  id: string;
  title: string;
  source: string;
  domain: string;
  subDomain?: string;
  documentType: string;
  status: string;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
  url?: string;
  version?: string;
};

export type DomainStat = {
  domain: string;
  documentCount: number;
  chunkCount: number;
  sources: string[];
};

type QueryOpts<T> = Omit<UseQueryOptions<T>, "queryFn">;

// ─── Query keys ─────────────────────────────────────────────────────────────

export const getHealthCheckQueryKey = () => ["/api/healthz"] as const;
export const getGetOllamaStatusQueryKey = () => ["/api/ollama/status"] as const;
export const getGetDashboardStatsQueryKey = () => ["/api/stats/dashboard"] as const;
export const getGetDomainStatsQueryKey = () => ["/api/stats/domains"] as const;
export const getListDocumentsQueryKey = (params?: Record<string, unknown>) =>
  ["/api/documents", params] as const;
export const getListSessionsQueryKey = () => ["/api/ai/sessions"] as const;
export const getGetSessionMessagesQueryKey = (sessionId: string) =>
  ["/api/ai/sessions", sessionId, "messages"] as const;

// ─── Health & stats ─────────────────────────────────────────────────────────

export function useHealthCheck(options?: { query?: QueryOpts<HealthStatus> }) {
  return useQuery<HealthStatus>({
    ...options?.query,
    queryKey: getHealthCheckQueryKey(),
    queryFn: () => apiGet<HealthStatus>("/api/healthz"),
  });
}

export function useGetOllamaStatus(options?: { query?: QueryOpts<OllamaStatus> }) {
  return useQuery<OllamaStatus>({
    ...options?.query,
    queryKey: getGetOllamaStatusQueryKey(),
    queryFn: () => apiGet<OllamaStatus>("/api/ollama/status"),
  });
}

export function useGetDashboardStats(options?: { query?: QueryOpts<Record<string, unknown>> }) {
  return useQuery<Record<string, unknown>>({
    ...options?.query,
    queryKey: getGetDashboardStatsQueryKey(),
    queryFn: () => apiGet<Record<string, unknown>>("/api/stats/dashboard"),
  });
}

export function useGetDomainStats(options?: { query?: QueryOpts<DomainStat[]> }) {
  return useQuery<DomainStat[]>({
    ...options?.query,
    queryKey: getGetDomainStatsQueryKey(),
    queryFn: () => apiGet<DomainStat[]>("/api/stats/domains"),
  });
}

// ─── Documents ──────────────────────────────────────────────────────────────

export function useListDocuments(
  params?: { domain?: string; status?: string; limit?: number; offset?: number },
  options?: { query?: QueryOpts<DocumentSummary[]> },
) {
  return useQuery<DocumentSummary[]>({
    ...options?.query,
    queryKey: getListDocumentsQueryKey(params),
    queryFn: () => apiGet<DocumentSummary[]>("/api/documents", params),
  });
}

export function useDeleteDocument(
  options?: {
    mutation?: Partial<UseMutationOptions<void, Error, { id: string }>>;
  },
): UseMutationResult<void, Error, { id: string }> {
  return useMutation({
    mutationFn: ({ id }) => apiDelete(`/api/documents/${id}`),
    ...options?.mutation,
  });
}

export function useIngestDocument(
  options?: {
    mutation?: Partial<
      UseMutationOptions<Record<string, unknown>, Error, { data: Record<string, unknown> }>
    >;
  },
) {
  return useMutation({
    mutationFn: ({ data }) => apiPost<Record<string, unknown>>("/api/documents", data),
    ...options?.mutation,
  });
}

export type LegifranceIngestResult = {
  kaliId: string;
  conventionTitle: string;
  jurisState: string;
  documentsCreated: number;
  totalArticles: number;
  documents: Array<{ id: string; title: string; chunkCount: number; status: string }>;
};

export function useIngestLegifranceJson(
  options?: {
    mutation?: Partial<
      UseMutationOptions<LegifranceIngestResult, Error, { data: { kaliJson: unknown; batchBy: string } }>
    >;
  },
) {
  return useMutation({
    mutationFn: ({ data }) => apiPost<LegifranceIngestResult>("/api/documents/ingest/legifrance", data),
    ...options?.mutation,
  });
}

// ─── RAG ────────────────────────────────────────────────────────────────────

export function useRagSearch(
  options?: {
    mutation?: Partial<
      UseMutationOptions<
        { items: unknown[]; totalFound: number },
        Error,
        { data: { query: string; domain?: string; limit?: number; searchType?: string } }
      >
    >;
  },
) {
  return useMutation({
    mutationFn: ({ data }) =>
      apiPost<{ items: unknown[]; totalFound: number }>("/api/rag/search", data),
    ...options?.mutation,
  });
}

// ─── AI sessions (async REST) ───────────────────────────────────────────────

export function useListSessions(options?: { query?: QueryOpts<SessionSummary[]> }) {
  return useQuery<SessionSummary[]>({
    ...options?.query,
    queryKey: getListSessionsQueryKey(),
    queryFn: () => apiGet<SessionSummary[]>("/api/ai/sessions"),
  });
}

export function useCreateSession(
  options?: {
    mutation?: Partial<
      UseMutationOptions<SessionSummary, Error, { data: { title: string; domain?: string } }>
    >;
  },
) {
  return useMutation({
    mutationFn: ({ data }) => apiPost<SessionSummary>("/api/ai/sessions", data),
    ...options?.mutation,
  });
}

export function useGetSessionMessages(
  sessionId: string,
  options?: { query?: QueryOpts<SessionMessage[]> },
) {
  return useQuery<SessionMessage[]>({
    ...options?.query,
    queryKey: getGetSessionMessagesQueryKey(sessionId),
    queryFn: () => apiGet<SessionMessage[]>(`/api/ai/sessions/${sessionId}/messages`),
    enabled: !!sessionId,
  });
}

// ─── AI async endpoints (non-stream) ────────────────────────────────────────

export function useAiQuery(
  options?: {
    mutation?: Partial<
      UseMutationOptions<unknown, Error, { data: Record<string, unknown> }>
    >;
  },
) {
  return useMutation({
    mutationFn: ({ data }) => apiPost("/api/ai/query", data),
    ...options?.mutation,
  });
}

export function useAiExplain(
  options?: {
    mutation?: Partial<
      UseMutationOptions<unknown, Error, { data: Record<string, unknown> }>
    >;
  },
) {
  return useMutation({
    mutationFn: ({ data }) => apiPost("/api/ai/explain", data),
    ...options?.mutation,
  });
}

export function useAiAnalyze(
  options?: {
    mutation?: Partial<
      UseMutationOptions<unknown, Error, { data: Record<string, unknown> }>
    >;
  },
) {
  return useMutation({
    mutationFn: ({ data }) => apiPost("/api/ai/analyze", data),
    ...options?.mutation,
  });
}
