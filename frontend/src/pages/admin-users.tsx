import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, PencilLine, Plus, RefreshCw, ShieldCheck, Trash2, UserCheck, UserPlus, Users } from "lucide-react";
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
import { type AdminUser, apiError, authApi, type Role } from "@/features/auth/api";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

type UserFormState = {
  email: string;
  full_name: string;
  role: Role;
  is_active: "true" | "false";
  is_verified: "true" | "false";
  password: string;
  confirm_password: string;
};

const EMPTY_FORM: UserFormState = {
  email: "",
  full_name: "",
  role: "USER",
  is_active: "true",
  is_verified: "false",
  password: "",
  confirm_password: "",
};

const ROLE_OPTIONS: Role[] = ["USER", "ADMIN", "CUSTOM"];

const ROLE_LABELS: Record<Role, string> = {
  USER: "User",
  ADMIN: "Admin",
  CUSTOM: "Custom",
};

const PAGE_SIZE = 8;

function ActionIconButton({
  label,
  icon: Icon,
  tone,
  disabled,
  onClick,
}: {
  label: string;
  icon: React.ElementType;
  tone: "edit" | "delete";
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "group relative inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors",
        tone === "edit" && "border-sky-200 bg-sky-50 text-sky-700 hover:border-sky-300 hover:bg-sky-100",
        tone === "delete" && "border-red-200 bg-red-50 text-red-600 hover:border-red-300 hover:bg-red-100",
        disabled && "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {!disabled && (
        <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          {label}
        </span>
      )}
    </button>
  );
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Jamais";
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

function toFormState(member: AdminUser | null): UserFormState {
  if (!member) return EMPTY_FORM;
  return {
    email: member.email,
    full_name: member.full_name ?? "",
    role: member.role,
    is_active: member.is_active ? "true" : "false",
    is_verified: member.is_verified ? "true" : "false",
    password: "",
    confirm_password: "",
  };
}

export default function AdminUsersPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === "ADMIN";

  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null);
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM);
  const [currentPage, setCurrentPage] = useState(1);

  const metrics = useMemo(() => {
    const active = adminUsers.filter((member) => member.is_active).length;
    const verified = adminUsers.filter((member) => member.is_verified).length;
    const admins = adminUsers.filter((member) => member.role === "ADMIN").length;
    return { active, verified, admins };
  }, [adminUsers]);

  const totalPages = Math.max(1, Math.ceil(adminUsers.length / PAGE_SIZE));

  useEffect(() => {
    setCurrentPage((previous) => Math.min(previous, totalPages));
  }, [totalPages]);

  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return adminUsers.slice(start, start + PAGE_SIZE);
  }, [adminUsers, currentPage]);

  const firstVisible = adminUsers.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const lastVisible = adminUsers.length === 0 ? 0 : Math.min(adminUsers.length, currentPage * PAGE_SIZE);

  const loadAdminUsers = useCallback(async () => {
    if (!isAdmin) return;
    setIsLoading(true);
    try {
      const { data } = await authApi.get<AdminUser[]>("/admin/users");
      setAdminUsers(data);
    } catch (error) {
      toast.error(apiError(error));
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) {
      setAdminUsers([]);
      setCurrentPage(1);
      return;
    }
    void loadAdminUsers();
  }, [isAdmin, loadAdminUsers]);

  function updateForm<K extends keyof UserFormState>(key: K, value: UserFormState[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  function openCreateDialog() {
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setIsDialogOpen(true);
  }

  function openEditDialog(member: AdminUser) {
    setEditingUser(member);
    setForm(toFormState(member));
    setIsDialogOpen(true);
  }

  function closeDialog() {
    setIsDialogOpen(false);
    setEditingUser(null);
    setForm(EMPTY_FORM);
  }

  async function handleSaveUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAdmin) return;

    const email = form.email.trim().toLowerCase();
    const fullName = form.full_name.trim();
    const normalizedFullName = fullName.length > 0 ? fullName : null;
    const isActive = form.is_active === "true";
    const isVerified = form.is_verified === "true";

    if (!email) {
      toast.error("Email requis");
      return;
    }

    if (!editingUser) {
      if (!form.password || !form.confirm_password) {
        toast.error("Mot de passe et confirmation requis");
        return;
      }
      if (form.password !== form.confirm_password) {
        toast.error("Les mots de passe ne correspondent pas");
        return;
      }
    } else if (form.password || form.confirm_password) {
      if (!form.password || !form.confirm_password) {
        toast.error("Les deux champs mot de passe sont requis");
        return;
      }
      if (form.password !== form.confirm_password) {
        toast.error("Les mots de passe ne correspondent pas");
        return;
      }
    }

    setIsSaving(true);
    try {
      if (editingUser) {
        const payload: Record<string, unknown> = {};

        if (email !== editingUser.email.toLowerCase()) payload.email = email;
        if (normalizedFullName !== (editingUser.full_name ?? null)) payload.full_name = normalizedFullName;
        if (form.role !== editingUser.role) payload.role = form.role;
        if (isActive !== editingUser.is_active) payload.is_active = isActive;
        if (isVerified !== editingUser.is_verified) payload.is_verified = isVerified;
        if (form.password || form.confirm_password) {
          payload.password = form.password;
          payload.confirm_password = form.confirm_password;
        }

        if (Object.keys(payload).length === 0) {
          toast.info("Aucune modification detectee");
          setIsSaving(false);
          closeDialog();
          return;
        }

        await authApi.patch(`/admin/users/${editingUser.id}`, payload);
        toast.success("Utilisateur mis a jour");
      } else {
        await authApi.post("/admin/users", {
          email,
          full_name: normalizedFullName,
          role: form.role,
          is_active: isActive,
          is_verified: isVerified,
          password: form.password,
          confirm_password: form.confirm_password,
        });
        toast.success("Utilisateur cree");
      }

      closeDialog();
      await loadAdminUsers();
    } catch (error) {
      toast.error(apiError(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteUser() {
    if (!deletingUser) return;
    setIsDeleting(true);
    try {
      await authApi.delete(`/admin/users/${deletingUser.id}`);
      toast.success("Utilisateur supprime");
      setDeletingUser(null);
      await loadAdminUsers();
    } catch (error) {
      toast.error(apiError(error));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50">
      <div className="page-header flex items-center justify-between bg-white/85 px-8 py-5">
        <div>
          <h1 className="text-[20px] font-semibold leading-none text-gray-900">Administration utilisateurs</h1>
          <p className="mt-1.5 text-[13px] text-gray-500">Page dediee a la gestion complete des comptes</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadAdminUsers()}
                disabled={isLoading}
                className="h-8 rounded-lg border-gray-200 text-[12px]"
              >
                <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", isLoading && "animate-spin")} />
                Rafraichir
              </Button>
              <Button size="sm" onClick={openCreateDialog} className="h-8 rounded-lg bg-sky-600 px-3 text-[12px] hover:bg-sky-700">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Nouvel utilisateur
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
                <h2 className="text-lg font-semibold text-gray-900">Cette section est reservee aux administrateurs</h2>
                <p className="mt-1.5 text-[13px] text-gray-500">Votre role actuel ne permet pas d'acceder a la gestion des utilisateurs.</p>
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
                { label: "Comptes", value: adminUsers.length, icon: Users, color: "bg-sky-50 text-sky-700" },
                { label: "Comptes actifs", value: metrics.active, icon: UserPlus, color: "bg-emerald-50 text-emerald-700" },
                { label: "Emails verifies", value: metrics.verified, icon: UserCheck, color: "bg-amber-50 text-amber-700" },
                { label: "Administrateurs", value: metrics.admins, icon: ShieldCheck, color: "bg-violet-50 text-violet-700" },
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
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-500">Utilisateurs</h2>
                  <p className="mt-1 text-[13px] text-gray-600">Creation, edition et suppression de comptes depuis un seul ecran.</p>
                </div>
              </div>

              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="grid grid-cols-[1.5fr_.7fr_.9fr_.9fr_auto] gap-3 rounded-lg border border-gray-100 p-3">
                      <Skeleton className="h-4 w-2/3 bg-gray-100" />
                      <Skeleton className="h-4 w-16 bg-gray-100" />
                      <Skeleton className="h-4 w-20 bg-gray-100" />
                      <Skeleton className="h-4 w-28 bg-gray-100" />
                      <Skeleton className="h-8 w-24 bg-gray-100" />
                    </div>
                  ))}
                </div>
              ) : adminUsers.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-12 text-center">
                  <p className="text-[13px] font-medium text-gray-600">Aucun utilisateur trouve</p>
                  <p className="mt-1 text-[12px] text-gray-500">Ajoutez un compte administrateur ou utilisateur pour demarrer.</p>
                  <Button size="sm" onClick={openCreateDialog} className="mt-4 h-8 rounded-lg bg-sky-600 px-3 text-[12px] hover:bg-sky-700">
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Ajouter un utilisateur
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="overflow-hidden rounded-xl border border-gray-200">
                    <Table className="min-w-[860px]">
                      <TableHeader>
                        <TableRow className="bg-gradient-to-r from-sky-50 to-white hover:bg-gradient-to-r hover:from-sky-50 hover:to-white">
                          <TableHead className="px-4 text-[11px] uppercase tracking-[0.08em] text-gray-500">Utilisateur</TableHead>
                          <TableHead className="px-3 text-[11px] uppercase tracking-[0.08em] text-gray-500">Role</TableHead>
                          <TableHead className="px-3 text-[11px] uppercase tracking-[0.08em] text-gray-500">Statut</TableHead>
                          <TableHead className="px-3 text-[11px] uppercase tracking-[0.08em] text-gray-500">Derniere connexion</TableHead>
                          <TableHead className="px-3 text-right text-[11px] uppercase tracking-[0.08em] text-gray-500">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedUsers.map((member, index) => {
                          const isSelf = member.id === user?.id;
                          return (
                            <TableRow
                              key={member.id}
                              className={cn(
                                "transition-colors hover:bg-sky-50/50",
                                index % 2 === 0 ? "bg-white" : "bg-gray-50/40",
                              )}
                            >
                              <TableCell className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-sky-100 bg-sky-50 text-[12px] font-semibold text-sky-700">
                                    {(member.full_name ?? member.email).trim().charAt(0).toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="truncate text-[13px] font-semibold text-gray-900">{member.email}</p>
                                    <p className="truncate text-[12px] text-gray-500">{member.full_name ?? "Nom non renseigne"}</p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="px-3 py-3">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "border px-2.5 py-0.5 text-[10px] font-semibold",
                                    member.role === "ADMIN" && "border-violet-200 bg-violet-50 text-violet-700",
                                    member.role === "USER" && "border-sky-200 bg-sky-50 text-sky-700",
                                    member.role === "CUSTOM" && "border-amber-200 bg-amber-50 text-amber-700",
                                  )}
                                >
                                  {ROLE_LABELS[member.role]}
                                </Badge>
                              </TableCell>
                              <TableCell className="px-3 py-3">
                                <div className="flex flex-wrap gap-1.5">
                                  <span
                                    className={cn(
                                      "rounded-full px-2.5 py-0.5 text-[10px] font-semibold",
                                      member.is_active ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700",
                                    )}
                                  >
                                    {member.is_active ? "Actif" : "Inactif"}
                                  </span>
                                  <span
                                    className={cn(
                                      "rounded-full px-2.5 py-0.5 text-[10px] font-semibold",
                                      member.is_verified ? "bg-sky-50 text-sky-700" : "bg-amber-50 text-amber-700",
                                    )}
                                  >
                                    {member.is_verified ? "Verifie" : "A verifier"}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="px-3 py-3 text-[12px] text-gray-600">{formatDate(member.last_login_at)}</TableCell>
                              <TableCell className="px-3 py-3">
                                <div className="flex justify-end gap-2">
                                  <ActionIconButton
                                    label="Modifier"
                                    icon={PencilLine}
                                    tone="edit"
                                    onClick={() => openEditDialog(member)}
                                  />
                                  <ActionIconButton
                                    label={isSelf ? "Suppression indisponible" : "Supprimer"}
                                    icon={Trash2}
                                    tone="delete"
                                    disabled={isSelf}
                                    onClick={() => setDeletingUser(member)}
                                  />
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex flex-col gap-2 rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2.5 md:flex-row md:items-center md:justify-between">
                    <p className="text-[12px] text-gray-600">
                      Affichage <span className="font-semibold text-gray-800">{firstVisible}</span>-<span className="font-semibold text-gray-800">{lastVisible}</span> sur <span className="font-semibold text-gray-800">{adminUsers.length}</span>
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage((previous) => Math.max(1, previous - 1))}
                        className="h-8 rounded-lg border-gray-200 px-3 text-[12px]"
                      >
                        <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                        Precedent
                      </Button>
                      <span className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-600">
                        Page {currentPage}/{totalPages}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage((previous) => Math.min(totalPages, previous + 1))}
                        className="h-8 rounded-lg border-gray-200 px-3 text-[12px]"
                      >
                        Suivant
                        <ChevronRight className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={(open) => (!open ? closeDialog() : setIsDialogOpen(true))}>
        <DialogContent className="max-w-2xl rounded-xl border-gray-200 p-0">
          <DialogHeader className="border-b border-gray-100 px-6 py-4">
            <DialogTitle className="text-[16px] text-gray-900">
              {editingUser ? "Modifier utilisateur" : "Creer un utilisateur"}
            </DialogTitle>
            <DialogDescription className="text-[13px] text-gray-500">
              {editingUser
                ? "Mettez a jour les informations du compte puis enregistrez."
                : "Renseignez les informations minimales pour creer un nouveau compte."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(event) => void handleSaveUser(event)} className="space-y-4 px-6 py-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="admin-user-email" className="text-[12px] text-gray-700">Email</Label>
                <Input
                  id="admin-user-email"
                  type="email"
                  value={form.email}
                  onChange={(event) => updateForm("email", event.target.value)}
                  placeholder="utilisateur@lexia.local"
                  required
                  className="h-9 border-gray-200 text-[13px]"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="admin-user-full-name" className="text-[12px] text-gray-700">Nom complet</Label>
                <Input
                  id="admin-user-full-name"
                  value={form.full_name}
                  onChange={(event) => updateForm("full_name", event.target.value)}
                  placeholder="Nom et prenom"
                  className="h-9 border-gray-200 text-[13px]"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[12px] text-gray-700">Role</Label>
                <Select value={form.role} onValueChange={(value) => updateForm("role", value as Role)}>
                  <SelectTrigger className="h-9 border-gray-200 text-[13px]">
                    <SelectValue placeholder="Selectionnez un role" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((role) => (
                      <SelectItem key={role} value={role} className="text-[13px]">
                        {ROLE_LABELS[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[12px] text-gray-700">Compte actif</Label>
                <Select value={form.is_active} onValueChange={(value) => updateForm("is_active", value as "true" | "false")}>
                  <SelectTrigger className="h-9 border-gray-200 text-[13px]">
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true" className="text-[13px]">Actif</SelectItem>
                    <SelectItem value="false" className="text-[13px]">Inactif</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[12px] text-gray-700">Email verifie</Label>
                <Select value={form.is_verified} onValueChange={(value) => updateForm("is_verified", value as "true" | "false")}>
                  <SelectTrigger className="h-9 border-gray-200 text-[13px]">
                    <SelectValue placeholder="Verification" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true" className="text-[13px]">Verifie</SelectItem>
                    <SelectItem value="false" className="text-[13px]">A verifier</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="admin-user-password" className="text-[12px] text-gray-700">
                  {editingUser ? "Nouveau mot de passe" : "Mot de passe"}
                </Label>
                <Input
                  id="admin-user-password"
                  type="password"
                  value={form.password}
                  onChange={(event) => updateForm("password", event.target.value)}
                  placeholder={editingUser ? "Laisser vide pour conserver" : "Mot de passe fort"}
                  required={!editingUser}
                  className="h-9 border-gray-200 text-[13px]"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="admin-user-confirm-password" className="text-[12px] text-gray-700">Confirmation</Label>
                <Input
                  id="admin-user-confirm-password"
                  type="password"
                  value={form.confirm_password}
                  onChange={(event) => updateForm("confirm_password", event.target.value)}
                  placeholder={editingUser ? "Confirmer si modifie" : "Confirmer le mot de passe"}
                  required={!editingUser}
                  className="h-9 border-gray-200 text-[13px]"
                />
              </div>
            </div>

            <DialogFooter className="border-t border-gray-100 pt-4">
              <Button type="button" variant="outline" onClick={closeDialog} className="h-8 rounded-lg border-gray-200 text-[12px]">
                Annuler
              </Button>
              <Button type="submit" disabled={isSaving} className="h-8 rounded-lg bg-sky-600 px-3 text-[12px] hover:bg-sky-700">
                {isSaving
                  ? "Enregistrement..."
                  : editingUser
                  ? "Enregistrer modifications"
                  : "Creer utilisateur"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deletingUser)}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeletingUser(null);
        }}
      >
        <AlertDialogContent className="rounded-xl border-gray-200">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet utilisateur ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irreversible. Le compte <span className="font-semibold">{deletingUser?.email}</span> sera definitivement supprime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDeleteUser()}
              disabled={isDeleting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {isDeleting ? "Suppression..." : "Oui, supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
