import { useState, useRef, useEffect } from "react";
import {
  useListSessions, useCreateSession, useGetSessionMessages,
  useAiQuery, useAiExplain,
  getListSessionsQueryKey, getGetSessionMessagesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Send, ChevronDown, AlertTriangle, Bot, Loader2, Scale, BookOpen, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type TaskType = "query" | "explain" | "analyze";

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
  { value: "query",   label: "Question",    icon: Sparkles },
  { value: "explain", label: "Explication", icon: BookOpen },
  { value: "analyze", label: "Analyse",     icon: Scale    },
];

const DOMAINS = ["travail", "social", "commercial", "fiscal", "civil"];

// ── Citation ────────────────────────────────────────────
function CitationCard({ citation, index }: { citation: PendingMessage["citations"][number]; index: number }) {
  const score = Math.round(citation.relevanceScore * 100);
  return (
    <div className="flex gap-3 p-3 rounded-lg border border-border/50 bg-secondary/20 hover:bg-secondary/40 transition-colors">
      <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
        <span className="text-[9px] font-mono font-bold text-primary">{index + 1}</span>
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-start gap-2 justify-between">
          <span className="text-[12px] font-semibold text-foreground leading-snug truncate">{citation.documentTitle}</span>
          <span className={cn(
            "text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md flex-shrink-0",
            score >= 80 ? "bg-emerald-950/40 text-emerald-400" :
            score >= 50 ? "bg-amber-950/40 text-amber-400" :
                          "bg-secondary text-muted-foreground",
          )}>
            {score}%
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] bg-secondary border border-border/60 px-1.5 py-0.5 rounded font-mono">{citation.source}</span>
          {citation.articleId && (
            <span className="text-[10px] font-mono text-primary">Art. {citation.articleId}</span>
          )}
          <span className="text-[10px] text-muted-foreground/60 truncate">{citation.sectionPath}</span>
        </div>
        <p className="text-[11px] text-muted-foreground italic leading-relaxed line-clamp-2">
          "{citation.excerpt}"
        </p>
      </div>
    </div>
  );
}

// ── Message ─────────────────────────────────────────────
function MessageBubble({ msg }: { msg: PendingMessage }) {
  const [showCitations, setShowCitations] = useState(false);

  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[78%] bg-primary/12 border border-primary/20 rounded-2xl rounded-tr-sm px-4 py-3">
          <p className="text-[13px] text-foreground whitespace-pre-wrap leading-relaxed">{msg.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 max-w-[88%]">
      <div className="flex-shrink-0 w-7 h-7 bg-gradient-to-br from-primary/20 to-primary/10 rounded-lg flex items-center justify-center mt-0.5 border border-primary/20">
        <Bot className="w-3.5 h-3.5 text-primary" />
      </div>
      <div className="flex-1 space-y-2 min-w-0">
        {msg.isPending ? (
          <div className="inline-flex items-center gap-2 bg-card border border-card-border rounded-2xl rounded-tl-sm px-4 py-3">
            <div className="flex gap-1">
              <div className="dot-1 w-1.5 h-1.5 rounded-full bg-primary" />
              <div className="dot-2 w-1.5 h-1.5 rounded-full bg-primary" />
              <div className="dot-3 w-1.5 h-1.5 rounded-full bg-primary" />
            </div>
            <span className="text-[11px] text-muted-foreground">Analyse en cours…</span>
          </div>
        ) : (
          <div className="bg-card border border-card-border rounded-2xl rounded-tl-sm px-4 py-3">
            <p className="text-[13px] text-foreground whitespace-pre-wrap leading-[1.7]">{msg.content}</p>
          </div>
        )}

        {!msg.isPending && msg.citations.length > 0 && (
          <div>
            <button
              onClick={() => setShowCitations(!showCitations)}
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors py-1 px-1 rounded"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
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
          <div className="flex items-center gap-1.5 text-[11px] text-yellow-600/80 px-1">
            <AlertTriangle className="w-3 h-3" />
            <span>Aucune source officielle disponible pour cette réponse</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────
export default function Chat() {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [taskType, setTaskType] = useState<TaskType>("query");
  const [domain, setDomain] = useState("");
  const [pendingMessages, setPendingMessages] = useState<PendingMessage[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();

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

  const aiQuery   = useAiQuery();
  const aiExplain = useAiExplain();
  const isLoading = aiQuery.isPending || aiExplain.isPending;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pendingMessages]);

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
    const pending: PendingMessage  = { role: "assistant", content: "", citations: [], createdAt: new Date().toISOString(), isPending: true };
    setPendingMessages(prev => [...prev, userMsg, pending]);

    const payload = {
      data: {
        question: q,
        domain: domain && domain !== "all" ? domain : undefined,
        sessionId: activeSessionId || undefined,
        taskType: taskType as "query" | "explain" | "analyze",
      },
    };

    try {
      const response = taskType === "explain"
        ? await aiExplain.mutateAsync(payload)
        : await aiQuery.mutateAsync(payload);

      setPendingMessages(prev => {
        const updated = [...prev];
        const lastIdx = updated.findLastIndex(m => m.isPending);
        if (lastIdx !== -1) {
          updated[lastIdx] = {
            role: "assistant",
            content: response.answer,
            citations: response.citations,
            createdAt: response.generatedAt,
            isPending: false,
          };
        }
        return updated;
      });

      if (activeSessionId) {
        queryClient.invalidateQueries({ queryKey: getGetSessionMessagesQueryKey(activeSessionId) });
        queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
        setPendingMessages([]);
      }
    } catch {
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
    }
  };

  const displayMessages: PendingMessage[] =
    activeSessionId && messages && pendingMessages.length === 0
      ? messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content, citations: m.citations, createdAt: m.createdAt }))
      : pendingMessages;

  const activeTask = TASK_OPTIONS.find(t => t.value === taskType)!;

  return (
    <div className="flex-1 flex overflow-hidden">

      {/* ── Session sidebar ─────────────────── */}
      <div className="w-[200px] flex-shrink-0 border-r border-border flex flex-col" style={{ background: "hsl(var(--sidebar))" }}>
        <div className="p-3 border-b border-border">
          <Button
            onClick={handleNewSession}
            size="sm"
            className="w-full gap-2 text-[12px] h-8 rounded-lg"
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
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-11 w-full rounded-lg" />)}
            </div>
          ) : (sessions ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-3 text-center gap-2">
              <MessageSquareIcon className="w-6 h-6 text-muted-foreground/20" />
              <p className="text-[11px] text-muted-foreground leading-relaxed">Créez une session pour commencer</p>
            </div>
          ) : (
            (sessions ?? []).map(s => (
              <button
                key={s.id}
                data-testid={`button-session-${s.id}`}
                onClick={() => { setActiveSessionId(s.id); setPendingMessages([]); }}
                className={cn(
                  "w-full text-left px-2.5 py-2 rounded-lg transition-all duration-150 group",
                  activeSessionId === s.id
                    ? "bg-primary/10 border border-primary/20 shadow-[inset_0_0_0_1px_hsl(221_100%_58%/0.12)]"
                    : "hover:bg-white/[0.04]",
                )}
              >
                <p className={cn(
                  "text-[12px] font-medium truncate leading-tight",
                  activeSessionId === s.id ? "text-primary" : "text-foreground",
                )}>
                  {s.title}
                </p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5 font-mono">
                  {s.messageCount} msg{s.messageCount !== 1 ? "s" : ""}
                  {s.domain && <span className="text-primary/60 ml-1">· {s.domain}</span>}
                </p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Chat area ───────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex-shrink-0 px-4 h-[52px] border-b border-border flex items-center gap-2.5">
          {/* Task type */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            {TASK_OPTIONS.map(opt => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  onClick={() => setTaskType(opt.value)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium transition-colors",
                    taskType === opt.value
                      ? "bg-primary/15 text-primary border-r border-border last:border-0"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary border-r border-border last:border-0",
                  )}
                >
                  <Icon className="w-3 h-3" />
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Domain */}
          <Select value={domain} onValueChange={setDomain}>
            <SelectTrigger className="h-8 text-[11px] w-36 rounded-lg" data-testid="select-domain">
              <SelectValue placeholder="Tous les domaines" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les domaines</SelectItem>
              {DOMAINS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>

          {!activeSessionId && (
            <span className="ml-auto text-[11px] text-muted-foreground/60 italic">Sans session</span>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {displayMessages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center gap-5 pb-8">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20 shadow-[0_0_24px_hsl(221_100%_58%/0.12)]">
                  <Bot className="w-8 h-8 text-primary" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-background flex items-center justify-center">
                  <span className="text-[7px] font-bold text-white">AI</span>
                </div>
              </div>
              <div>
                <p className="text-[15px] font-semibold text-foreground font-serif">LexIA — Moteur IA Juridique</p>
                <p className="text-[12px] text-muted-foreground mt-2 max-w-sm leading-relaxed">
                  Posez une question juridique. Toutes les réponses sont issues exclusivement des sources officielles importées.
                </p>
              </div>
              <div className="flex flex-col gap-2 w-full max-w-md mt-2">
                {SUGGESTIONS.map(q => (
                  <button
                    key={q}
                    onClick={() => { setQuestion(q); textareaRef.current?.focus(); }}
                    className="text-left text-[12px] bg-secondary/40 border border-border/60 rounded-xl px-4 py-2.5 text-muted-foreground hover:text-foreground hover:border-border hover:bg-secondary/70 transition-all duration-150"
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
        <div className="flex-shrink-0 px-4 py-3 border-t border-border bg-background/80 backdrop-blur-sm">
          <div className="flex gap-2 items-end max-w-4xl">
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                data-testid="input-question"
                placeholder={`Mode ${activeTask.label.toLowerCase()} — posez votre question juridique… (⏎ pour envoyer)`}
                value={question}
                onChange={e => setQuestion(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
                }}
                className="resize-none min-h-[52px] max-h-[140px] text-[13px] font-mono pr-2 rounded-xl border-border/60 focus:border-primary/40 transition-colors"
                disabled={isLoading}
              />
            </div>
            <Button
              onClick={handleSend}
              disabled={!question.trim() || isLoading}
              data-testid="button-send"
              size="icon"
              className="h-[52px] w-[52px] rounded-xl flex-shrink-0 glow-blue"
            >
              {isLoading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Send className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground/40 mt-2 font-mono">
            Sources officielles uniquement — aucune hallucination — Maj+Entrée pour nouvelle ligne
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
