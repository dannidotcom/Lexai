import { useState, useRef, useEffect } from "react";
import {
  useListSessions, useCreateSession, useGetSessionMessages,
  getListSessionsQueryKey, getGetSessionMessagesQueryKey,
  consumeAiStream,
  type AiStreamCitation,
  type AiTaskType,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Send, ChevronDown, AlertTriangle, Bot, Loader2, Scale, BookOpen, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type TaskType = AiTaskType;

interface PendingMessage {
  role: "user" | "assistant";
  content: string;
  citations: Array<{
    documentId: string;
    documentTitle: string;
    source: string;
    articleId?: string | null;
    sectionPath: string;
    relevanceScore: number;
    excerpt: string;
  }>;
  createdAt: string;
  isPending?: boolean;
}

const SUGGESTIONS = [
  "Quelle est la durée légale du préavis de licenciement ?",
  "Quelles sont les conditions du CDI ?",
  "Expliquez les taux de cotisations URSSAF 2024",
];

const TASK_OPTIONS: Array<{ value: TaskType; label: string; icon: React.ElementType }> = [
  { value: "query", label: "Question", icon: Sparkles },
  { value: "explain", label: "Explication", icon: BookOpen },
  { value: "analyze", label: "Analyse", icon: Scale },
];

const DOMAINS = ["travail", "social", "commercial", "fiscal", "civil"];

function CitationCard({ citation, index }: { citation: PendingMessage["citations"][number]; index: number }) {
  const score = Math.round(citation.relevanceScore * 100);
  return (
    <div className="flex gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50 hover:border-sky-200 hover:bg-sky-50/40 transition-colors">
      <div className="flex-shrink-0 w-5 h-5 rounded-full bg-sky-100 flex items-center justify-center mt-0.5">
        <span className="text-[9px] font-bold text-sky-700">{index + 1}</span>
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-start gap-2 justify-between">
          <span className="text-[12px] font-semibold text-gray-800 leading-snug truncate">{citation.documentTitle}</span>
          <span className={cn(
            "text-[10px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0",
            score >= 80 ? "bg-emerald-100 text-emerald-700" :
              score >= 50 ? "bg-amber-100 text-amber-700" :
                "bg-gray-100 text-gray-600",
          )}>
            {score}%
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] bg-white border border-gray-200 px-1.5 py-0.5 rounded font-mono text-gray-500">{citation.source}</span>
          {citation.articleId && (
            <span className="text-[10px] font-mono text-sky-600 font-semibold">Art. {citation.articleId}</span>
          )}
          <span className="text-[10px] text-gray-400 truncate">{citation.sectionPath}</span>
        </div>
        <p className="text-[11px] text-gray-500 italic leading-relaxed line-clamp-2">
          "{citation.excerpt}"
        </p>
      </div>
    </div>
  );
}

function MessageBubble({ msg }: { msg: PendingMessage }) {
  const [showCitations, setShowCitations] = useState(false);

  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[78%] bg-sky-500 rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm">
          <p className="text-[13px] text-white whitespace-pre-wrap leading-relaxed">{msg.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 max-w-[88%]">
      <div className="flex-shrink-0 w-7 h-7 bg-gradient-to-br from-sky-500 to-sky-600 rounded-xl flex items-center justify-center mt-0.5 shadow-sm">
        <Bot className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="flex-1 space-y-2 min-w-0">
        {msg.isPending ? (
          <div className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
            <div className="flex gap-1">
              <div className="dot-1 w-1.5 h-1.5 rounded-full bg-sky-500" />
              <div className="dot-2 w-1.5 h-1.5 rounded-full bg-sky-500" />
              <div className="dot-3 w-1.5 h-1.5 rounded-full bg-sky-500" />
            </div>
            <span className="text-[11px] text-gray-400">Analyse en cours…</span>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
            <p className="text-[13px] text-gray-800 whitespace-pre-wrap leading-[1.7]">{msg.content}</p>
          </div>
        )}

        {!msg.isPending && msg.citations.length > 0 && (
          <div>
            <button
              onClick={() => setShowCitations(!showCitations)}
              className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-sky-600 transition-colors py-1 px-1 rounded"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-sky-500" />
              <span>
                {msg.citations.length} source{msg.citations.length !== 1 ? "s" : ""} citée{msg.citations.length !== 1 ? "s" : ""}
              </span>
              <ChevronDown className={cn("w-3 h-3 transition-transform duration-150", showCitations && "rotate-180")} />
            </button>
            {showCitations && (
              <div className="mt-2 space-y-1.5">
                {msg.citations.map((c, i) => <CitationCard key={i} citation={c} index={i} />)}
              </div>
            )}
          </div>
        )}

        {!msg.isPending && msg.citations.length === 0 && (
          <div className="flex items-center gap-1.5 text-[11px] text-amber-500 px-1">
            <AlertTriangle className="w-3 h-3" />
            <span>Aucune source officielle disponible</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Chat() {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [taskType, setTaskType] = useState<TaskType>("query");
  const [domain, setDomain] = useState("");
  const [pendingMessages, setPendingMessages] = useState<PendingMessage[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const queryClient = useQueryClient();
  const [isStreaming, setIsStreaming] = useState(false);

  const { data: sessions, isLoading: sessionsLoading } = useListSessions();
  const { data: messages } = useGetSessionMessages(
    activeSessionId ?? "",
    { query: { enabled: !!activeSessionId, queryKey: getGetSessionMessagesQueryKey(activeSessionId ?? "") } },
  );

  const createSession = useCreateSession({
    mutation: {
      onSuccess: (s) => {
        queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
        setActiveSessionId(s.id);
        setPendingMessages([]);
      },
    },
  });

  const isLoading = isStreaming;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pendingMessages]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const handleNewSession = () => {
    createSession.mutate({
      data: { title: `Session — ${new Date().toLocaleDateString("fr-FR")}`, domain: domain || undefined },
    });
  };

  const handleSend = async () => {
    if (!question.trim() || isLoading) return;
    const q = question.trim();
    setQuestion("");
    textareaRef.current?.focus();

    const userMsg: PendingMessage = { role: "user", content: q, citations: [], createdAt: new Date().toISOString() };
    const pending: PendingMessage = { role: "assistant", content: "", citations: [], createdAt: new Date().toISOString(), isPending: true };
    setPendingMessages(prev => [...prev, userMsg, pending]);
    setIsStreaming(true);

    const payload = {
      question: q,
      domain: domain && domain !== "all" ? domain : undefined,
      sessionId: activeSessionId || undefined,
      taskType,
      ...(taskType === "analyze" ? { situation: q } : {}),
    };

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    let citations: AiStreamCitation[] = [];
    let content = "";

    const updateAssistant = (pending = true) => {
      setPendingMessages(prev => {
        const updated = [...prev];
        const lastIdx = updated.findLastIndex(m => m.isPending);
        if (lastIdx !== -1) {
          updated[lastIdx] = {
            ...updated[lastIdx],
            content,
            citations,
            isPending: pending,
          };
        }
        return updated;
      });
    };

    try {
      content = await consumeAiStream(
        taskType,
        payload,
        {
          onMeta: (event) => {
            citations = event.citations ?? [];
            updateAssistant();
          },
          onChunk: (_text, accumulated) => {
            content = accumulated;
            updateAssistant();
          },
        },
        controller.signal,
      );

      updateAssistant(false);

      if (activeSessionId) {
        queryClient.invalidateQueries({ queryKey: getGetSessionMessagesQueryKey(activeSessionId) });
        queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
        setPendingMessages([]);
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      console.error(err);
      setPendingMessages(prev => {
        const updated = [...prev];
        const lastIdx = updated.findLastIndex(m => m.isPending);
        if (lastIdx !== -1) {
          updated[lastIdx] = {
            role: "assistant",
            content: "Une erreur est survenue. Vérifiez que le moteur IA est disponible.",
            citations: [],
            createdAt: new Date().toISOString(),
            isPending: false,
          };
        }
        return updated;
      });
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  };

  const displayMessages: PendingMessage[] =
    activeSessionId && messages && pendingMessages.length === 0
      ? messages.map(m => ({
          role: m.role as "user" | "assistant",
          content: m.content,
          citations: m.citations as PendingMessage["citations"],
          createdAt: m.createdAt,
        }))
      : pendingMessages;

  const activeTask = TASK_OPTIONS.find(t => t.value === taskType)!;

  return (
    <div className="flex-1 flex overflow-hidden bg-gray-50/50">

      {/* Session sidebar */}
      <div className="w-[200px] flex-shrink-0 border-r border-gray-200 flex flex-col bg-white">
        <div className="p-3 border-b border-gray-100">
          <Button
            onClick={handleNewSession}
            size="sm"
            className="w-full gap-2 text-[12px] h-8 rounded-lg bg-sky-500 hover:bg-sky-600 text-white border-0"
            data-testid="button-new-session"
            disabled={createSession.isPending}
          >
            <Plus className="w-3.5 h-3.5" />
            Nouvelle session
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto py-2 px-1.5">
          {sessionsLoading ? (
            <div className="space-y-1.5 p-1">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-11 w-full rounded-lg bg-gray-100" />)}
            </div>
          ) : (sessions ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-3 text-center gap-2">
              <MessageSquareIcon className="w-6 h-6 text-gray-200" />
              <p className="text-[11px] text-gray-400 leading-relaxed">Créez une session pour commencer</p>
            </div>
          ) : (
            (sessions ?? []).map(s => (
              <button
                key={s.id}
                data-testid={`button-session-${s.id}`}
                onClick={() => { setActiveSessionId(s.id); setPendingMessages([]); }}
                className={cn(
                  "w-full text-left px-2.5 py-2 rounded-lg transition-all duration-150",
                  activeSessionId === s.id
                    ? "bg-sky-50 border border-sky-200"
                    : "hover:bg-gray-50 border border-transparent",
                )}
              >
                <p className={cn(
                  "text-[12px] font-medium truncate leading-tight",
                  activeSessionId === s.id ? "text-sky-700" : "text-gray-700",
                )}>
                  {s.title}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {s.messageCount} msg{s.messageCount !== 1 ? "s" : ""}
                  {s.domain && <span className="text-sky-500 ml-1">· {s.domain}</span>}
                </p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex-shrink-0 px-4 h-[52px] border-b border-gray-200 bg-white flex items-center gap-2.5">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {TASK_OPTIONS.map(opt => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  onClick={() => setTaskType(opt.value)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium transition-colors border-r border-gray-200 last:border-0",
                    taskType === opt.value
                      ? "bg-sky-50 text-sky-700"
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-50",
                  )}
                >
                  <Icon className="w-3 h-3" />
                  {opt.label}
                </button>
              );
            })}
          </div>

          <Select value={domain} onValueChange={setDomain}>
            <SelectTrigger className="h-8 text-[11px] w-36 rounded-lg border-gray-200" data-testid="select-domain">
              <SelectValue placeholder="Tous les domaines" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les domaines</SelectItem>
              {DOMAINS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>

          {!activeSessionId && (
            <span className="ml-auto text-[11px] text-gray-400 italic">Sans session</span>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {displayMessages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center gap-5 pb-8">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500 to-sky-600 flex items-center justify-center shadow-lg shadow-sky-200">
                  <Bot className="w-8 h-8 text-white" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-400 rounded-full border-2 border-white flex items-center justify-center">
                  <span className="text-[7px] font-bold text-white">AI</span>
                </div>
              </div>
              <div>
                <p className="text-[16px] font-semibold text-gray-900">LexIA — Moteur IA Juridique</p>
                <p className="text-[13px] text-gray-500 mt-2 max-w-sm leading-relaxed">
                  Posez une question juridique. Toutes les réponses sont issues exclusivement des sources officielles importées.
                </p>
              </div>
              <div className="flex flex-col gap-2 w-full max-w-md mt-2">
                {SUGGESTIONS.map(q => (
                  <button
                    key={q}
                    onClick={() => { setQuestion(q); textareaRef.current?.focus(); }}
                    className="text-left text-[13px] bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-gray-600 hover:text-gray-900 hover:border-sky-200 hover:bg-sky-50/50 transition-all duration-150 shadow-sm"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {displayMessages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="flex-shrink-0 px-4 py-3 border-t border-gray-200 bg-white">
          <div className="flex gap-2 items-end max-w-4xl">
            <Textarea
              ref={textareaRef}
              data-testid="input-question"
              placeholder={`Mode ${activeTask.label.toLowerCase()} — posez votre question… (⏎ pour envoyer)`}
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
              }}
              className="flex-1 resize-none min-h-[52px] max-h-[140px] text-[13px] rounded-xl border-gray-200 focus:border-sky-400 transition-colors"
              disabled={isLoading}
            />
            <Button
              onClick={handleSend}
              disabled={!question.trim() || isLoading}
              data-testid="button-send"
              size="icon"
              className="h-[52px] w-[52px] rounded-xl flex-shrink-0 bg-sky-500 hover:bg-sky-600 border-0 shadow-sm shadow-sky-200"
            >
              {isLoading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Send className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-[10px] text-gray-400 mt-2">
            Sources officielles uniquement · Maj+Entrée pour nouvelle ligne
          </p>
        </div>
      </div>
    </div>
  );
}

function MessageSquareIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
    </svg>
  );
}
