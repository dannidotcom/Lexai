import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, Trash2, UserCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiError, authApi, User } from "@/features/auth/api";
import { AiBackdrop, AiSidebar, MonitoringCard } from "@/features/auth/components/ai-platform-ui";

export default function AdminDashboardPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadUsers() {
    setLoading(true);
    try {
      const { data } = await authApi.get<User[]>("/admin/users");
      setUsers(data);
    } catch (error) {
      toast.error(apiError(error));
    } finally {
      setLoading(false);
    }
  }

  async function deleteUser(id: string) {
    try {
      await authApi.delete(`/admin/users/${id}`);
      toast.success("Utilisateur supprimé");
      await loadUsers();
    } catch (error) {
      toast.error(apiError(error));
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  const verifiedCount = users.filter((user) => user.is_verified).length;
  const adminCount = users.filter((user) => user.role === "ADMIN").length;

  return (
    <main className="relative min-h-screen overflow-hidden bg-white p-5 text-slate-950">
      <AiBackdrop />
      <section className="relative mx-auto grid max-w-7xl grid-cols-1 gap-5 lg:grid-cols-[260px_1fr]">
        <AiSidebar />
        <div className="space-y-5">
        <motion.header
          className="rounded-lg border border-sky-100 bg-white/90 p-5 shadow-xl shadow-sky-100/70 backdrop-blur"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sm font-medium text-sky-700">
            <ShieldCheck className="h-4 w-4" />
            Administration sécurisée
          </div>
          <h1 className="flex items-center gap-2 text-3xl font-semibold text-slate-950">
            <Users className="h-7 w-7 text-sky-500" /> Utilisateurs
          </h1>
          <p className="mt-2 text-sm text-slate-500">Gestion des rôles, comptes actifs et accès à la plateforme agent RAG.</p>
        </motion.header>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            { value: users.length, label: "Comptes", icon: Users },
            { value: verifiedCount, label: "Emails vérifiés", icon: UserCheck },
            { value: adminCount, label: "Admins", icon: ShieldCheck },
          ].map(({ value, label, icon: Icon }, index) => (
            <MonitoringCard key={label} value={value} label={label} icon={Icon} />
          ))}
        </div>

        <motion.div
          className="overflow-hidden rounded-lg border border-sky-100 bg-white/90 shadow-sm backdrop-blur"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16, duration: 0.45 }}
        >
          <div className="grid grid-cols-[1.4fr_.7fr_.7fr_auto] gap-3 border-b border-sky-100 bg-sky-50/70 px-4 py-3 text-xs font-semibold uppercase text-slate-500">
            <span>Utilisateur</span>
            <span>Rôle</span>
            <span>Statut</span>
            <span>Action</span>
          </div>
          {loading ? (
            <p className="p-5 text-slate-500">Chargement...</p>
          ) : (
            users.map((user) => (
              <div key={user.id} className="grid grid-cols-[1.4fr_.7fr_.7fr_auto] items-center gap-3 border-b border-sky-100 p-4 last:border-b-0">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-950">{user.email}</p>
                  <p className="truncate text-sm text-slate-500">{user.full_name ?? "Nom non renseigné"}</p>
                </div>
                <span className="w-fit rounded-full bg-slate-950 px-3 py-1 text-xs font-medium text-white">{user.role}</span>
                <span className="w-fit rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
                  {user.is_verified ? "verified" : "pending"}
                </span>
                <Button variant="destructive" size="icon" onClick={() => deleteUser(user.id)} aria-label="Delete user">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </motion.div>
        </div>
      </section>
    </main>
  );
}
