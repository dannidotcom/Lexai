import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, Mail, ShieldCheck, User2, UserCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

function formatDate(value: string | undefined): string {
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

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const displayName = user?.full_name?.trim() || user?.email || "Utilisateur";
  const roleLabel = user?.role === "ADMIN" ? "Admin" : "User";
  const statusLabel = user?.is_active ? "Compte actif" : "Compte inactif";
  const verificationLabel = user?.is_verified ? "Email vérifié" : "Email à vérifier";

  const headerGradient = useMemo(
    () => (user?.role === "ADMIN" ? "from-sky-600 to-indigo-700" : "from-sky-500 to-cyan-600"),
    [user?.role],
  );

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50">
      <div className="page-header flex items-center justify-between bg-white/85 px-8 py-5">
        <div>
          <h1 className="text-[20px] font-semibold leading-none text-gray-900">Mon profil</h1>
          <p className="mt-1.5 text-[13px] text-gray-500">Informations de compte et sécurité de session</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")} className="h-8 rounded-lg border-gray-200 text-[12px]">
          Retour dashboard
        </Button>
      </div>

      <div className="space-y-5 px-8 py-6">
        <section className={cn("rounded-2xl bg-gradient-to-r p-6 text-white shadow-lg", headerGradient)}>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20">
              <UserCircle2 className="h-8 w-8" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-2xl font-semibold">{displayName}</h2>
              <p className="truncate text-sm text-white/90">{user?.email}</p>
            </div>
            <div className="flex gap-2">
              <span className="rounded-full border border-white/30 bg-white/15 px-3 py-1 text-xs font-semibold">{roleLabel}</span>
              <span className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold",
                user?.is_verified ? "border-emerald-200/60 bg-emerald-500/20" : "border-amber-200/60 bg-amber-500/20",
              )}>
                {verificationLabel}
              </span>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500">Informations utilisateur</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/50 px-3 py-2.5">
                <div className="flex items-center gap-2 text-[12px] text-gray-600"><User2 className="h-3.5 w-3.5 text-sky-500" />Nom</div>
                <span className="text-[12px] font-medium text-gray-900">{displayName}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/50 px-3 py-2.5">
                <div className="flex items-center gap-2 text-[12px] text-gray-600"><Mail className="h-3.5 w-3.5 text-sky-500" />Email</div>
                <span className="max-w-[60%] truncate text-[12px] font-medium text-gray-900">{user?.email ?? "-"}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/50 px-3 py-2.5">
                <div className="flex items-center gap-2 text-[12px] text-gray-600"><ShieldCheck className="h-3.5 w-3.5 text-sky-500" />Rôle</div>
                <span className="text-[12px] font-medium text-gray-900">{roleLabel}</span>
              </div>
            </div>
          </article>

          <article className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500">Sécurité compte</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/50 px-3 py-2.5">
                <span className="text-[12px] text-gray-600">Statut du compte</span>
                <span className={cn(
                  "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                  user?.is_active ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700",
                )}>
                  {statusLabel}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/50 px-3 py-2.5">
                <span className="text-[12px] text-gray-600">Vérification email</span>
                <span className={cn(
                  "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                  user?.is_verified ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700",
                )}>
                  {verificationLabel}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/50 px-3 py-2.5">
                <div className="flex items-center gap-2 text-[12px] text-gray-600"><CalendarDays className="h-3.5 w-3.5 text-sky-500" />Créé le</div>
                <span className="text-[12px] font-medium text-gray-900">{formatDate(user?.created_at)}</span>
              </div>
            </div>
          </article>
        </section>

        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => navigate("/settings")} className="h-8 rounded-lg border-gray-200 text-[12px]">
            Ouvrir les paramètres
          </Button>
        </div>
      </div>
    </div>
  );
}
