import { useGetDashboardStats, useGetDomainStats, useGetOllamaStatus } from "@workspace/api-client-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { AlertTriangle, CheckCircle2, Database, FileText, Hash, MessageSquare, Search, Zap, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const STAT_CONFIG = [
  {
    label: "Documents",
    key: "totalDocuments" as const,
    subKey: "indexingStatus" as const,
    icon: FileText,
    iconBg: "bg-sky-100",
    iconColor: "text-sky-600",
    border: "border-sky-100",
    accent: "text-sky-600",
  },
  {
    label: "Chunks",
    key: "totalChunks" as const,
    icon: Hash,
    iconBg: "bg-violet-100",
    iconColor: "text-violet-600",
    border: "border-violet-100",
    accent: "text-violet-600",
  },
  {
    label: "Sessions",
    key: "totalSessions" as const,
    icon: MessageSquare,
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600",
    border: "border-emerald-100",
    accent: "text-emerald-600",
  },
  {
    label: "Requêtes",
    key: "totalQueries" as const,
    icon: Search,
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    border: "border-amber-100",
    accent: "text-amber-600",
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
  label, value, icon: Icon, sub, iconBg, iconColor, border,
}: {
  label: string; value: string | number; icon: React.ElementType;
  sub?: string; iconBg: string; iconColor: string; border: string;
}) {
  return (
    <div className={cn(
      "relative rounded-xl border bg-white px-5 py-4",
      "shadow-sm hover:shadow-md transition-shadow duration-200",
      border,
    )}>
      <div className="flex items-start gap-4">
        <div className={cn("p-2.5 rounded-xl flex-shrink-0", iconBg)}>
          <Icon className={cn("w-4 h-4", iconColor)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[28px] font-bold text-gray-900 leading-none tracking-tight">{value}</div>
          <div className="text-[11px] uppercase tracking-[0.08em] text-gray-500 font-semibold mt-1.5">{label}</div>
          {sub && <div className="text-[11px] text-gray-400 mt-1 truncate">{sub}</div>}
        </div>
      </div>
    </div>
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
    <div className="flex-1 overflow-y-auto bg-gray-50/50">
      {/* Header */}
      <div className="page-header px-8 py-5 flex items-center justify-between bg-white/85">
        <div>
          <h1 className="text-[20px] font-semibold text-gray-900 leading-none">Tableau de bord</h1>
          <p className="text-[13px] text-gray-500 mt-1.5">Vue d'ensemble du moteur IA juridique souverain</p>
        </div>
        {ollama && (
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-medium border",
            ollama.available
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-amber-200 bg-amber-50 text-amber-700",
          )}>
            {ollama.available
              ? <Zap className="w-3.5 h-3.5" />
              : <AlertTriangle className="w-3.5 h-3.5" />}
            <span>Ollama — {ollama.available ? ollama.llmModel : "non disponible"}</span>
          </div>
        )}
      </div>

      <div className="px-8 py-6 space-y-6">
        {/* Ollama banner */}
        {!ollama?.available && (
          <div className="flex items-start gap-3 border border-amber-200 bg-amber-50 rounded-xl p-4">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="text-[13px]">
              <p className="text-amber-800 font-semibold mb-0.5">Ollama non connecté</p>
              <p className="text-amber-700">
                Installez Ollama puis exécutez&nbsp;
                <code className="font-mono bg-amber-100 px-1 py-0.5 rounded text-amber-900">ollama pull nomic-embed-text</code>
                &nbsp;et&nbsp;
                <code className="font-mono bg-amber-100 px-1 py-0.5 rounded text-amber-900">ollama pull mistral</code>.
                &nbsp;BM25 reste actif.
              </p>
            </div>
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statsLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-gray-100 bg-white px-5 py-4 space-y-3 shadow-sm">
                  <Skeleton className="h-7 w-12 bg-gray-100" />
                  <Skeleton className="h-2.5 w-20 bg-gray-100" />
                </div>
              ))
            : STAT_CONFIG.map(cfg => (
                <StatCard
                  key={cfg.key}
                  label={cfg.label}
                  value={typedStats?.[cfg.key] ?? 0}
                  sub={"subKey" in cfg && cfg.subKey ? typedStats?.[cfg.subKey] : undefined}
                  icon={cfg.icon}
                  iconBg={cfg.iconBg}
                  iconColor={cfg.iconColor}
                  border={cfg.border}
                />
              ))}
        </div>

        {/* Chart + Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Chart */}
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <TrendingUp className="w-4 h-4 text-sky-500" />
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-500">Documents par domaine</h2>
            </div>
            {domainsLoading
              ? <Skeleton className="h-48 w-full rounded-lg bg-gray-100" />
              : chartData.length === 0
              ? (
                <div className="h-48 flex flex-col items-center justify-center gap-2">
                  <Database className="w-8 h-8 text-gray-200" />
                  <p className="text-[13px] text-gray-400">Aucun document indexé</p>
                </div>
              )
              : (
                <ResponsiveContainer width="100%" height={190}>
                  <BarChart data={chartData} barSize={22} barGap={6}>
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: "#9CA3AF" }}
                      axisLine={false} tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#D1D5DB" }}
                      axisLine={false} tickLine={false} width={20}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#FFFFFF",
                        border: "1px solid #E5E7EB",
                        borderRadius: "10px",
                        fontSize: 12,
                        padding: "8px 12px",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                      }}
                      itemStyle={{ color: "#374151" }}
                      labelStyle={{ color: "#6B7280", fontWeight: 600, marginBottom: 4 }}
                      cursor={{ fill: "hsl(210 40% 96%)", radius: 6 }}
                    />
                    <Bar dataKey="docs" name="Docs" radius={[5, 5, 0, 0]}>
                      {chartData.map((_, i) => (
                        <Cell key={i} fill={`hsl(199 89% ${44 + i * 8}%)`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
          </div>

          {/* Activity */}
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <Database className="w-4 h-4 text-sky-500" />
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-500">Activité récente</h2>
            </div>
            {statsLoading
              ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex gap-3 items-center">
                      <Skeleton className="w-7 h-7 rounded-lg bg-gray-100 flex-shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3 w-full bg-gray-100" />
                        <Skeleton className="h-2.5 w-2/3 bg-gray-100" />
                      </div>
                    </div>
                  ))}
                </div>
              )
              : (typedStats?.recentActivity ?? []).length === 0
              ? (
                <div className="h-48 flex flex-col items-center justify-center gap-2">
                  <FileText className="w-8 h-8 text-gray-200" />
                  <p className="text-[13px] text-gray-400">Aucune activité récente</p>
                </div>
              )
              : (
                <div className="space-y-0.5">
                  {(typedStats?.recentActivity ?? []).map((item, i) => (
                    <div key={i} className="flex items-center gap-3 py-2 px-2.5 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="w-7 h-7 bg-sky-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FileText className="w-3.5 h-3.5 text-sky-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] text-gray-800 truncate font-medium">{String(item.title ?? "")}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[11px] text-gray-400 font-mono">{String(item.source ?? "")}</span>
                          <span className="text-gray-200">·</span>
                          <span className="text-[11px] text-sky-600 capitalize font-medium">{String(item.domain ?? "")}</span>
                        </div>
                      </div>
                      <span className={cn(
                        "text-[10px] px-2 py-0.5 rounded-full border font-semibold flex-shrink-0",
                        item.status === "indexed"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-amber-50 text-amber-700 border-amber-200",
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
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <Database className="w-4 h-4 text-sky-500" />
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-500">Base documentaire</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {domains.map(d => (
                <div key={d.domain} className="border border-gray-100 rounded-xl p-3.5 hover:border-sky-200 hover:bg-sky-50/30 transition-all space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-gray-800 capitalize">{d.domain}</span>
                    <span className="text-[12px] font-semibold text-sky-600">
                      {d.documentCount} doc{d.documentCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-400">{d.chunkCount} chunks indexés</div>
                  <div className="flex flex-wrap gap-1.5">
                    {d.sources.slice(0, 3).map(s => (
                      <span key={s} className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
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
