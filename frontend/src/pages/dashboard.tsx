import { useGetDashboardStats, useGetDomainStats, useGetOllamaStatus } from "@workspace/api-client-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { AlertTriangle, CheckCircle2, Database, FileText, Hash, MessageSquare, Search, Zap, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

// Icon backgrounds per stat
const STAT_CONFIG = [
  {
    label: "Documents",
    key: "totalDocuments" as const,
    subKey: "indexingStatus" as const,
    icon: FileText,
    iconBg: "bg-blue-950/60",
    iconColor: "text-blue-400",
    glow: "shadow-[0_0_14px_hsl(217_100%_58%/0.15)]",
    border: "border-blue-900/30",
  },
  {
    label: "Chunks",
    key: "totalChunks" as const,
    icon: Hash,
    iconBg: "bg-violet-950/60",
    iconColor: "text-violet-400",
    glow: "shadow-[0_0_14px_hsl(270_60%_50%/0.12)]",
    border: "border-violet-900/30",
  },
  {
    label: "Sessions",
    key: "totalSessions" as const,
    icon: MessageSquare,
    iconBg: "bg-emerald-950/60",
    iconColor: "text-emerald-400",
    glow: "shadow-[0_0_14px_hsl(142_60%_45%/0.12)]",
    border: "border-emerald-900/30",
  },
  {
    label: "Requêtes",
    key: "totalQueries" as const,
    icon: Search,
    iconBg: "bg-amber-950/60",
    iconColor: "text-amber-400",
    glow: "shadow-[0_0_14px_hsl(40_90%_50%/0.12)]",
    border: "border-amber-900/30",
  },
] as const;

type DashStats = {
  totalDocuments: number;
  totalChunks: number;
  totalSessions: number;
  totalQueries: number;
  totalEmbeddings: number;
  indexingStatus: string;
  recentActivity: Array<Record<string, unknown>>;
};

function StatCard({
  label, value, icon: Icon, sub, iconBg, iconColor, glow, border,
}: {
  label: string; value: string | number; icon: React.ElementType;
  sub?: string; iconBg: string; iconColor: string; glow: string; border: string;
}) {
  return (
    <div className={cn(
      "relative overflow-hidden rounded-xl border bg-card px-5 py-4",
      "transition-all duration-200 hover:-translate-y-0.5",
      glow, border,
    )}>
      {/* subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.025] to-transparent pointer-events-none" />
      <div className="relative flex items-start gap-4">
        <div className={cn("p-2.5 rounded-lg flex-shrink-0", iconBg)}>
          <Icon className={cn("w-4 h-4", iconColor)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[26px] font-mono font-bold text-foreground leading-none tracking-tight">{value}</div>
          <div className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground font-semibold mt-1.5">{label}</div>
          {sub && <div className="text-[11px] text-muted-foreground/60 mt-1 truncate">{sub}</div>}
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-semibold mb-4">
      {children}
    </h2>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: domains, isLoading: domainsLoading } = useGetDomainStats();
  const { data: ollama } = useGetOllamaStatus();

  const typedStats = stats as DashStats | undefined;

  const chartData = domains?.map(d => ({
    name: d.domain.charAt(0).toUpperCase() + d.domain.slice(1),
    docs: d.documentCount,
    chunks: d.chunkCount,
  })) ?? [];

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Page header */}
      <div className="page-header px-8 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-serif text-foreground leading-none">Tableau de bord</h1>
          <p className="text-[12px] text-muted-foreground mt-1.5">Vue d'ensemble du moteur IA juridique souverain</p>
        </div>
        {ollama && (
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full border text-[11px] font-mono font-medium",
            ollama.available
              ? "border-emerald-800/60 bg-emerald-950/30 text-emerald-400"
              : "border-yellow-800/60 bg-yellow-950/25 text-yellow-400",
          )}>
            {ollama.available
              ? <Zap className="w-3 h-3" />
              : <AlertTriangle className="w-3 h-3" />}
            <span>Ollama — {ollama.available ? ollama.llmModel : "non disponible"}</span>
          </div>
        )}
      </div>

      <div className="px-8 py-6 space-y-6">
        {/* Ollama banner */}
        {!ollama?.available && (
          <div className="flex items-start gap-3 border border-yellow-800/40 bg-yellow-950/15 rounded-xl p-4">
            <div className="p-1.5 bg-yellow-950/50 rounded-lg flex-shrink-0 mt-0.5">
              <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />
            </div>
            <div className="text-[12px] leading-relaxed">
              <p className="text-yellow-300 font-semibold mb-1">Ollama non connecté</p>
              <p className="text-yellow-700">
                Installez Ollama puis exécutez&nbsp;
                <code className="text-yellow-400 font-mono bg-yellow-950/40 px-1 py-0.5 rounded">ollama pull nomic-embed-text</code>
                &nbsp;et&nbsp;
                <code className="text-yellow-400 font-mono bg-yellow-950/40 px-1 py-0.5 rounded">ollama pull mistral</code>.
                &nbsp;BM25 reste disponible.
              </p>
            </div>
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {statsLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-card-border bg-card px-5 py-4 space-y-3">
                  <Skeleton className="h-7 w-12" />
                  <Skeleton className="h-2.5 w-20" />
                </div>
              ))
            : STAT_CONFIG.map((cfg) => (
                <StatCard
                  key={cfg.key}
                  label={cfg.label}
                  value={typedStats?.[cfg.key] ?? 0}
                  sub={"subKey" in cfg && cfg.subKey ? typedStats?.[cfg.subKey] : undefined}
                  icon={cfg.icon}
                  iconBg={cfg.iconBg}
                  iconColor={cfg.iconColor}
                  glow={cfg.glow}
                  border={cfg.border}
                />
              ))}
        </div>

        {/* Charts + Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Chart */}
          <div className="rounded-xl border border-card-border bg-card p-5">
            <div className="flex items-center gap-2 mb-5">
              <TrendingUp className="w-3.5 h-3.5 text-primary" />
              <SectionHeader>Documents par domaine</SectionHeader>
            </div>
            {domainsLoading
              ? <Skeleton className="h-48 w-full rounded-lg" />
              : chartData.length === 0
              ? (
                <div className="h-48 flex flex-col items-center justify-center gap-2">
                  <Database className="w-8 h-8 text-muted-foreground/20" />
                  <p className="text-[12px] text-muted-foreground">Aucun document indexé</p>
                </div>
              )
              : (
                <ResponsiveContainer width="100%" height={190}>
                  <BarChart data={chartData} barSize={20} barGap={4}>
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: "hsl(222 12% 52%)", fontFamily: "var(--app-font-mono)" }}
                      axisLine={false} tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "hsl(222 12% 42%)" }}
                      axisLine={false} tickLine={false} width={24}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(222 20% 9%)",
                        border: "1px solid hsl(222 18% 18%)",
                        borderRadius: "10px",
                        fontSize: 12,
                        padding: "8px 12px",
                        boxShadow: "0 10px 24px hsl(222 30% 2% / 0.6)",
                      }}
                      itemStyle={{ color: "hsl(220 18% 88%)" }}
                      labelStyle={{ color: "hsl(222 12% 52%)", fontWeight: 600, marginBottom: 4 }}
                      cursor={{ fill: "hsl(222 18% 14% / 0.5)", radius: 6 }}
                    />
                    <Bar dataKey="docs" name="Docs" radius={[5, 5, 0, 0]}>
                      {chartData.map((_, i) => (
                        <Cell key={i} fill={`hsl(221 100% ${55 + i * 4}%)`} opacity={0.9} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
          </div>

          {/* Recent activity */}
          <div className="rounded-xl border border-card-border bg-card p-5">
            <div className="flex items-center gap-2 mb-5">
              <Database className="w-3.5 h-3.5 text-primary" />
              <SectionHeader>Activité récente</SectionHeader>
            </div>
            {statsLoading
              ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex gap-3 items-center">
                      <Skeleton className="w-7 h-7 rounded-lg flex-shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-2.5 w-2/3" />
                      </div>
                    </div>
                  ))}
                </div>
              )
              : (typedStats?.recentActivity ?? []).length === 0
              ? (
                <div className="h-48 flex flex-col items-center justify-center gap-2">
                  <FileText className="w-8 h-8 text-muted-foreground/20" />
                  <p className="text-[12px] text-muted-foreground">Aucune activité récente</p>
                </div>
              )
              : (
                <div className="space-y-1.5">
                  {(typedStats?.recentActivity ?? []).map((item, i) => (
                    <div key={i} className="flex items-center gap-3 py-2 px-2.5 rounded-lg hover:bg-secondary/40 transition-colors group">
                      <div className="w-7 h-7 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FileText className="w-3 h-3 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] text-foreground truncate font-medium">{String(item.title ?? "")}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-muted-foreground/70 font-mono">{String(item.source ?? "")}</span>
                          <span className="text-muted-foreground/30">·</span>
                          <span className="text-[10px] text-primary capitalize font-medium">{String(item.domain ?? "")}</span>
                        </div>
                      </div>
                      <span className={cn(
                        "text-[10px] px-2 py-0.5 rounded-full border font-mono font-semibold flex-shrink-0",
                        item.status === "indexed"
                          ? "bg-emerald-950/40 text-emerald-400 border-emerald-900/50"
                          : "bg-yellow-950/40 text-yellow-400 border-yellow-900/50",
                      )}>
                        {String(item.status ?? "")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
          </div>
        </div>

        {/* Domain breakdown */}
        {domains && domains.length > 0 && (
          <div className="rounded-xl border border-card-border bg-card p-5">
            <div className="flex items-center gap-2 mb-5">
              <Database className="w-3.5 h-3.5 text-primary" />
              <SectionHeader>Base documentaire</SectionHeader>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {domains.map(d => (
                <div key={d.domain} className="border border-border/60 rounded-lg p-3.5 hover:border-border transition-colors space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-foreground capitalize">{d.domain}</span>
                    <span className="text-[11px] font-mono text-primary font-semibold">
                      {d.documentCount} doc{d.documentCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">{d.chunkCount} chunks indexés</div>
                  <div className="flex flex-wrap gap-1.5">
                    {d.sources.slice(0, 3).map(s => (
                      <span key={s} className="text-[10px] bg-secondary/70 text-muted-foreground px-2 py-0.5 rounded-full border border-border/50">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
