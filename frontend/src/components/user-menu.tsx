import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronsUpDown, LogOut, Settings, ShieldCheck, SlidersHorizontal, UserCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiError, authApi } from "@/features/auth/api";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

function getInitials(name: string | null | undefined, email: string | undefined): string {
  const source = (name?.trim() || email || "U").trim();
  if (!source) return "U";

  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function UserMenu({ className }: { className?: string }) {
  const navigate = useNavigate();
  const { user, clearSession } = useAuthStore();

  const displayName = user?.full_name?.trim() || user?.email || "Utilisateur";
  const roleLabel = user?.role === "ADMIN" ? "Admin" : "User";
  const initials = useMemo(() => getInitials(user?.full_name, user?.email), [user?.full_name, user?.email]);

  if (!user) return null;

  async function handleLogout() {
    try {
      await authApi.post("/auth/logout");
    } catch (error) {
      toast.error(apiError(error));
    } finally {
      clearSession();
      navigate("/login", { replace: true });
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 shadow-sm",
            "transition-colors hover:border-sky-200 hover:bg-sky-50/40",
            className,
          )}
        >
          <Avatar className="h-7 w-7 border border-sky-200">
            <AvatarFallback className="bg-sky-100 text-[11px] font-semibold text-sky-700">{initials}</AvatarFallback>
          </Avatar>
          <div className="hidden text-left md:block">
            <p className="max-w-[170px] truncate text-[12px] font-semibold text-gray-800">{displayName}</p>
            <p className="text-[10px] text-gray-500">{roleLabel}</p>
          </div>
          <ChevronsUpDown className="h-3.5 w-3.5 text-gray-400" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72 rounded-xl border-gray-200 p-1.5">
        <DropdownMenuLabel className="px-2 py-2">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9 border border-sky-200">
              <AvatarFallback className="bg-sky-100 text-xs font-semibold text-sky-700">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-gray-900">{displayName}</p>
              <p className="truncate text-[11px] text-gray-500">{user.email}</p>
            </div>
            <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
              {roleLabel}
            </span>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => navigate("/profile")} className="cursor-pointer rounded-lg">
          <UserCircle2 className="h-4 w-4" />
          Voir le profil
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => navigate("/settings")} className="cursor-pointer rounded-lg">
          <Settings className="h-4 w-4" />
          Parametres
        </DropdownMenuItem>

        {user.role === "ADMIN" && (
          <>
            <DropdownMenuItem onClick={() => navigate("/admin/users")} className="cursor-pointer rounded-lg">
              <ShieldCheck className="h-4 w-4" />
              Espace admin
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/admin/prompts")} className="cursor-pointer rounded-lg">
              <SlidersHorizontal className="h-4 w-4" />
              Parametrage prompts
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => void handleLogout()}
          className="cursor-pointer rounded-lg text-red-600 focus:bg-red-50 focus:text-red-600"
        >
          <LogOut className="h-4 w-4" />
          Se deconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
