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

const SEARCH_TYPES: Array<{ value: SearchType; label: string; icon: React.ElementType; desc: string }> = [
  { value: "hybrid", label: "Hybride",    icon: Layers, desc: "BM25 + vectorielle" },
  { value: "vector", label: "Vectorielle",icon: Zap,    desc: "Sémantique"         },
  { value: "bm25",   label: "BM25",       icon: Hash,   desc: "Lexicale"           },
];

const SUGGESTIONS = [
  "durée légale du travail", "taux URSSAF", "période d'essai CDI", "licenciement économique",
];

const DOMAINS = ["travail", "social", "commercial", "fiscal", "civil"];

const DOMAIN_COLORS: Record<string, string> = {
  travail: "text-blue-400", social: "text-emerald-400",
  commercial: "text-orange-400", fiscal: "text-red-400", civil: "text-purple-400",
};

function ResultCard({ item, rank }: { item: ResultItem; rank: number }) {
  const [expanded, setExpanded] = useState(false);
  const score = Math.round(item.score * 100);

  return (
    <div
      data-testid={`card-result-${item.chunkId}`}
      className="group border border-border/60 rounded-xl bg-card hover:border-primary/25 hover:shadow-[0_0_20px_hsl(221_100%_58%/0.06)] transition-all duration-200"
    >
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          {/* Rank */}
          <div className="flex-shrink-0 w-6 h-6 rounded-lg bg-secondary/70 flex items-center justify-center mt-0.5">
            <span className="text-[10px] font-mono font-bold text-muted-foreground">{rank}</span>
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-foreground leading-snug truncate">{item.documentTitle}</p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="text-[10px] bg-secondary/70 border border-border/60 px-2 py-0.5 rounded font-mono">{item.source}</span>
              <span className={cn("text-[10px] font-semibold capitalize", DOMAIN_COLORS[item.domain] ?? "text-muted-foreground")}>
                {item.domain}
              </span>
              {item.articleId && (
                <span className="text-[10px] font-mono text-primary">Art. {item.articleId}</span>
              )}
              {item.sectionPath && (
                <span className="text-[10px] text-muted-foreground/50 truncate font-mono">{item.sectionPath}</span>
              )}
            </div>
          </div>

          {/* Score */}
          <div className="flex-shrink-0 flex flex-col items-center gap-0.5">
            <div className={cn(
              "text-[13px] font-mono font-bold px-2.5 py-1 rounded-lg",
              score >= 80 ? "bg-emerald-950/40 text-emerald-400 shadow-[0_0_10px_hsl(142_60%_45%/0.15)]" :
              score >= 50 ? "bg-amber-950/40  text-amber-400"  :
                            "bg-secondary     text-muted-foreground",
            )}>
              {score}%
            </div>
            <div className="text-[9px] text-muted-foreground/40 uppercase tracking-widest">score</div>
          </div>
        </div>

        {/* Content */}
        <div className={cn(
          "pl-9 text-[11px] text-muted-foreground font-mono leading-relaxed",
          !expanded && "line-clamp-3",
        )}>
          {item.content}
        </div>

        {item.content.length > 280 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="pl-9 text-[11px] text-primary hover:text-primary/80 transition-colors font-medium"
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
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="page-header px-8 py-5 flex-shrink-0">
        <h1 className="text-xl font-bold font-serif text-foreground leading-none">Recherche RAG</h1>
        <p className="text-[12px] text-muted-foreground mt-1.5">
          Recherche sémantique hybride sur les sources officielles indexées
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-5 space-y-5">
        {/* Search box */}
        <div className="rounded-xl border border-card-border bg-card overflow-hidden shadow-[0_0_0_1px_hsl(222_18%_15%/0.5)] focus-within:shadow-[0_0_0_2px_hsl(221_100%_58%/0.2)] transition-all duration-200">
          {/* Input row */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border/60">
            <SearchIcon className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
            <input
              data-testid="input-query"
              placeholder="Durée du préavis, taux de cotisation, conditions de licenciement…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              className="flex-1 bg-transparent text-[13px] font-mono text-foreground placeholder:text-muted-foreground/40 outline-none"
            />
            {query && (
              <button onClick={() => setQuery("")} className="text-muted-foreground/40 hover:text-muted-foreground text-[11px] flex-shrink-0">✕</button>
            )}
          </div>

          {/* Controls row */}
          <div className="flex items-center justify-between px-4 py-2.5 gap-3 flex-wrap">
            {/* Search type toggle */}
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
                        ? "bg-primary/15 text-primary shadow-[inset_0_0_0_1px_hsl(221_100%_58%/0.2)]"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/60",
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
                <SelectTrigger className="h-8 text-[11px] w-36 rounded-lg" data-testid="select-domain">
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
                className="h-8 text-[12px] gap-1.5 rounded-lg px-4"
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
                className="text-[10px] bg-secondary/50 border border-border/50 rounded-full px-2.5 py-1 text-muted-foreground/70 hover:text-foreground hover:border-border transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Loading */}
        {search.isPending && (
          <div className="flex items-center gap-3 text-muted-foreground py-12 justify-center">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            </div>
            <span className="text-[13px]">Recherche dans les sources officielles…</span>
          </div>
        )}

        {/* Results */}
        {results !== null && !search.isPending && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-[12px] text-muted-foreground">
                <span className="text-foreground font-semibold">{results.length}</span>
                {" "}résultat{results.length !== 1 ? "s" : ""} pour&nbsp;
                <span className="font-mono text-primary">"{searchedQuery}"</span>
              </span>
              <span className={cn(
                "text-[10px] px-2 py-0.5 rounded-full border font-mono font-semibold",
                searchType === "hybrid" ? "bg-primary/10 text-primary border-primary/20" :
                searchType === "vector" ? "bg-violet-950/30 text-violet-400 border-violet-900/40" :
                                          "bg-secondary text-muted-foreground border-border",
              )}>
                {SEARCH_TYPES.find(t => t.value === searchType)?.label}
              </span>
            </div>

            {results.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-12 h-12 rounded-2xl bg-secondary/50 flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-6 h-6 text-muted-foreground/25" />
                </div>
                <p className="text-[13px] font-medium text-muted-foreground">Aucun résultat dans les sources officielles</p>
                <p className="text-[11px] text-muted-foreground/50 mt-1">Vérifiez que les documents pertinents sont importés</p>
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
