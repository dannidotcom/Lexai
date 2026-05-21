import { useState } from "react";
import { useRagSearch } from "@workspace/api-client-react";
import { Search as SearchIcon, Loader2, FileText, Layers, Zap, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type SearchType = "hybrid" | "vector" | "bm25";

interface ResultItem {
  chunkId: string; documentId: string; documentTitle: string;
  source: string; content: string; sectionPath: string;
  articleId: string | null; score: number; domain: string;
}

const SEARCH_TYPES: Array<{ value: SearchType; label: string; icon: React.ElementType }> = [
  { value: "hybrid", label: "Hybride",    icon: Layers },
  { value: "vector", label: "Vectorielle",icon: Zap    },
  { value: "bm25",   label: "BM25",       icon: Hash   },
];

const SUGGESTIONS = [
  "durée légale du travail", "taux URSSAF", "période d'essai CDI", "licenciement économique",
];

const DOMAINS = ["travail", "social", "commercial", "fiscal", "civil"];

const DOMAIN_CONFIG: Record<string, { text: string; bg: string }> = {
  travail:    { text: "text-sky-700",    bg: "bg-sky-50"    },
  social:     { text: "text-emerald-700",bg: "bg-emerald-50"},
  commercial: { text: "text-orange-700", bg: "bg-orange-50" },
  fiscal:     { text: "text-red-700",    bg: "bg-red-50"    },
  civil:      { text: "text-violet-700", bg: "bg-violet-50" },
};

function ResultCard({ item, rank }: { item: ResultItem; rank: number }) {
  const [expanded, setExpanded] = useState(false);
  const score = Math.round(item.score * 100);
  const domainCfg = DOMAIN_CONFIG[item.domain] ?? { text: "text-gray-600", bg: "bg-gray-50" };

  return (
    <div
      data-testid={`card-result-${item.chunkId}`}
      className="border border-gray-200 rounded-xl bg-white hover:border-sky-200 hover:shadow-md hover:shadow-sky-50 transition-all duration-200"
    >
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center mt-0.5">
            <span className="text-[10px] font-bold text-gray-500">{rank}</span>
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-gray-900 leading-snug truncate">{item.documentTitle}</p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="text-[10px] bg-gray-100 border border-gray-200 px-2 py-0.5 rounded font-mono text-gray-500">{item.source}</span>
              <span className={cn("text-[10px] font-semibold capitalize px-2 py-0.5 rounded-full", domainCfg.text, domainCfg.bg)}>
                {item.domain}
              </span>
              {item.articleId && (
                <span className="text-[10px] font-mono text-sky-600 font-semibold">Art. {item.articleId}</span>
              )}
              {item.sectionPath && (
                <span className="text-[10px] text-gray-400 truncate">{item.sectionPath}</span>
              )}
            </div>
          </div>

          <div className="flex-shrink-0 flex flex-col items-center gap-0.5">
            <div className={cn(
              "text-[13px] font-bold px-2.5 py-1 rounded-lg",
              score >= 80 ? "bg-emerald-100 text-emerald-700" :
              score >= 50 ? "bg-amber-100  text-amber-700"    :
                            "bg-gray-100   text-gray-600",
            )}>
              {score}%
            </div>
            <div className="text-[9px] text-gray-400 uppercase tracking-widest">score</div>
          </div>
        </div>

        <div className={cn(
          "pl-9 text-[11px] text-gray-500 font-mono leading-relaxed",
          !expanded && "line-clamp-3",
        )}>
          {item.content}
        </div>

        {item.content.length > 280 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="pl-9 text-[11px] text-sky-500 hover:text-sky-600 transition-colors font-medium"
          >
            {expanded ? "↑ Réduire" : "↓ Voir tout"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function Search() {
  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState("");
  const [searchType, setSearchType] = useState<SearchType>("hybrid");
  const [results, setResults] = useState<ResultItem[] | null>(null);
  const [searchedQuery, setSearchedQuery] = useState("");

  const search = useRagSearch();

  const handleSearch = () => {
    if (!query.trim()) return;
    setSearchedQuery(query.trim());
    search.mutate(
      {
        data: {
          query: query.trim(),
          domain: domain && domain !== "all" ? domain : undefined,
          limit: 10,
          searchType: searchType as "hybrid" | "vector" | "bm25",
        },
      },
      {
        onSuccess: data => setResults(data.items as ResultItem[]),
        onError: ()   => setResults([]),
      },
    );
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50/50">
      {/* Header */}
      <div className="page-header px-8 py-5 flex-shrink-0 bg-white/85">
        <h1 className="text-[20px] font-semibold text-gray-900 leading-none">Recherche RAG</h1>
        <p className="text-[13px] text-gray-500 mt-1.5">
          Recherche sémantique hybride sur les sources officielles indexées
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-5 space-y-5">
        {/* Search box */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden focus-within:border-sky-300 focus-within:shadow-md focus-within:shadow-sky-50 transition-all duration-200">
          {/* Input */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100">
            <SearchIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <input
              data-testid="input-query"
              placeholder="Durée du préavis, taux de cotisation, conditions de licenciement…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              className="flex-1 bg-transparent text-[13px] text-gray-900 placeholder:text-gray-400 outline-none"
            />
            {query && (
              <button onClick={() => setQuery("")} className="text-gray-300 hover:text-gray-500 text-[11px] flex-shrink-0 transition-colors">✕</button>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between px-4 py-2.5 gap-3 flex-wrap">
            <div className="flex items-center gap-1">
              {SEARCH_TYPES.map(opt => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setSearchType(opt.value)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-150",
                      searchType === opt.value
                        ? "bg-sky-50 text-sky-700 shadow-[inset_0_0_0_1px_hsl(199_89%_80%)]"
                        : "text-gray-500 hover:text-gray-700 hover:bg-gray-100",
                    )}
                  >
                    <Icon className="w-3 h-3" />
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <Select value={domain} onValueChange={setDomain}>
                <SelectTrigger className="h-8 text-[11px] w-36 rounded-lg border-gray-200" data-testid="select-domain">
                  <SelectValue placeholder="Tous les domaines" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les domaines</SelectItem>
                  {DOMAINS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>

              <Button
                onClick={handleSearch}
                disabled={!query.trim() || search.isPending}
                data-testid="button-search"
                className="h-8 text-[12px] gap-1.5 rounded-lg px-4 bg-sky-500 hover:bg-sky-600 border-0 shadow-sm shadow-sky-100"
              >
                {search.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <SearchIcon className="w-3.5 h-3.5" />}
                Rechercher
              </Button>
            </div>
          </div>

          {/* Suggestions */}
          <div className="px-4 pb-3 flex gap-1.5 flex-wrap">
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                onClick={() => setQuery(s)}
                className="text-[10px] bg-gray-100 rounded-full px-2.5 py-1 text-gray-500 hover:text-sky-600 hover:bg-sky-50 transition-colors border border-gray-100 hover:border-sky-200"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Loading */}
        {search.isPending && (
          <div className="flex items-center gap-3 text-gray-500 py-12 justify-center">
            <div className="w-8 h-8 rounded-xl bg-sky-50 flex items-center justify-center">
              <Loader2 className="w-4 h-4 animate-spin text-sky-500" />
            </div>
            <span className="text-[13px]">Recherche dans les sources officielles…</span>
          </div>
        )}

        {/* Results */}
        {results !== null && !search.isPending && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-[13px] text-gray-500">
                <span className="text-gray-900 font-semibold">{results.length}</span>
                {" "}résultat{results.length !== 1 ? "s" : ""} pour&nbsp;
                <span className="text-sky-600">"{searchedQuery}"</span>
              </span>
              <span className={cn(
                "text-[10px] px-2 py-0.5 rounded-full border font-semibold",
                searchType === "hybrid" ? "bg-sky-50 text-sky-700 border-sky-200" :
                searchType === "vector" ? "bg-violet-50 text-violet-700 border-violet-200" :
                                          "bg-gray-100 text-gray-600 border-gray-200",
              )}>
                {SEARCH_TYPES.find(t => t.value === searchType)?.label}
              </span>
            </div>

            {results.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-6 h-6 text-gray-300" />
                </div>
                <p className="text-[13px] font-medium text-gray-500">Aucun résultat dans les sources officielles</p>
                <p className="text-[12px] text-gray-400 mt-1">Vérifiez que les documents pertinents sont importés</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {results.map((item, i) => <ResultCard key={item.chunkId} item={item} rank={i + 1} />)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
