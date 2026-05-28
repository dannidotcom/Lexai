import { motion } from "framer-motion";
import { Activity, BrainCircuit, Database, FileSearch, LogOut, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiError, authApi } from "@/features/auth/api";
import {
  AiBackdrop,
  AiSidebar,
  AiTerminal,
  AiThinkingIndicator,
  MonitoringCard,
  WorkflowCard,
} from "@/features/auth/components/ai-platform-ui";
import { useAuthStore } from "@/stores/auth-store";

const agentSteps = [
  "Authentification session",
  "Lecture du contexte utilisateur",
  "Recherche vectorielle prête",
  "Réponse agent sécurisée",
];

export default function AuthDashboardPage() {
  const { user, clearSession } = useAuthStore();

  async function logout() {
    try {
      await authApi.post("/auth/logout");
    } catch (error) {
      toast.error(apiError(error));
    } finally {
      clearSession();
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-white p-5 text-slate-950">
      <AiBackdrop />
      <section className="relative mx-auto grid max-w-7xl grid-cols-1 gap-5 lg:grid-cols-[260px_1fr]">
        <AiSidebar />
        <div className="space-y-5">
        <motion.header
          className="flex flex-col gap-5 rounded-lg border border-sky-100 bg-white/90 p-5 shadow-xl shadow-sky-100/70 backdrop-blur md:flex-row md:items-center md:justify-between"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sm font-medium text-sky-700">
              <BrainCircuit className="h-4 w-4" />
              Agent RAG Workspace
            </div>
            <h1 className="text-3xl font-semibold text-slate-950">Bienvenue {user?.full_name ?? user?.email}</h1>
            <p className="mt-2 text-sm text-slate-500">Votre session est active, vérifiée et prête pour les workflows IA.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <AiThinkingIndicator label="AI processing" />
            <Button onClick={logout} variant="secondary">
              <LogOut className="h-4 w-4" /> Logout
            </Button>
          </div>
        </motion.header>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            { value: "Active", label: "Session", icon: ShieldCheck },
            { value: user?.role ?? "USER", label: "Role", icon: Activity },
            { value: user?.is_verified ? "Verified" : "Pending", label: "Email", icon: Sparkles },
          ].map(({ value, label, icon: Icon }, index) => (
            <MonitoringCard key={label} value={value} label={label} icon={Icon} />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_.9fr]">
          <motion.div
            className="rounded-lg border border-sky-100 bg-white/90 p-5 shadow-sm backdrop-blur"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.45 }}
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-sky-600">Pipeline RAG</p>
                <h2 className="text-xl font-semibold text-slate-950">Préparation de réponse agent</h2>
              </div>
              <FileSearch className="h-6 w-6 text-sky-600" />
            </div>
            <div className="space-y-3">
              {agentSteps.map((step, index) => (
                <div key={step} className="flex items-center gap-3 rounded-lg border border-sky-100 bg-sky-50/60 p-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white text-sm font-semibold text-sky-700 shadow-sm">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900">{step}</p>
                    <div className="mt-2 h-1.5 rounded-full bg-sky-100">
                      <motion.div
                        className="h-1.5 rounded-full bg-sky-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${72 + index * 7}%` }}
                        transition={{ delay: 0.35 + index * 0.12, duration: 0.7 }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            className="rounded-lg bg-slate-950 p-5 text-white shadow-xl shadow-sky-200/50"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24, duration: 0.45 }}
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-sky-200">Knowledge base</p>
                <h2 className="text-xl font-semibold">Sources connectées</h2>
              </div>
              <Database className="h-6 w-6 text-sky-300" />
            </div>
            <div className="space-y-3">
              {["Documents juridiques", "Chunks vectorisés", "Citations contrôlées"].map((item) => (
                <div key={item} className="rounded-lg border border-white/10 bg-white/8 p-4">
                  <p className="font-medium">{item}</p>
                  <p className="mt-1 text-sm text-slate-300">Disponible pour la génération augmentée.</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <WorkflowCard title="Automated retrieval" detail="L’agent sélectionne les chunks pertinents, puis filtre les sources avant génération." icon={FileSearch} />
            <WorkflowCard title="Guardrails actifs" detail="Chaque réponse passe par une couche session, rôle et audit." icon={ShieldCheck} />
            <WorkflowCard title="Agent monitoring" detail="Suivi du runtime, du contexte et des actions de l’agent." icon={Activity} />
          </div>
          <AiTerminal lines={["workflow.run started", "vector.search top_k=5", "answer.stream ready"]} />
        </div>
        </div>
      </section>
    </main>
  );
}
