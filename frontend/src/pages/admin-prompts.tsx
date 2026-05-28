import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Braces,
  CopyCheck,
  FileCode2,
  Layers3,
  PencilLine,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { UserMenu } from "@/components/user-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { apiError, authApi } from "@/features/auth/api";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

type PromptBaseRow = {
  id: string;
  content: string;
  version: number;
  status: string;
  created_at: string;
};

type PromptTemplateRow = {
  id: string;
  feature_id: string;
  name: string;
  domain: string;
  sub_domain: string | null;
  task_type: string;
  expected_format: string;
  business_rules: string | null;
  template_content: string;
  version: number;
  status: string;
  created_at: string;
};

type PromptVersionRow = {
  id: string;
  feature_id: string;
  prompt_base_id: string;
  template_id: string;
  system_prompt: string;
  user_prompt_template: string;
  version: number;
  status: string;
  created_at: string;
};

type TabKey = "bases" | "templates" | "versions";

type BaseFormState = {
  content: string;
  status: string;
};

type TemplateFormState = {
  feature_id: string;
  name: string;
  domain: string;
  sub_domain: string;
  task_type: string;
  expected_format: string;
  business_rules: string;
  template_content: string;
  status: string;
};

type VersionFormState = {
  feature_id: string;
  prompt_base_id: string;
  template_id: string;
  system_prompt: string;
  user_prompt_template: string;
  status: string;
};

type DeleteTarget =
  | { kind: "base"; id: string; label: string }
  | { kind: "template"; id: string; label: string }
  | { kind: "version"; id: string; label: string }
  | null;

const STATUS_OPTIONS = ["active", "inactive"];

const EMPTY_BASE_FORM: BaseFormState = {
  content: "",
  status: "active",
};

const EMPTY_TEMPLATE_FORM: TemplateFormState = {
  feature_id: "ai.query",
  name: "",
  domain: "juridique",
  sub_domain: "",
  task_type: "query",
  expected_format: "",
  business_rules: "",
  template_content: "",
  status: "active",
};

const EMPTY_VERSION_FORM: VersionFormState = {
  feature_id: "ai.query",
  prompt_base_id: "",
  template_id: "",
  system_prompt: "",
  user_prompt_template: "",
  status: "active",
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncateMiddle(value: string, max = 56): string {
  if (value.length <= max) return value;
  const head = Math.floor((max - 3) / 2);
  const tail = Math.floor((max - 3) / 2);
  return `${value.slice(0, head)}...${value.slice(value.length - tail)}`;
}

function ActionIconButton({
  label,
  icon: Icon,
  tone,
  onClick,
}: {
  label: string;
  icon: React.ElementType;
  tone: "edit" | "delete";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "group relative inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors",
        tone === "edit" && "border-sky-200 bg-sky-50 text-sky-700 hover:border-sky-300 hover:bg-sky-100",
        tone === "delete" && "border-red-200 bg-red-50 text-red-600 hover:border-red-300 hover:bg-red-100",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        {label}
      </span>
    </button>
  );
}

export default function AdminPromptsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === "ADMIN";

  const [activeTab, setActiveTab] = useState<TabKey>("bases");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [bases, setBases] = useState<PromptBaseRow[]>([]);
  const [templates, setTemplates] = useState<PromptTemplateRow[]>([]);
  const [versions, setVersions] = useState<PromptVersionRow[]>([]);

  const [isBaseDialogOpen, setIsBaseDialogOpen] = useState(false);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [isVersionDialogOpen, setIsVersionDialogOpen] = useState(false);

  const [editingBase, setEditingBase] = useState<PromptBaseRow | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplateRow | null>(null);
  const [editingVersion, setEditingVersion] = useState<PromptVersionRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);

  const [baseForm, setBaseForm] = useState<BaseFormState>(EMPTY_BASE_FORM);
  const [templateForm, setTemplateForm] = useState<TemplateFormState>(EMPTY_TEMPLATE_FORM);
  const [versionForm, setVersionForm] = useState<VersionFormState>(EMPTY_VERSION_FORM);

  const templateById = useMemo(() => new Map(templates.map((item) => [item.id, item])), [templates]);
  const baseById = useMemo(() => new Map(bases.map((item) => [item.id, item])), [bases]);

  const templatesForFeature = useMemo(() => {
    if (!versionForm.feature_id.trim()) return templates;
    return templates.filter((item) => item.feature_id === versionForm.feature_id.trim());
  }, [templates, versionForm.feature_id]);

  const metrics = useMemo(() => {
    const activeBases = bases.filter((item) => item.status === "active").length;
    const activeTemplates = templates.filter((item) => item.status === "active").length;
    const activeVersions = versions.filter((item) => item.status === "active").length;
    return { activeBases, activeTemplates, activeVersions };
  }, [bases, templates, versions]);

  const loadPromptData = useCallback(async () => {
    if (!isAdmin) return;
    setIsLoading(true);
    try {
      const [basesResponse, templatesResponse, versionsResponse] = await Promise.all([
        authApi.get<PromptBaseRow[]>("/ai/prompts/bases"),
        authApi.get<PromptTemplateRow[]>("/ai/prompts/templates"),
        authApi.get<PromptVersionRow[]>("/ai/prompts/versions"),
      ]);
      setBases(basesResponse.data);
      setTemplates(templatesResponse.data);
      setVersions(versionsResponse.data);
    } catch (error) {
      toast.error(apiError(error));
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) {
      setBases([]);
      setTemplates([]);
      setVersions([]);
      return;
    }
    void loadPromptData();
  }, [isAdmin, loadPromptData]);

  useEffect(() => {
    if (!versionForm.template_id && templatesForFeature.length > 0) {
      setVersionForm((previous) => ({ ...previous, template_id: templatesForFeature[0].id }));
    }
  }, [templatesForFeature, versionForm.template_id]);

  function openCreateDialogForTab() {
    if (activeTab === "bases") {
      setEditingBase(null);
      setBaseForm(EMPTY_BASE_FORM);
      setIsBaseDialogOpen(true);
      return;
    }

    if (activeTab === "templates") {
      setEditingTemplate(null);
      setTemplateForm(EMPTY_TEMPLATE_FORM);
      setIsTemplateDialogOpen(true);
      return;
    }

    setEditingVersion(null);
    const defaultFeatureId = templates[0]?.feature_id ?? "ai.query";
    const defaultTemplate = templates.find((item) => item.feature_id === defaultFeatureId) ?? templates[0] ?? null;
    const defaultBase = bases[0] ?? null;
    setVersionForm({
      ...EMPTY_VERSION_FORM,
      feature_id: defaultFeatureId,
      template_id: defaultTemplate?.id ?? "",
      prompt_base_id: defaultBase?.id ?? "",
    });
    setIsVersionDialogOpen(true);
  }

  function openEditBase(item: PromptBaseRow) {
    setEditingBase(item);
    setBaseForm({ content: item.content, status: item.status });
    setIsBaseDialogOpen(true);
  }

  function openEditTemplate(item: PromptTemplateRow) {
    setEditingTemplate(item);
    setTemplateForm({
      feature_id: item.feature_id,
      name: item.name,
      domain: item.domain,
      sub_domain: item.sub_domain ?? "",
      task_type: item.task_type,
      expected_format: item.expected_format,
      business_rules: item.business_rules ?? "",
      template_content: item.template_content,
      status: item.status,
    });
    setIsTemplateDialogOpen(true);
  }

  function openEditVersion(item: PromptVersionRow) {
    setEditingVersion(item);
    setVersionForm({
      feature_id: item.feature_id,
      prompt_base_id: item.prompt_base_id,
      template_id: item.template_id,
      system_prompt: item.system_prompt,
      user_prompt_template: item.user_prompt_template,
      status: item.status,
    });
    setIsVersionDialogOpen(true);
  }

  async function handleSaveBase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAdmin) return;

    const payload = {
      content: baseForm.content.trim(),
      status: baseForm.status,
    };

    if (!payload.content) {
      toast.error("Le contenu du prompt base est requis");
      return;
    }

    if (
      editingBase &&
      payload.content === editingBase.content &&
      payload.status === editingBase.status
    ) {
      toast.info("Aucune modification detectee");
      setIsBaseDialogOpen(false);
      return;
    }

    setIsSaving(true);
    try {
      if (editingBase) {
        await authApi.patch(`/ai/prompts/bases/${editingBase.id}`, payload);
        toast.success("Prompt base mis a jour");
      } else {
        await authApi.post("/ai/prompts/bases", payload);
        toast.success("Prompt base cree");
      }
      setIsBaseDialogOpen(false);
      await loadPromptData();
    } catch (error) {
      toast.error(apiError(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAdmin) return;

    const payload = {
      feature_id: templateForm.feature_id.trim(),
      name: templateForm.name.trim(),
      domain: templateForm.domain.trim(),
      sub_domain: templateForm.sub_domain.trim() || null,
      task_type: templateForm.task_type.trim(),
      expected_format: templateForm.expected_format.trim(),
      business_rules: templateForm.business_rules.trim() || null,
      template_content: templateForm.template_content.trim(),
      status: templateForm.status,
    };

    if (!payload.feature_id || !payload.name || !payload.domain || !payload.task_type || !payload.expected_format || !payload.template_content) {
      toast.error("Tous les champs obligatoires doivent etre remplis");
      return;
    }

    if (
      editingTemplate &&
      payload.feature_id === editingTemplate.feature_id &&
      payload.name === editingTemplate.name &&
      payload.domain === editingTemplate.domain &&
      payload.sub_domain === editingTemplate.sub_domain &&
      payload.task_type === editingTemplate.task_type &&
      payload.expected_format === editingTemplate.expected_format &&
      payload.business_rules === editingTemplate.business_rules &&
      payload.template_content === editingTemplate.template_content &&
      payload.status === editingTemplate.status
    ) {
      toast.info("Aucune modification detectee");
      setIsTemplateDialogOpen(false);
      return;
    }

    setIsSaving(true);
    try {
      if (editingTemplate) {
        await authApi.patch(`/ai/prompts/templates/${editingTemplate.id}`, {
          name: payload.name,
          domain: payload.domain,
          sub_domain: payload.sub_domain,
          task_type: payload.task_type,
          expected_format: payload.expected_format,
          business_rules: payload.business_rules,
          template_content: payload.template_content,
          status: payload.status,
        });
        toast.success("Prompt template mis a jour");
      } else {
        await authApi.post("/ai/prompts/templates", payload);
        toast.success("Prompt template cree");
      }
      setIsTemplateDialogOpen(false);
      await loadPromptData();
    } catch (error) {
      toast.error(apiError(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveVersion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAdmin) return;

    const payload = {
      feature_id: versionForm.feature_id.trim(),
      prompt_base_id: versionForm.prompt_base_id,
      template_id: versionForm.template_id,
      system_prompt: versionForm.system_prompt.trim(),
      user_prompt_template: versionForm.user_prompt_template.trim(),
      status: versionForm.status,
    };

    if (!payload.feature_id || !payload.prompt_base_id || !payload.template_id || !payload.system_prompt || !payload.user_prompt_template) {
      toast.error("Tous les champs obligatoires doivent etre remplis");
      return;
    }

    if (
      editingVersion &&
      payload.feature_id === editingVersion.feature_id &&
      payload.prompt_base_id === editingVersion.prompt_base_id &&
      payload.template_id === editingVersion.template_id &&
      payload.system_prompt === editingVersion.system_prompt &&
      payload.user_prompt_template === editingVersion.user_prompt_template &&
      payload.status === editingVersion.status
    ) {
      toast.info("Aucune modification detectee");
      setIsVersionDialogOpen(false);
      return;
    }

    setIsSaving(true);
    try {
      if (editingVersion) {
        await authApi.patch(`/ai/prompts/versions/${editingVersion.id}`, {
          prompt_base_id: payload.prompt_base_id,
          template_id: payload.template_id,
          system_prompt: payload.system_prompt,
          user_prompt_template: payload.user_prompt_template,
          status: payload.status,
        });
        toast.success("Prompt version mise a jour");
      } else {
        await authApi.post("/ai/prompts/versions", payload);
        toast.success("Prompt version creee");
      }
      setIsVersionDialogOpen(false);
      await loadPromptData();
    } catch (error) {
      toast.error(apiError(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      if (deleteTarget.kind === "base") {
        await authApi.delete(`/ai/prompts/bases/${deleteTarget.id}`);
      } else if (deleteTarget.kind === "template") {
        await authApi.delete(`/ai/prompts/templates/${deleteTarget.id}`);
      } else {
        await authApi.delete(`/ai/prompts/versions/${deleteTarget.id}`);
      }
      toast.success("Element supprime");
      setDeleteTarget(null);
      await loadPromptData();
    } catch (error) {
      toast.error(apiError(error));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/60">
      <div className="page-header flex items-center justify-between border-b border-gray-100 bg-white/90 px-8 py-5 backdrop-blur">
        <div>
          <h1 className="text-[20px] font-semibold leading-none text-gray-900">Parametrage des prompts IA</h1>
          <p className="mt-1.5 text-[13px] text-gray-500">Administration centralisee des prompt bases, templates et versions</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadPromptData()}
                disabled={isLoading}
                className="h-8 rounded-lg border-gray-200 text-[12px]"
              >
                <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", isLoading && "animate-spin")} />
                Rafraichir
              </Button>
              <Button
                size="sm"
                onClick={openCreateDialogForTab}
                className="h-8 rounded-lg bg-sky-600 px-3 text-[12px] hover:bg-sky-700"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Ajouter ({activeTab})
              </Button>
            </>
          )}
          <UserMenu />
        </div>
      </div>

      <div className="space-y-6 px-8 py-6">
        {!isAdmin ? (
          <section className="rounded-xl border border-red-100 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2 text-red-600">
                  <ShieldCheck className="h-4 w-4" />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em]">Acces refuse</p>
                </div>
                <h2 className="text-lg font-semibold text-gray-900">Cette page est reservee aux administrateurs</h2>
                <p className="mt-1.5 text-[13px] text-gray-500">Votre role ne permet pas de gerer les configurations de prompts.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")} className="h-8 rounded-lg border-gray-200 text-[12px]">
                Retour dashboard
              </Button>
            </div>
          </section>
        ) : (
          <>
            <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Prompt Bases", value: bases.length, icon: Layers3, color: "bg-sky-50 text-sky-700" },
                { label: "Templates", value: templates.length, icon: FileCode2, color: "bg-indigo-50 text-indigo-700" },
                { label: "Versions", value: versions.length, icon: Braces, color: "bg-emerald-50 text-emerald-700" },
                { label: "Actifs", value: metrics.activeVersions, icon: CopyCheck, color: "bg-amber-50 text-amber-700" },
              ].map((item) => (
                <article key={item.label} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className={cn("rounded-lg p-2", item.color)}>
                      <item.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.08em] text-gray-500">{item.label}</p>
                      <p className="text-2xl font-semibold text-gray-900">{item.value}</p>
                    </div>
                  </div>
                </article>
              ))}
            </section>

            <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabKey)}>
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-500">Configuration</h2>
                    <p className="mt-1 text-[13px] text-gray-600">Gestion CRUD complete des prompts utilises par le moteur IA.</p>
                  </div>
                  <TabsList className="h-9 rounded-lg bg-gray-100/90 p-1">
                    <TabsTrigger value="bases" className="text-[12px]">Bases</TabsTrigger>
                    <TabsTrigger value="templates" className="text-[12px]">Templates</TabsTrigger>
                    <TabsTrigger value="versions" className="text-[12px]">Versions</TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="bases" className="mt-0">
                  {isLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 4 }).map((_, index) => (
                        <div key={index} className="grid grid-cols-[.5fr_.6fr_1.8fr_.8fr_auto] gap-3 rounded-lg border border-gray-100 p-3">
                          <Skeleton className="h-4 w-12 bg-gray-100" />
                          <Skeleton className="h-4 w-16 bg-gray-100" />
                          <Skeleton className="h-4 w-full bg-gray-100" />
                          <Skeleton className="h-4 w-24 bg-gray-100" />
                          <Skeleton className="h-8 w-16 bg-gray-100" />
                        </div>
                      ))}
                    </div>
                  ) : bases.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-[13px] text-gray-500">
                      Aucun prompt base disponible.
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-gray-200">
                      <Table className="min-w-[820px]">
                        <TableHeader>
                          <TableRow className="bg-gradient-to-r from-sky-50 to-white hover:bg-gradient-to-r hover:from-sky-50 hover:to-white">
                            <TableHead className="px-3 text-[11px] uppercase tracking-[0.08em] text-gray-500">Version</TableHead>
                            <TableHead className="px-3 text-[11px] uppercase tracking-[0.08em] text-gray-500">Statut</TableHead>
                            <TableHead className="px-3 text-[11px] uppercase tracking-[0.08em] text-gray-500">Contenu</TableHead>
                            <TableHead className="px-3 text-[11px] uppercase tracking-[0.08em] text-gray-500">Cree le</TableHead>
                            <TableHead className="px-3 text-right text-[11px] uppercase tracking-[0.08em] text-gray-500">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {bases.map((item, index) => (
                            <TableRow key={item.id} className={cn(index % 2 === 0 ? "bg-white" : "bg-gray-50/40", "hover:bg-sky-50/40")}>
                              <TableCell className="px-3 py-3 text-[12px] font-semibold text-gray-900">v{item.version}</TableCell>
                              <TableCell className="px-3 py-3">
                                <Badge variant="outline" className={cn("px-2.5 py-0.5 text-[10px] font-semibold", item.status === "active" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-gray-200 bg-gray-50 text-gray-600")}>
                                  {item.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="px-3 py-3 text-[12px] text-gray-600">{truncateMiddle(item.content.replace(/\s+/g, " "), 96)}</TableCell>
                              <TableCell className="px-3 py-3 text-[12px] text-gray-600">{formatDate(item.created_at)}</TableCell>
                              <TableCell className="px-3 py-3">
                                <div className="flex justify-end gap-2">
                                  <ActionIconButton label="Modifier" icon={PencilLine} tone="edit" onClick={() => openEditBase(item)} />
                                  <ActionIconButton
                                    label="Supprimer"
                                    icon={Trash2}
                                    tone="delete"
                                    onClick={() => setDeleteTarget({ kind: "base", id: item.id, label: `Prompt base v${item.version}` })}
                                  />
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="templates" className="mt-0">
                  {isLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 4 }).map((_, index) => (
                        <div key={index} className="grid grid-cols-[1fr_1fr_.7fr_.7fr_.8fr_auto] gap-3 rounded-lg border border-gray-100 p-3">
                          <Skeleton className="h-4 w-28 bg-gray-100" />
                          <Skeleton className="h-4 w-36 bg-gray-100" />
                          <Skeleton className="h-4 w-16 bg-gray-100" />
                          <Skeleton className="h-4 w-20 bg-gray-100" />
                          <Skeleton className="h-4 w-24 bg-gray-100" />
                          <Skeleton className="h-8 w-16 bg-gray-100" />
                        </div>
                      ))}
                    </div>
                  ) : templates.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-[13px] text-gray-500">
                      Aucun prompt template disponible.
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-gray-200">
                      <Table className="min-w-[940px]">
                        <TableHeader>
                          <TableRow className="bg-gradient-to-r from-indigo-50 to-white hover:bg-gradient-to-r hover:from-indigo-50 hover:to-white">
                            <TableHead className="px-3 text-[11px] uppercase tracking-[0.08em] text-gray-500">Feature</TableHead>
                            <TableHead className="px-3 text-[11px] uppercase tracking-[0.08em] text-gray-500">Nom</TableHead>
                            <TableHead className="px-3 text-[11px] uppercase tracking-[0.08em] text-gray-500">Task</TableHead>
                            <TableHead className="px-3 text-[11px] uppercase tracking-[0.08em] text-gray-500">Version</TableHead>
                            <TableHead className="px-3 text-[11px] uppercase tracking-[0.08em] text-gray-500">Statut</TableHead>
                            <TableHead className="px-3 text-right text-[11px] uppercase tracking-[0.08em] text-gray-500">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {templates.map((item, index) => (
                            <TableRow key={item.id} className={cn(index % 2 === 0 ? "bg-white" : "bg-gray-50/40", "hover:bg-indigo-50/35")}>
                              <TableCell className="px-3 py-3 text-[12px] font-semibold text-gray-900">{item.feature_id}</TableCell>
                              <TableCell className="px-3 py-3">
                                <p className="text-[12px] font-medium text-gray-800">{item.name}</p>
                                <p className="text-[11px] text-gray-500">{item.domain}{item.sub_domain ? ` / ${item.sub_domain}` : ""}</p>
                              </TableCell>
                              <TableCell className="px-3 py-3 text-[12px] text-gray-600">{item.task_type}</TableCell>
                              <TableCell className="px-3 py-3 text-[12px] text-gray-600">v{item.version}</TableCell>
                              <TableCell className="px-3 py-3">
                                <Badge variant="outline" className={cn("px-2.5 py-0.5 text-[10px] font-semibold", item.status === "active" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-gray-200 bg-gray-50 text-gray-600")}>
                                  {item.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="px-3 py-3">
                                <div className="flex justify-end gap-2">
                                  <ActionIconButton label="Modifier" icon={PencilLine} tone="edit" onClick={() => openEditTemplate(item)} />
                                  <ActionIconButton
                                    label="Supprimer"
                                    icon={Trash2}
                                    tone="delete"
                                    onClick={() => setDeleteTarget({ kind: "template", id: item.id, label: item.name })}
                                  />
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="versions" className="mt-0">
                  {isLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 4 }).map((_, index) => (
                        <div key={index} className="grid grid-cols-[1fr_.7fr_.7fr_.7fr_.8fr_auto] gap-3 rounded-lg border border-gray-100 p-3">
                          <Skeleton className="h-4 w-28 bg-gray-100" />
                          <Skeleton className="h-4 w-12 bg-gray-100" />
                          <Skeleton className="h-4 w-20 bg-gray-100" />
                          <Skeleton className="h-4 w-20 bg-gray-100" />
                          <Skeleton className="h-4 w-20 bg-gray-100" />
                          <Skeleton className="h-8 w-16 bg-gray-100" />
                        </div>
                      ))}
                    </div>
                  ) : versions.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-[13px] text-gray-500">
                      Aucune prompt version disponible.
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-gray-200">
                      <Table className="min-w-[940px]">
                        <TableHeader>
                          <TableRow className="bg-gradient-to-r from-emerald-50 to-white hover:bg-gradient-to-r hover:from-emerald-50 hover:to-white">
                            <TableHead className="px-3 text-[11px] uppercase tracking-[0.08em] text-gray-500">Feature</TableHead>
                            <TableHead className="px-3 text-[11px] uppercase tracking-[0.08em] text-gray-500">Version</TableHead>
                            <TableHead className="px-3 text-[11px] uppercase tracking-[0.08em] text-gray-500">Prompt Base</TableHead>
                            <TableHead className="px-3 text-[11px] uppercase tracking-[0.08em] text-gray-500">Template</TableHead>
                            <TableHead className="px-3 text-[11px] uppercase tracking-[0.08em] text-gray-500">Statut</TableHead>
                            <TableHead className="px-3 text-right text-[11px] uppercase tracking-[0.08em] text-gray-500">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {versions.map((item, index) => {
                            const template = templateById.get(item.template_id);
                            const promptBase = baseById.get(item.prompt_base_id);
                            return (
                              <TableRow key={item.id} className={cn(index % 2 === 0 ? "bg-white" : "bg-gray-50/40", "hover:bg-emerald-50/35")}>
                                <TableCell className="px-3 py-3 text-[12px] font-semibold text-gray-900">{item.feature_id}</TableCell>
                                <TableCell className="px-3 py-3 text-[12px] text-gray-600">v{item.version}</TableCell>
                                <TableCell className="px-3 py-3 text-[12px] text-gray-600">{promptBase ? `v${promptBase.version}` : truncateMiddle(item.prompt_base_id, 26)}</TableCell>
                                <TableCell className="px-3 py-3 text-[12px] text-gray-600">{template ? truncateMiddle(template.name, 32) : truncateMiddle(item.template_id, 32)}</TableCell>
                                <TableCell className="px-3 py-3">
                                  <Badge variant="outline" className={cn("px-2.5 py-0.5 text-[10px] font-semibold", item.status === "active" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-gray-200 bg-gray-50 text-gray-600")}>
                                    {item.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="px-3 py-3">
                                  <div className="flex justify-end gap-2">
                                    <ActionIconButton label="Modifier" icon={PencilLine} tone="edit" onClick={() => openEditVersion(item)} />
                                    <ActionIconButton
                                      label="Supprimer"
                                      icon={Trash2}
                                      tone="delete"
                                      onClick={() => setDeleteTarget({ kind: "version", id: item.id, label: `${item.feature_id} v${item.version}` })}
                                    />
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </section>
          </>
        )}
      </div>

      <Dialog open={isBaseDialogOpen} onOpenChange={(open) => (!open ? setIsBaseDialogOpen(false) : setIsBaseDialogOpen(true))}>
        <DialogContent className="max-w-2xl rounded-xl border-gray-200 p-0">
          <DialogHeader className="border-b border-gray-100 px-6 py-4">
            <DialogTitle className="text-[16px] text-gray-900">{editingBase ? "Modifier prompt base" : "Nouveau prompt base"}</DialogTitle>
            <DialogDescription className="text-[13px] text-gray-500">Le prompt base sert de couche globale commune a toutes les versions.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => void handleSaveBase(event)} className="space-y-4 px-6 py-5">
            <div className="space-y-1.5">
              <Label htmlFor="prompt-base-content" className="text-[12px] text-gray-700">Contenu</Label>
              <Textarea
                id="prompt-base-content"
                value={baseForm.content}
                onChange={(event) => setBaseForm((previous) => ({ ...previous, content: event.target.value }))}
                placeholder="Regles globales du systeme..."
                className="min-h-[180px] border-gray-200 text-[13px]"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px] text-gray-700">Statut</Label>
              <Select value={baseForm.status} onValueChange={(value) => setBaseForm((previous) => ({ ...previous, status: value }))}>
                <SelectTrigger className="h-9 border-gray-200 text-[13px]">
                  <SelectValue placeholder="Selectionner un statut" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status} value={status} className="text-[13px]">{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="border-t border-gray-100 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsBaseDialogOpen(false)} className="h-8 rounded-lg border-gray-200 text-[12px]">Annuler</Button>
              <Button type="submit" disabled={isSaving} className="h-8 rounded-lg bg-sky-600 px-3 text-[12px] hover:bg-sky-700">{isSaving ? "Enregistrement..." : editingBase ? "Mettre a jour" : "Creer"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isTemplateDialogOpen} onOpenChange={(open) => (!open ? setIsTemplateDialogOpen(false) : setIsTemplateDialogOpen(true))}>
        <DialogContent className="max-w-3xl rounded-xl border-gray-200 p-0">
          <DialogHeader className="border-b border-gray-100 px-6 py-4">
            <DialogTitle className="text-[16px] text-gray-900">{editingTemplate ? "Modifier prompt template" : "Nouveau prompt template"}</DialogTitle>
            <DialogDescription className="text-[13px] text-gray-500">Definit la structure fonctionnelle par feature.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => void handleSaveTemplate(event)} className="space-y-4 px-6 py-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-[12px] text-gray-700">Feature ID</Label>
                <Input value={templateForm.feature_id} onChange={(event) => setTemplateForm((previous) => ({ ...previous, feature_id: event.target.value }))} className="h-9 border-gray-200 text-[13px]" required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px] text-gray-700">Nom</Label>
                <Input value={templateForm.name} onChange={(event) => setTemplateForm((previous) => ({ ...previous, name: event.target.value }))} className="h-9 border-gray-200 text-[13px]" required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px] text-gray-700">Domain</Label>
                <Input value={templateForm.domain} onChange={(event) => setTemplateForm((previous) => ({ ...previous, domain: event.target.value }))} className="h-9 border-gray-200 text-[13px]" required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px] text-gray-700">Sub domain</Label>
                <Input value={templateForm.sub_domain} onChange={(event) => setTemplateForm((previous) => ({ ...previous, sub_domain: event.target.value }))} className="h-9 border-gray-200 text-[13px]" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px] text-gray-700">Task type</Label>
                <Input value={templateForm.task_type} onChange={(event) => setTemplateForm((previous) => ({ ...previous, task_type: event.target.value }))} className="h-9 border-gray-200 text-[13px]" required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px] text-gray-700">Statut</Label>
                <Select value={templateForm.status} onValueChange={(value) => setTemplateForm((previous) => ({ ...previous, status: value }))}>
                  <SelectTrigger className="h-9 border-gray-200 text-[13px]">
                    <SelectValue placeholder="Selectionner un statut" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status} className="text-[13px]">{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-[12px] text-gray-700">Expected format</Label>
                <Textarea value={templateForm.expected_format} onChange={(event) => setTemplateForm((previous) => ({ ...previous, expected_format: event.target.value }))} className="min-h-[80px] border-gray-200 text-[13px]" required />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-[12px] text-gray-700">Business rules</Label>
                <Textarea value={templateForm.business_rules} onChange={(event) => setTemplateForm((previous) => ({ ...previous, business_rules: event.target.value }))} className="min-h-[80px] border-gray-200 text-[13px]" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-[12px] text-gray-700">Template content</Label>
                <Textarea value={templateForm.template_content} onChange={(event) => setTemplateForm((previous) => ({ ...previous, template_content: event.target.value }))} className="min-h-[160px] border-gray-200 font-mono text-[12px]" required />
              </div>
            </div>
            <DialogFooter className="border-t border-gray-100 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsTemplateDialogOpen(false)} className="h-8 rounded-lg border-gray-200 text-[12px]">Annuler</Button>
              <Button type="submit" disabled={isSaving} className="h-8 rounded-lg bg-sky-600 px-3 text-[12px] hover:bg-sky-700">{isSaving ? "Enregistrement..." : editingTemplate ? "Mettre a jour" : "Creer"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isVersionDialogOpen} onOpenChange={(open) => (!open ? setIsVersionDialogOpen(false) : setIsVersionDialogOpen(true))}>
        <DialogContent className="max-w-3xl rounded-xl border-gray-200 p-0">
          <DialogHeader className="border-b border-gray-100 px-6 py-4">
            <DialogTitle className="text-[16px] text-gray-900">{editingVersion ? "Modifier prompt version" : "Nouvelle prompt version"}</DialogTitle>
            <DialogDescription className="text-[13px] text-gray-500">Assemble prompt base + template + contenu final par feature.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => void handleSaveVersion(event)} className="space-y-4 px-6 py-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-[12px] text-gray-700">Feature ID</Label>
                <Input value={versionForm.feature_id} onChange={(event) => setVersionForm((previous) => ({ ...previous, feature_id: event.target.value }))} className="h-9 border-gray-200 text-[13px]" required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px] text-gray-700">Prompt base</Label>
                <Select value={versionForm.prompt_base_id} onValueChange={(value) => setVersionForm((previous) => ({ ...previous, prompt_base_id: value }))}>
                  <SelectTrigger className="h-9 border-gray-200 text-[13px]">
                    <SelectValue placeholder="Selectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    {bases.map((item) => (
                      <SelectItem key={item.id} value={item.id} className="text-[13px]">{`v${item.version} - ${item.status}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px] text-gray-700">Template</Label>
                <Select value={versionForm.template_id} onValueChange={(value) => setVersionForm((previous) => ({ ...previous, template_id: value }))}>
                  <SelectTrigger className="h-9 border-gray-200 text-[13px]">
                    <SelectValue placeholder="Selectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    {templatesForFeature.map((item) => (
                      <SelectItem key={item.id} value={item.id} className="text-[13px]">{`${item.name} (v${item.version})`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px] text-gray-700">Statut</Label>
                <Select value={versionForm.status} onValueChange={(value) => setVersionForm((previous) => ({ ...previous, status: value }))}>
                  <SelectTrigger className="h-9 border-gray-200 text-[13px]">
                    <SelectValue placeholder="Selectionner un statut" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status} className="text-[13px]">{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-[12px] text-gray-700">System prompt</Label>
                <Textarea value={versionForm.system_prompt} onChange={(event) => setVersionForm((previous) => ({ ...previous, system_prompt: event.target.value }))} className="min-h-[120px] border-gray-200 text-[13px]" required />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-[12px] text-gray-700">User prompt template</Label>
                <Textarea value={versionForm.user_prompt_template} onChange={(event) => setVersionForm((previous) => ({ ...previous, user_prompt_template: event.target.value }))} className="min-h-[150px] border-gray-200 font-mono text-[12px]" required />
              </div>
            </div>
            <DialogFooter className="border-t border-gray-100 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsVersionDialogOpen(false)} className="h-8 rounded-lg border-gray-200 text-[12px]">Annuler</Button>
              <Button type="submit" disabled={isSaving} className="h-8 rounded-lg bg-sky-600 px-3 text-[12px] hover:bg-sky-700">{isSaving ? "Enregistrement..." : editingVersion ? "Mettre a jour" : "Creer"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent className="rounded-xl border-gray-200">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet element ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irreversible. L'element <span className="font-semibold">{deleteTarget?.label}</span> sera supprime definitivement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleConfirmDelete()} disabled={isDeleting} className="bg-red-600 text-white hover:bg-red-700">
              {isDeleting ? "Suppression..." : "Oui, supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
