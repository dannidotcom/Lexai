import { apiUrl } from "./client";

export type AiTaskType = "query" | "explain" | "analyze";

const DEFAULT_FEATURE_BY_TASK: Record<AiTaskType, string> = {
  query: "ai.query",
  explain: "ai.explain",
  analyze: "ai.analyze",
};

export interface AiStreamCitation {
  documentId: string;
  documentTitle: string;
  source: string;
  articleId?: string | null;
  sectionPath: string;
  relevanceScore: number;
  excerpt: string;
}

export type AiStreamEvent =
  | { type: "meta"; citations: AiStreamCitation[]; confidence: number }
  | { type: "chunk"; text: string }
  | { type: "done" };

export interface AiQueryPayload {
  question: string;
  featureId?: string;
  domain?: string;
  subDomain?: string;
  sessionId?: string;
  taskType?: AiTaskType;
  businessContext?: string;
}

/** Payload attendu par POST /api/ai/analyze/stream */
export interface AiAnalyzePayload {
  question: string;
  situation: string;
  featureId?: string;
  domain?: string;
  subDomain?: string;
  sessionId?: string;
  businessContext?: string;
}

export function buildAiStreamPayload(
  taskType: AiTaskType,
  input: {
    question: string;
    situation?: string;
    featureId?: string;
    domain?: string;
    sessionId?: string;
  },
): AiQueryPayload | AiAnalyzePayload {
  const base = {
    question: input.question,
    featureId: input.featureId || DEFAULT_FEATURE_BY_TASK[taskType],
    domain: input.domain,
    sessionId: input.sessionId,
  };

  if (taskType === "analyze") {
    if (!input.situation?.trim()) {
      throw new Error("Le champ situation est requis pour le mode analyse.");
    }
    return { ...base, situation: input.situation.trim() };
  }

  return { ...base, taskType };
}

export function getAiStreamEndpoint(taskType: AiTaskType): string {
  switch (taskType) {
    case "explain":
      return "/api/ai/explain/stream";
    case "analyze":
      return "/api/ai/analyze/stream";
    default:
      return "/api/ai/query/stream";
  }
}

export interface AiStreamCallbacks {
  onMeta?: (event: Extract<AiStreamEvent, { type: "meta" }>) => void;
  onChunk?: (text: string, accumulated: string) => void;
  onDone?: () => void;
  onError?: (error: Error) => void;
}

const yieldToMain = () =>
  new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

function parseSseEvents(buffer: string): { events: AiStreamEvent[]; remainder: string } {
  const events: AiStreamEvent[] = [];
  const parts = buffer.split("\n\n");
  const remainder = parts.pop() ?? "";

  for (const part of parts) {
    const line = part
      .split("\n")
      .find((l) => l.startsWith("data: "));
    if (!line) continue;

    const dataStr = line.slice(6).trim();
    if (!dataStr) continue;

    try {
      events.push(JSON.parse(dataStr) as AiStreamEvent);
    } catch {
      // ignore malformed chunks
    }
  }

  return { events, remainder };
}

/** POST SSE stream from AI stream endpoints (query, explain, analyze) */
export async function consumeAiStream(
  taskType: AiTaskType,
  input: {
    question: string;
    situation?: string;
    featureId?: string;
    domain?: string;
    sessionId?: string;
  },
  callbacks: AiStreamCallbacks,
  signal?: AbortSignal,
): Promise<string> {
  const endpoint = getAiStreamEndpoint(taskType);
  const payload = buildAiStreamPayload(taskType, input);
  const res = await fetch(apiUrl(endpoint), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(detail || `Stream request failed (${res.status})`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("ReadableStream not supported");

  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let accumulated = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const { events, remainder } = parseSseEvents(buffer);
      buffer = remainder;

      for (const event of events) {
        if (event.type === "meta") {
          callbacks.onMeta?.(event);
          await yieldToMain();
        } else if (event.type === "chunk") {
          accumulated += event.text ?? "";
          callbacks.onChunk?.(event.text ?? "", accumulated);
          await yieldToMain();
        } else if (event.type === "done") {
          callbacks.onDone?.();
        }
      }
    }

    if (buffer.trim()) {
      const { events } = parseSseEvents(`${buffer}\n\n`);
      for (const event of events) {
        if (event.type === "meta") {
          callbacks.onMeta?.(event);
          await yieldToMain();
        } else if (event.type === "chunk") {
          accumulated += event.text ?? "";
          callbacks.onChunk?.(event.text ?? "", accumulated);
          await yieldToMain();
        } else if (event.type === "done") {
          callbacks.onDone?.();
        }
      }
    }

    callbacks.onDone?.();
    return accumulated;
  } catch (err) {
    if (signal?.aborted) throw err;
    const error = err instanceof Error ? err : new Error(String(err));
    callbacks.onError?.(error);
    throw error;
  }
}
