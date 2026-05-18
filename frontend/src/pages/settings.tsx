import { useGetOllamaStatus, useHealthCheck } from "@workspace/api-client-react";
import { CheckCircle2, AlertTriangle, Server, Database, Cpu, RefreshCw, ShieldCheck, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { getGetOllamaStatusQueryKey, getHealthCheckQueryKey } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

const AUTHORIZED_SOURCES = [
  { name: "Légifrance",           url: "https://www.legifrance.gouv.fr",                                                      category: "Juridique"    },
  { name: "Code du travail",      url: "https://www.legifrance.gouv.fr/codes/texte_lc/LEGITEXT000006072050",                   category: "Juridique"    },
  { name: "URSSAF",               url: "https://www.urssaf.fr",                                                                category: "Social"       },
  { name: "Service Public",       url: "https://www.service-public.fr",                                                        category: "Administratif"},
  { name: "Ministère du Travail", url: "https://travail-emploi.gouv.fr",                                                       category: "Juridique"    },
  { name: "DREETS",               url: "https://dreets.gouv.fr",                                                               category: "Juridique"    },
  { name: "EUR-Lex",              url: "https://eur-lex.europa.eu",                                                            category: "Européen"     },
  { name: "INPI",                 url: "https://www.inpi.fr",                                                                  category: "Commercial"   },
  { name: "INSEE",                url: "https://www.insee.fr",                                                                 category: "Statistiques" },
  { name: "BODACC",               url: "https://www.bodacc.fr",                                                                category: "Commercial"   },
  { name: "Ameli",                url: "https://www.ameli.fr",                                                                 category: "Social"       },
  { name: "INRS",                 url: "https://www.inrs.fr",                                                                  category: "Social"       },
  { name: "BPI France",           url: "https://www.bpifrance.fr",                                                             category: "Entreprise"   },
  { name: "Infogreffe",           url: "https://www.infogreffe.fr",                                                            category: "Commercial"   },
  { name: "Impôts.gouv",          url: "https://www.impots.gouv.fr",                                                           category: "Fiscal"       },
];

const CATEGORY_CONFIG: Record<string, { color: string; bg: string; border: string }> = {
  Juridique:     { color: "text-blue-400",   bg: "bg-blue-950/30",   border: "border-blue-900/40"   },
  Social:        { color: "text-emerald-400",bg: "bg-emerald-950/30",border: "border-emerald-900/40"},
  Administratif: { color: "text-violet-400", bg: "bg-violet-950/30", border: "border-violet-900/40" },
  Commercial:    { color: "text-orange-400", bg: "bg-orange-950/30", border: "border-orange-900/40" },
  Européen:      { color: "text-cyan-400",   bg: "bg-cyan-950/30",   border: "border-cyan-900/40"   },
  Statistiques:  { color: "text-yellow-400", bg: "bg-yellow-950/30", border: "border-yellow-900/40" },
  Entreprise:    { color: "text-pink-400",   bg: "bg-pink-950/30",   border: "border-pink-900/40"   },
  Fiscal:        { color: "text-red-400",    bg: "bg-red-950/30",    border: "border-red-900/40"    },
};

function SectionCard({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-card-border bg-card overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border/60">
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Icon className="w-3.5 h-3.5 text-primary" />
        </div>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{title}</h2>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function StatusRow({ label, value, ok, mono = true }: { label: string; value: string; ok: boolean; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/40 last:border-0">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        {ok
          ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          : <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />}
        <span className={cn(
          "text-[12px] font-semibold",
          mono && "font-mono",
          ok ? "text-emerald-400" : "text-yellow-400",
        )}>
          {value}
        </span>
      </div>
    </div>
  );
}

export default function Settings() {
  const { data: ollama, isLoading: ollamaLoading } = useGetOllamaStatus();
  const { data: health } = useHealthCheck();
  const queryClient = useQueryClient();

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: getGetOllamaStatusQueryKey() });
    queryClient.invalidateQueries({ queryKey: getHealthCheckQueryKey() });
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="page-header px-8 py-5 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold font-serif text-foreground leading-none">Configuration</h1>
          <p className="text-[12px] text-muted-foreground mt-1.5">Statut du système souverain LexIA</p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} className="gap-2 h-8 text-[12px] rounded-lg">
          <RefreshCw className="w-3.5 h-3.5" />
          Actualiser
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-5 max-w-3xl space-y-4">

        {/* System Status */}
        <SectionCard icon={Server} title="Statut système">
          <StatusRow label="API LexIA"                 value={health?.status ?? "…"}      ok={health?.status === "ok"} />
          <StatusRow label="Base de données PostgreSQL" value={health?.database ?? "…"}    ok={health?.database === "ok"} />
          <StatusRow label="Moteur vectoriel Qdrant"    value={health?.vectorStore ?? "…"} ok={!!(health?.vectorStore?.includes("ok"))} />
          <StatusRow label="Version"                   value={health?.version ?? "…"}     ok={true} />
        </SectionCard>

        {/* Ollama */}
        <SectionCard icon={Cpu} title="Moteur LLM — Ollama">
          {ollamaLoading ? (
            <p className="text-[12px] text-muted-foreground">Vérification…</p>
          ) : ollama?.available ? (
            <div>
              <StatusRow label="Statut Ollama"         value="connecté"               ok={true} />
              <StatusRow label="Modèle LLM actif"      value={ollama.llmModel ?? "—"}      ok={true} />
              <StatusRow label="Modèle d'embeddings"   value={ollama.embeddingModel ?? "—"} ok={true} />
              {ollama.models.length > 0 && (
                <div className="pt-3 mt-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-[0.1em] font-semibold mb-2">Modèles disponibles</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ollama.models.map(m => (
                      <span key={m} className="text-[11px] font-mono bg-secondary/70 border border-border/60 px-2 py-0.5 rounded-md">{m}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <StatusRow label="Statut Ollama" value="non disponible" ok={false} />
              {ollama?.error && (
                <div className="text-[11px] text-red-400 font-mono bg-red-950/15 border border-red-900/40 rounded-lg p-3">
                  {ollama.error}
                </div>
              )}
              <div className="bg-secondary/30 border border-border/50 rounded-xl p-4 space-y-3">
                <p className="text-[12px] font-semibold text-foreground">Instructions d'installation</p>
                <ol className="space-y-2">
                  {[
                    ["1", "Installer Ollama", "curl -fsSL https://ollama.ai/install.sh | sh"],
                    ["2", "Modèle d'embeddings", "ollama pull nomic-embed-text"],
                    ["3", "Modèle LLM", "ollama pull mistral"],
                  ].map(([n, label, cmd]) => (
                    <li key={n} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center mt-0.5">{n}</span>
                      <div className="space-y-0.5">
                        <div className="text-[11px] text-muted-foreground font-medium">{label}</div>
                        <code className="text-[11px] text-primary font-mono bg-primary/5 px-2 py-0.5 rounded">{cmd}</code>
                      </div>
                    </li>
                  ))}
                </ol>
                <p className="text-[11px] text-muted-foreground/60 pt-1">
                  Sans Ollama, la recherche BM25 reste disponible et les réponses s'appuient sur les contextes retrouvés.
                </p>
              </div>
            </div>
          )}
        </SectionCard>

        {/* Authorized Sources */}
        <SectionCard icon={Database} title={`Sources officielles autorisées (${AUTHORIZED_SOURCES.length})`}>
          <p className="text-[11px] text-muted-foreground/70 mb-4 leading-relaxed">
            Le moteur IA souverain n'utilise que ces sources. Aucune autre connaissance externe n'est autorisée.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {AUTHORIZED_SOURCES.map(s => {
              const cfg = CATEGORY_CONFIG[s.category] ?? { color: "text-muted-foreground", bg: "bg-secondary", border: "border-border" };
              return (
                <a
                  key={s.name}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between border border-border/50 rounded-lg px-3 py-2.5 hover:border-border hover:bg-secondary/30 transition-all duration-150"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500/70 flex-shrink-0" />
                    <span className="text-[12px] text-foreground truncate font-medium">{s.name}</span>
                    <ExternalLink className="w-2.5 h-2.5 text-muted-foreground/0 group-hover:text-muted-foreground/40 transition-opacity flex-shrink-0" />
                  </div>
                  <span className={cn(
                    "text-[9px] px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wide ml-2 flex-shrink-0",
                    cfg.color, cfg.bg, cfg.border,
                  )}>
                    {s.category}
                  </span>
                </a>
              );
            })}
          </div>
        </SectionCard>

        {/* Sovereignty notice */}
        <div className="rounded-xl border border-primary/15 bg-gradient-to-r from-primary/5 to-transparent p-4 flex items-start gap-3">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <ShieldCheck className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <p className="text-[12px] font-semibold text-primary mb-1">Périmètre souverain</p>
            <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
              Ce moteur IA fonctionne exclusivement sur serveur interne. Aucun appel à une API externe, aucun accès Internet depuis la zone IA.
              Toutes les réponses sont traçables et citées. Aucune décision autonome — validation humaine obligatoire.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
