import { useState } from "react";
import { useListDocuments, useDeleteDocument, getListDocumentsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { FileText, Plus, Trash2, ChevronDown, ExternalLink, Calendar, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const STATUS_CONFIG: Record<string, { label: string; dot: string; badge: string }> = {
  indexed:  { label: "indexé",    dot: "bg-emerald-400", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  pending:  { label: "en attente",dot: "bg-amber-400",   badge: "bg-amber-50   text-amber-700   border-amber-200"   },
  indexing: { label: "indexation",dot: "bg-sky-400",     badge: "bg-sky-50     text-sky-700     border-sky-200"     },
  error:    { label: "erreur",    dot: "bg-red-400",     badge: "bg-red-50     text-red-700     border-red-200"     },
};

const DOMAIN_CONFIG: Record<string, { text: string; bg: string }> = {
  travail:    { text: "text-sky-700",    bg: "bg-sky-50"    },
  social:     { text: "text-emerald-700",bg: "bg-emerald-50"},
  commercial: { text: "text-orange-700", bg: "bg-orange-50" },
  fiscal:     { text: "text-red-700",    bg: "bg-red-50"    },
  civil:      { text: "text-violet-700", bg: "bg-violet-50" },
};

export default function Documents() {
  const [domainFilter, setDomainFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const params = {
    domain: domainFilter && domainFilter !== "all" ? domainFilter : undefined,
    status: statusFilter && statusFilter !== "all" ? statusFilter : undefined,
    limit: 100,
  };

  const { data: docs, isLoading } = useListDocuments(params, {
    query: { queryKey: getListDocumentsQueryKey(params) },
  });

  const deleteDoc = useDeleteDocument({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
        toast({ title: "Document supprimé" });
      },
      onError: () => toast({ title: "Erreur", variant: "destructive" }),
    },
  });

  const filtered = (docs ?? []).filter(d =>
    !search ||
    d.title.toLowerCase().includes(search.toLowerCase()) ||
    d.source.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50/50">
      {/* Header */}
      <div className="page-header px-8 py-5 flex items-center justify-between flex-shrink-0 bg-white/85">
        <div>
          <h1 className="text-[20px] font-semibold text-gray-900 leading-none">Bibliothèque documentaire</h1>
          <p className="text-[13px] text-gray-500 mt-1.5">
            {docs?.length ?? 0} document{(docs?.length ?? 0) !== 1 ? "s" : ""} indexé{(docs?.length ?? 0) !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/documents/ingest">
          <Button data-testid="button-ingest" size="sm"
            className="gap-2 rounded-lg h-8 text-[12px] bg-sky-500 hover:bg-sky-600 border-0 shadow-sm shadow-sky-100">
            <Plus className="w-3.5 h-3.5" />
            Importer
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="px-8 py-3 border-b border-gray-200 bg-white flex gap-2.5 flex-wrap flex-shrink-0">
        <Input
          data-testid="input-search"
          placeholder="Rechercher par titre ou source…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-[260px] h-8 text-[12px] rounded-lg border-gray-200"
        />
        <Select value={domainFilter} onValueChange={setDomainFilter}>
          <SelectTrigger className="w-36 h-8 text-[12px] rounded-lg border-gray-200" data-testid="select-domain">
            <SelectValue placeholder="Domaine" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les domaines</SelectItem>
            {["travail", "social", "commercial", "fiscal", "civil"].map(d => (
              <SelectItem key={d} value={d}>{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-8 text-[12px] rounded-lg border-gray-200" data-testid="select-status">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {["indexed", "pending", "indexing", "error"].map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto px-8 py-4">
        <div className="rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm">
          {/* Header row */}
          <div className="grid grid-cols-[1fr_100px_88px_60px_110px_28px] bg-gray-50 px-4 py-2.5 border-b border-gray-100">
            {["Titre / Source", "Domaine", "Type", "Chunks", "Statut", ""].map((h, i) => (
              <span key={i} className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400">
                {h}
              </span>
            ))}
          </div>

          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="border-t border-gray-100 px-4 py-3.5 flex gap-4 items-center">
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-3/4 rounded bg-gray-100" />
                  <Skeleton className="h-2.5 w-1/3 rounded bg-gray-100" />
                </div>
                <Skeleton className="h-3 w-16 rounded bg-gray-100" />
                <Skeleton className="h-3 w-12 rounded bg-gray-100" />
                <Skeleton className="h-3 w-8 rounded bg-gray-100" />
                <Skeleton className="h-5 w-16 rounded-full bg-gray-100" />
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="px-4 py-16 text-center">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <FileText className="w-6 h-6 text-gray-300" />
              </div>
              <p className="text-[13px] font-medium text-gray-400">Aucun document trouvé</p>
              <p className="text-[12px] text-gray-400 mt-1">Importez un document pour commencer</p>
              <Link href="/documents/ingest">
                <Button variant="outline" size="sm" className="mt-4 rounded-lg text-[12px] h-8 border-gray-200">
                  Importer un document
                </Button>
              </Link>
            </div>
          ) : (
            filtered.map((doc, idx) => {
              const statusCfg = STATUS_CONFIG[doc.status] ?? STATUS_CONFIG.pending;
              const domainCfg = DOMAIN_CONFIG[doc.domain] ?? { text: "text-gray-600", bg: "bg-gray-50" };
              const isExpanded = expandedId === doc.id;

              return (
                <div key={doc.id} data-testid={`row-document-${doc.id}`}
                  className={cn("border-t border-gray-100", idx % 2 === 1 && "bg-gray-50/50")}
                >
                  <div
                    className="grid grid-cols-[1fr_100px_88px_60px_110px_28px] px-4 py-3.5 cursor-pointer hover:bg-sky-50/30 transition-colors items-center"
                    onClick={() => setExpandedId(isExpanded ? null : doc.id)}
                  >
                    <div className="min-w-0 flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-sky-50 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-3.5 h-3.5 text-sky-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] text-gray-800 truncate font-medium leading-tight">{doc.title}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5 font-mono">{doc.source}</p>
                      </div>
                    </div>
                    <span className={cn(
                      "text-[11px] font-semibold capitalize px-2 py-0.5 rounded-full w-fit",
                      domainCfg.text, domainCfg.bg,
                    )}>
                      {doc.domain}
                    </span>
                    <span className="text-[11px] text-gray-500 capitalize">{doc.documentType}</span>
                    <span className="text-[12px] font-mono text-gray-700">{doc.chunkCount}</span>
                    <div className="flex items-center gap-1.5">
                      <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", statusCfg.dot)} />
                      <span className={cn(
                        "text-[10px] px-2 py-0.5 rounded-full border font-semibold",
                        statusCfg.badge,
                      )}>
                        {statusCfg.label}
                      </span>
                    </div>
                    <ChevronDown className={cn(
                      "w-3.5 h-3.5 text-gray-300 transition-transform duration-150",
                      isExpanded && "rotate-180",
                    )} />
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 bg-sky-50/20 border-t border-gray-100">
                      <div className="pt-3 grid grid-cols-2 md:grid-cols-4 gap-4 text-[11px] mb-4">
                        {doc.url && (
                          <div>
                            <div className="flex items-center gap-1 text-gray-400 mb-1">
                              <ExternalLink className="w-2.5 h-2.5" />
                              <span className="uppercase tracking-[0.08em] font-semibold text-[9px]">Source URL</span>
                            </div>
                            <a href={doc.url} target="_blank" rel="noopener noreferrer"
                              className="text-sky-500 hover:text-sky-600 hover:underline truncate block font-mono"
                              onClick={e => e.stopPropagation()}>
                              {doc.url}
                            </a>
                          </div>
                        )}
                        {doc.version && (
                          <div>
                            <div className="flex items-center gap-1 text-gray-400 mb-1">
                              <Tag className="w-2.5 h-2.5" />
                              <span className="uppercase tracking-[0.08em] font-semibold text-[9px]">Version</span>
                            </div>
                            <span className="font-mono text-gray-700">{doc.version}</span>
                          </div>
                        )}
                        {doc.subDomain && (
                          <div>
                            <div className="flex items-center gap-1 text-gray-400 mb-1">
                              <Tag className="w-2.5 h-2.5" />
                              <span className="uppercase tracking-[0.08em] font-semibold text-[9px]">Sous-domaine</span>
                            </div>
                            <span className="text-gray-700">{doc.subDomain}</span>
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-1 text-gray-400 mb-1">
                            <Calendar className="w-2.5 h-2.5" />
                            <span className="uppercase tracking-[0.08em] font-semibold text-[9px]">Importé le</span>
                          </div>
                          <span className="font-mono text-gray-700">
                            {new Date(doc.createdAt).toLocaleDateString("fr-FR")}
                          </span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="destructive"
                        data-testid={`button-delete-${doc.id}`}
                        onClick={e => { e.stopPropagation(); deleteDoc.mutate({ id: doc.id }); }}
                        disabled={deleteDoc.isPending}
                        className="gap-1.5 text-[11px] h-7 rounded-lg"
                      >
                        <Trash2 className="w-3 h-3" />
                        Supprimer
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
