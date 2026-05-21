import { useGetOllamaStatus, useHealthCheck } from "@workspace/api-client-react";
import { CheckCircle2, AlertTriangle, Server, Database, Cpu, RefreshCw, ShieldCheck, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { getGetOllamaStatusQueryKey, getHealthCheckQueryKey } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

const AUTHORIZED_SOURCES = [
  { name: "Légifrance",           url: "https://www.legifrance.gouv.fr",                                               category: "Juridique"     },
  { name: "Code du travail",      url: "https://www.legifrance.gouv.fr/codes/texte_lc/LEGITEXT000006072050",            category: "Juridique"     },
  { name: "URSSAF",               url: "https://www.urssaf.fr",                                                         category: "Social"        },
  { name: "Service Public",       url: "https://www.service-public.fr",                                                 category: "Administratif" },
  { name: "Ministère du Travail", url: "https://travail-emploi.gouv.fr",                                                category: "Juridique"     },
  { name: "DREETS",               url: "https://dreets.gouv.fr",                                                        category: "Juridique"     },
  { name: "EUR-Lex",              url: "https://eur-lex.europa.eu",                                                     category: "Européen"      },
  { name: "INPI",                 url: "https://www.inpi.fr",                                                           category: "Commercial"    },
  { name: "INSEE",                url: "https://www.insee.fr",                                                          category: "Statistiques"  },
  { name: "BODACC",               url: "https://www.bodacc.fr",                                                         category: "Commercial"    },
  { name: "Ameli",                url: "https://www.ameli.fr",                                                          category: "Social"        },
  { name: "INRS",                 url: "https://www.inrs.fr",                                                           category: "Social"        },
  { name: "BPI France",           url: "https://www.bpifrance.fr",                                                      category: "Entreprise"    },
  { name: "Infogreffe",           url: "https://www.infogreffe.fr",                                                     category: "Commercial"    },
  { name: "Impôts.gouv",          url: "https://www.impots.gouv.fr",                                                    category: "Fiscal"        },
];

const CATEGORY_CONFIG: Record<string, { text: string; bg: string; border: string }> = {
  Juridique:     { text: "text-sky-700",    bg: "bg-sky-50",    border: "border-sky-200"    },
  Social:        { text: "text-emerald-700",bg: "bg-emerald-50",border: "border-emerald-200"},
  Administratif: { text: "text-violet-700", bg: "bg-violet-50", border: "border-violet-200" },
  Commercial:    { text: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200" },
  Européen:      { text: "text-cyan-700",   bg: "bg-cyan-50",   border: "border-cyan-200"   },
  Statistiques:  { text: "text-amber-700",  bg: "bg-amber-50",  border: "border-amber-200"  },
  Entreprise:    { text: "text-pink-700",   bg: "bg-pink-50",   border: "border-pink-200"   },
  Fiscal:        { text: "text-red-700",    bg: "bg-red-50",    border: "border-red-200"    },
};

function SectionCard({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-100 bg-gray-50/50">
        <div className="w-7 h-7 rounded-lg bg-sky-50 flex items-center justify-center flex-shrink-0">
          <Icon className="w-3.5 h-3.5 text-sky-500" />
        </div>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500">{title}</h2>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function StatusRow({ label, value, ok, mono = true }: { label: string; value: string; ok: boolean; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-[13px] text-gray-600">{label}</span>
      <div className="flex items-center gap-2">
        {ok
          ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          : <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
        <span className={cn(
          "text-[12px] font-semibold",
          mono && "font-mono",
          ok ? "text-emerald-700" : "text-amber-700",
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
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50/50">
      {/* Header */}
      <div className="page-header px-8 py-5 flex items-center justify-between flex-shrink-0 bg-white/85">
        <div>
          <h1 className="text-[20px] font-semibold text-gray-900 leading-none">Configuration</h1>
          <p className="text-[13px] text-gray-500 mt-1.5">Statut du système souverain LexIA</p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh}
          className="gap-2 h-8 text-[12px] rounded-lg border-gray-200 hover:border-sky-200 hover:text-sky-600 hover:bg-sky-50">
          <RefreshCw className="w-3.5 h-3.5" />
          Actualiser
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-5 max-w-3xl space-y-4">

        <SectionCard icon={Server} title="Statut système">
          <StatusRow label="API LexIA"                  value={health?.status ?? "…"}      ok={health?.status === "ok"} />
          <StatusRow label="Base de données PostgreSQL"  value={health?.database ?? "…"}    ok={health?.database === "ok"} />
          <StatusRow label="Moteur vectoriel Qdrant"     value={health?.vectorStore ?? "…"} ok={!!(health?.vectorStore?.includes("ok"))} />
          <StatusRow label="Version"                    value={health?.version ?? "…"}     ok={true} />
        </SectionCard>

        <SectionCard icon={Cpu} title="Moteur LLM — Ollama">
          {ollamaLoading ? (
            <p className="text-[13px] text-gray-400">Vérification…</p>
          ) : ollama?.available ? (
            <div>
              <StatusRow label="Statut Ollama"        value="connecté"                    ok={true} />
              <StatusRow label="Modèle LLM actif"     value={ollama.llmModel ?? "—"}      ok={true} />
              <StatusRow label="Modèle d'embeddings"  value={ollama.embeddingModel ?? "—"} ok={true} />
              {ollama.models.length > 0 && (
                <div className="pt-3 mt-1">
                  <p className="text-[10px] text-gray-400 uppercase tracking-[0.08em] font-semibold mb-2">Modèles disponibles</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ollama.models.map(m => (
                      <span key={m} className="text-[11px] font-mono bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-md text-gray-600">{m}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <StatusRow label="Statut Ollama" value="non disponible" ok={false} />
              {ollama?.error && (
                <div className="text-[11px] text-red-600 font-mono bg-red-50 border border-red-100 rounded-lg p-3">
                  {ollama.error}
                </div>
              )}
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-3">
                <p className="text-[13px] font-semibold text-gray-700">Instructions d'installation</p>
                <ol className="space-y-2.5">
                  {[
                    ["1", "Installer Ollama",      "curl -fsSL https://ollama.ai/install.sh | sh"],
                    ["2", "Modèle d'embeddings",   "ollama pull nomic-embed-text"],
                    ["3", "Modèle LLM",            "ollama pull mistral"],
                  ].map(([n, label, cmd]) => (
                    <li key={n} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-sky-100 text-sky-700 text-[10px] font-bold flex items-center justify-center mt-0.5">{n}</span>
                      <div className="space-y-0.5">
                        <div className="text-[12px] text-gray-600 font-medium">{label}</div>
                        <code className="text-[11px] text-sky-700 font-mono bg-sky-50 px-2 py-0.5 rounded border border-sky-100">{cmd}</code>
                      </div>
                    </li>
                  ))}
                </ol>
                <p className="text-[11px] text-gray-400 pt-1">
                  Sans Ollama, la recherche BM25 reste disponible et les réponses s'appuient sur les contextes retrouvés.
                </p>
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard icon={Database} title={`Sources officielles autorisées (${AUTHORIZED_SOURCES.length})`}>
          <p className="text-[12px] text-gray-500 mb-4 leading-relaxed">
            Le moteur IA souverain n'utilise que ces sources. Aucune autre connaissance externe n'est autorisée.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {AUTHORIZED_SOURCES.map(s => {
              const cfg = CATEGORY_CONFIG[s.category] ?? { text: "text-gray-600", bg: "bg-gray-50", border: "border-gray-200" };
              return (
                <a
                  key={s.name}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between border border-gray-100 rounded-lg px-3 py-2.5 hover:border-sky-200 hover:bg-sky-50/40 transition-all duration-150"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                    <span className="text-[12px] text-gray-800 truncate font-medium">{s.name}</span>
                    <ExternalLink className="w-2.5 h-2.5 text-gray-300 group-hover:text-gray-400 transition-colors flex-shrink-0" />
                  </div>
                  <span className={cn(
                    "text-[9px] px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wide ml-2 flex-shrink-0",
                    cfg.text, cfg.bg, cfg.border,
                  )}>
                    {s.category}
                  </span>
                </a>
              );
            })}
          </div>
        </SectionCard>

        {/* Sovereignty */}
        <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-4 flex items-start gap-3">
          <div className="w-7 h-7 rounded-lg bg-sky-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-sky-800 mb-1">Périmètre souverain</p>
            <p className="text-[12px] text-sky-700/70 leading-relaxed">
              Ce moteur IA fonctionne exclusivement sur serveur interne. Aucun appel à une API externe, aucun accès Internet depuis la zone IA.
              Toutes les réponses sont traçables et citées. Aucune décision autonome — validation humaine obligatoire.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
