import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useIngestDocument,
  useIngestLegifranceJson,
  getListDocumentsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Upload, Loader2, FileJson, CheckCircle2,
  AlertTriangle, ChevronRight, Hash, FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const OFFICIAL_SOURCES = [
  "Légifrance", "URSSAF", "Service Public", "Ministère du Travail",
  "DREETS", "INPI", "INSEE", "BODACC", "ANC", "Ameli", "INRS",
  "EUR-Lex", "Infogreffe", "BPI France", "Impôts.gouv",
];
const DOMAINS = ["travail", "social", "commercial", "fiscal", "civil", "autre"];
const DOC_TYPES = ["code", "convention", "texte", "annexe", "avenant", "tableau", "circulaire", "autre"];

const manualSchema = z.object({
  title: z.string().min(3),
  source: z.string().min(1),
  domain: z.string().min(1),
  subDomain: z.string().optional(),
  documentType: z.string().min(1),
  content: z.string().min(50),
  url: z.string().url().optional().or(z.literal("")),
  version: z.string().optional(),
});
type ManualValues = z.infer<typeof manualSchema>;

// ─── KALI JSON preview helper ────────────────────────────────────────────────

interface KaliPreview {
  id: string;
  title: string;
  jurisState: string;
  sectionCount: number;
  totalArticles: number;
  sections: Array<{ title: string; articles: number }>;
}

function parseKaliPreview(raw: unknown): KaliPreview | null {
  try {
    const d = raw as Record<string, unknown>;
    if (!d.id || !d.title) return null;

    const countArticles = (sections: unknown[]): number => {
      let n = 0;
      for (const s of sections) {
        const sec = s as Record<string, unknown>;
        n += ((sec.articles as unknown[]) ?? []).length;
        n += countArticles((sec.sections as unknown[]) ?? []);
      }
      return n;
    };

    const topSections = (d.sections as Array<Record<string, unknown>>) ?? [];
    const sections = topSections.map((s) => ({
      title: String(s.title ?? "Sans titre").trim(),
      articles: countArticles([s]),
    }));

    return {
      id: String(d.id),
      title: String(d.title),
      jurisState: String(d.jurisState ?? "VIGUEUR"),
      sectionCount: topSections.length,
      totalArticles: countArticles(topSections),
      sections,
    };
  } catch {
    return null;
  }
}

const JURIS_STATE_LABELS: Record<string, { label: string; color: string }> = {
  VIGUEUR: { label: "En vigueur", color: "text-green-400 bg-green-950/30 border-green-900" },
  VIGUEUR_ETEN: { label: "En vigueur étendu", color: "text-green-400 bg-green-950/30 border-green-900" },
  ABROGE: { label: "Abrogé", color: "text-red-400 bg-red-950/30 border-red-900" },
  ABROGE_DIFF: { label: "Abrogé différé", color: "text-yellow-400 bg-yellow-950/30 border-yellow-900" },
};

// ─── Manual import form ──────────────────────────────────────────────────────

function ManualForm() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<ManualValues>({
    resolver: zodResolver(manualSchema),
    defaultValues: {
      title: "", source: "", domain: "", subDomain: "",
      documentType: "", content: "", url: "", version: "",
    },
  });

  const ingest = useIngestDocument({
    mutation: {
      onSuccess: (doc) => {
        queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
        toast({ title: `Document importé — ${doc.chunkCount} chunks générés` });
        navigate("/documents");
      },
      onError: () => toast({ title: "Erreur lors de l'import", variant: "destructive" }),
    },
  });

  const onSubmit = (v: ManualValues) => {
    ingest.mutate({
      data: {
        title: v.title, source: v.source, domain: v.domain,
        subDomain: v.subDomain || undefined, documentType: v.documentType,
        content: v.content, url: v.url || undefined, version: v.version || undefined,
      },
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <FormField control={form.control} name="title" render={({ field }) => (
            <FormItem className="col-span-2">
              <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground">Titre du document</FormLabel>
              <FormControl><Input data-testid="input-title" placeholder="Code du travail — Article L1221-1" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="source" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground">Source officielle</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl><SelectTrigger data-testid="select-source"><SelectValue placeholder="Sélectionner la source" /></SelectTrigger></FormControl>
                <SelectContent>{OFFICIAL_SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="domain" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground">Domaine juridique</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl><SelectTrigger data-testid="select-domain"><SelectValue placeholder="Sélectionner le domaine" /></SelectTrigger></FormControl>
                <SelectContent>{DOMAINS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="documentType" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground">Type de document</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl><SelectTrigger data-testid="select-type"><SelectValue placeholder="Type" /></SelectTrigger></FormControl>
                <SelectContent>{DOC_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="subDomain" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground">Sous-domaine (optionnel)</FormLabel>
              <FormControl><Input data-testid="input-subdomain" placeholder="contrat, licenciement…" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="url" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground">URL source (optionnel)</FormLabel>
              <FormControl><Input data-testid="input-url" placeholder="https://www.legifrance.gouv.fr/…" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="version" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground">Version / Année (optionnel)</FormLabel>
              <FormControl><Input data-testid="input-version" placeholder="2024" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        <FormField control={form.control} name="content" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground">Contenu du document</FormLabel>
            <FormControl>
              <Textarea data-testid="textarea-content" placeholder="Collez ici le texte intégral du document réglementaire…" className="min-h-[200px] font-mono text-xs resize-y" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" data-testid="button-submit" disabled={ingest.isPending} className="gap-2">
            {ingest.isPending
              ? <><Loader2 className="w-4 h-4 animate-spin" />Import en cours…</>
              : <><Upload className="w-4 h-4" />Importer et indexer</>}
          </Button>
          <Button type="button" variant="outline" onClick={() => form.reset()}>Réinitialiser</Button>
        </div>
      </form>
    </Form>
  );
}

// ─── Légifrance JSON import ──────────────────────────────────────────────────

type BatchMode = "section" | "full";

function LegifranceImport() {
  const [rawJson, setRawJson] = useState("");
  const [batchMode, setBatchMode] = useState<BatchMode>("section");
  const [preview, setPreview] = useState<KaliPreview | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{
    kaliId: string;
    conventionTitle: string;
    jurisState: string;
    documentsCreated: number;
    totalArticles: number;
    documents: Array<{ id: string; title: string; chunkCount: number; status: string }>;
  } | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const ingestKali = useIngestLegifranceJson({
    mutation: {
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
        setImportResult(result as typeof importResult);
        toast({ title: `${result.documentsCreated} document${result.documentsCreated !== 1 ? "s" : ""} importé${result.documentsCreated !== 1 ? "s" : ""} — ${result.totalArticles} articles` });
      },
      onError: (err: unknown) => {
        const msg = (err as Record<string, unknown>)?.message ?? "Erreur inconnue";
        toast({ title: `Erreur d'import : ${msg}`, variant: "destructive" });
      },
    },
  });

  const handleJsonChange = (val: string) => {
    setRawJson(val);
    setPreview(null);
    setParseError(null);
    setImportResult(null);

    if (!val.trim()) return;
    try {
      const parsed = JSON.parse(val);
      const kp = parseKaliPreview(parsed);
      if (!kp) {
        setParseError("Le JSON ne semble pas être un document KALI Légifrance valide (champs 'id' et 'title' requis).");
      } else {
        setPreview(kp);
      }
    } catch {
      setParseError("JSON invalide — vérifiez la syntaxe.");
    }
  };

  const handleImport = () => {
    if (!preview || !rawJson) return;
    try {
      const parsed = JSON.parse(rawJson);
      ingestKali.mutate({ data: { kaliJson: parsed, batchBy: batchMode } });
    } catch {
      toast({ title: "JSON invalide", variant: "destructive" });
    }
  };

  const stateInfo = preview ? (JURIS_STATE_LABELS[preview.jurisState] ?? { label: preview.jurisState, color: "text-muted-foreground bg-secondary border-border" }) : null;

  return (
    <div className="space-y-5">
      {/* Instructions */}
      <div className="bg-secondary/30 border border-border rounded p-4 text-xs space-y-2">
        <p className="font-semibold text-foreground flex items-center gap-2">
          <FileJson className="w-3.5 h-3.5 text-primary" />
          Import direct depuis l'API Légifrance
        </p>
        <ol className="list-decimal list-inside space-y-1 text-muted-foreground font-mono">
          <li>Ouvrez l'API Légifrance : <span className="text-primary">https://api.legifrance.gouv.fr</span></li>
          <li>Endpoint : <span className="text-primary">GET /consult/kali/TEXT/{"{"}KALITEXT…{"}"}</span></li>
          <li>Exemple d'ID : <span className="text-primary">KALITEXT000005662413</span> (Conv. coll. entreprises artistiques)</li>
          <li>Copiez le JSON complet et collez-le ci-dessous</li>
        </ol>
        <p className="text-muted-foreground">
          Le moteur découpe automatiquement la convention par Titre (section de 1er niveau), chaque Titre devenant un document LexIA indépendant.
        </p>
      </div>

      {/* JSON textarea */}
      <div>
        <label className="text-xs uppercase tracking-widest text-muted-foreground block mb-2">
          JSON KALI (collez ici)
        </label>
        <Textarea
          data-testid="textarea-kali-json"
          placeholder={'{\n  "id": "KALITEXT000005662413",\n  "title": "Convention collective nationale…",\n  "jurisState": "VIGUEUR_ETEN",\n  "sections": […]\n}'}
          value={rawJson}
          onChange={(e) => handleJsonChange(e.target.value)}
          className="min-h-[180px] font-mono text-xs resize-y"
          disabled={ingestKali.isPending}
        />
        {parseError && (
          <div className="mt-2 flex items-start gap-2 text-xs text-red-400">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>{parseError}</span>
          </div>
        )}
      </div>

      {/* Preview */}
      {preview && !importResult && (
        <div className="border border-primary/20 bg-primary/5 rounded p-4 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">{preview.title}</p>
              <p className="text-xs font-mono text-muted-foreground mt-0.5">{preview.id}</p>
            </div>
            {stateInfo && (
              <span className={cn("text-xs px-2 py-1 rounded border flex-shrink-0", stateInfo.color)}>
                {stateInfo.label}
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-card border border-card-border rounded p-3 text-center">
              <div className="text-xl font-mono font-bold text-primary">{preview.sectionCount}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-widest mt-0.5">Titres</div>
            </div>
            <div className="bg-card border border-card-border rounded p-3 text-center">
              <div className="text-xl font-mono font-bold text-primary">{preview.totalArticles}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-widest mt-0.5">Articles</div>
            </div>
            <div className="bg-card border border-card-border rounded p-3 text-center">
              <div className="text-xl font-mono font-bold text-primary">
                {batchMode === "section" ? preview.sectionCount : 1}
              </div>
              <div className="text-xs text-muted-foreground uppercase tracking-widest mt-0.5">Docs LexIA</div>
            </div>
          </div>

          {/* Section list */}
          {preview.sections.length > 0 && (
            <div className="border border-border rounded overflow-hidden">
              <div className="bg-secondary/50 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Structure détectée
              </div>
              {preview.sections.map((s, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 border-t border-border text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    <span className="text-foreground truncate">{s.title || `Section ${i + 1}`}</span>
                  </div>
                  <span className="text-muted-foreground font-mono flex-shrink-0 ml-2">
                    {s.articles} art.
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Batch mode */}
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground block mb-2">Mode d'import</label>
            <div className="flex gap-2">
              {([
                { value: "section", label: `Par Titre (${preview.sectionCount} documents)`, desc: "Recommandé — meilleure précision RAG" },
                { value: "full", label: "Convention entière (1 document)", desc: "Adapté aux conventions courtes" },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setBatchMode(opt.value)}
                  className={cn(
                    "flex-1 border rounded p-3 text-left text-xs transition-colors",
                    batchMode === opt.value
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-primary/40"
                  )}
                >
                  <div className="font-medium">{opt.label}</div>
                  <div className="text-muted-foreground mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={handleImport}
            disabled={ingestKali.isPending}
            data-testid="button-import-kali"
            className="w-full gap-2"
          >
            {ingestKali.isPending
              ? <><Loader2 className="w-4 h-4 animate-spin" />Indexation en cours…</>
              : <><Upload className="w-4 h-4" />Importer {batchMode === "section" ? `${preview.sectionCount} document${preview.sectionCount !== 1 ? "s" : ""}` : "1 document"}</>}
          </Button>
        </div>
      )}

      {/* Import result */}
      {importResult && (
        <div className="border border-green-800 bg-green-950/20 rounded p-4 space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-400" />
            <div>
              <p className="text-sm font-semibold text-green-300">Import réussi</p>
              <p className="text-xs text-green-600 mt-0.5">
                {importResult.documentsCreated} document{importResult.documentsCreated !== 1 ? "s" : ""} créé{importResult.documentsCreated !== 1 ? "s" : ""} — {importResult.totalArticles} articles traités
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {importResult.documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between bg-card border border-card-border rounded px-3 py-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  <span className="text-foreground truncate">{doc.title}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <span className="text-muted-foreground font-mono flex items-center gap-1">
                    <Hash className="w-3 h-3" />{doc.chunkCount}
                  </span>
                  <span className="text-green-400 bg-green-950/30 border border-green-900 px-1.5 py-0.5 rounded">
                    {doc.status}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setRawJson(""); setPreview(null); setImportResult(null); }}
              className="text-xs"
            >
              Importer une autre convention
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function DocumentIngest() {
  const navigate = useNavigate();

  return (
    <div className="flex-1 overflow-y-auto p-8 max-w-3xl">
      <div className="mb-6">
        <button
          onClick={() => navigate("/documents")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Bibliothèque
        </button>
        <h1 className="text-2xl font-bold font-serif text-foreground">Importer un document</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Seules les sources officielles autorisées sont admises dans le périmètre souverain.
        </p>
      </div>

      <Tabs defaultValue="legifrance" className="space-y-6">
        <TabsList className="grid grid-cols-2 w-full max-w-sm">
          <TabsTrigger value="legifrance" className="gap-2 text-xs">
            <FileJson className="w-3.5 h-3.5" />
            JSON Légifrance
          </TabsTrigger>
          <TabsTrigger value="manual" className="gap-2 text-xs">
            <Upload className="w-3.5 h-3.5" />
            Manuel
          </TabsTrigger>
        </TabsList>

        <TabsContent value="legifrance">
          <div className="bg-card border border-card-border rounded p-6">
            <LegifranceImport />
          </div>
        </TabsContent>

        <TabsContent value="manual">
          <div className="bg-card border border-card-border rounded p-6">
            <ManualForm />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
