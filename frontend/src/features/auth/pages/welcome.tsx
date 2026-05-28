import { motion } from "framer-motion";
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Cpu,
  Database,
  FileSearch,
  LockKeyhole,
  MessageSquareText,
  Network,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  AiBackdrop,
  AiBadge,
  AiTerminal,
  AiThinkingIndicator,
  WorkflowCard,
} from "@/features/auth/components/ai-platform-ui";

const pipeline = [
  { label: "Question", icon: MessageSquareText },
  { label: "Retrieval", icon: FileSearch },
  { label: "Contexte", icon: Database },
  { label: "Réponse", icon: BrainCircuit },
];

const metrics = [
  { value: "12 ms", label: "Contrôle d’accès" },
  { value: "99.9%", label: "Session control" },
  { value: "RAG", label: "Agent ready" },
];

export default function WelcomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-white text-slate-950">
      <AiBackdrop />

      <section className="relative mx-auto grid min-h-screen max-w-7xl grid-cols-1 items-center gap-10 px-5 py-8 lg:grid-cols-[1fr_520px]">
        <motion.div
          className="max-w-3xl space-y-7"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
        >
          <AiBadge icon={Sparkles}>Plateforme IA Agent RAG sécurisée</AiBadge>

          <div className="space-y-5">
            <h1 className="max-w-3xl text-5xl font-semibold tracking-normal text-slate-950 md:text-7xl">
              LexIA Agent RAG
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-slate-600">
              Une interface professionnelle pour piloter un agent IA connecté à vos sources, avec authentification robuste,
              sessions sécurisées et accès administrateur maîtrisé.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="shadow-lg shadow-sky-200">
              <Link to="/login">
                Lancer l’espace IA <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link to="/register">Créer un compte</Link>
            </Button>
            <AiThinkingIndicator label="Agent orchestration online" />
          </div>

          <div className="grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
            {metrics.map((metric, index) => (
              <motion.div
                key={metric.label}
                className="rounded-lg border border-sky-100 bg-white/80 p-4 shadow-sm backdrop-blur"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18 + index * 0.08, duration: 0.45 }}
              >
                <p className="text-2xl font-semibold text-slate-950">{metric.value}</p>
                <p className="mt-1 text-sm text-slate-500">{metric.label}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          className="relative"
          initial={{ opacity: 0, x: 28, scale: 0.98 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ duration: 0.65, ease: "easeOut" }}
        >
          <div className="rounded-lg border border-sky-100 bg-white/90 p-5 shadow-2xl shadow-sky-200/60 backdrop-blur-xl">
            <div className="mb-5 flex items-center justify-between border-b border-sky-100 pb-4">
              <div>
                <p className="text-sm font-medium text-sky-600">Agent workspace</p>
                <h2 className="text-2xl font-semibold text-slate-950">Analyse RAG en cours</h2>
              </div>
              <div className="rounded-lg bg-slate-950 p-3 text-white">
                <BrainCircuit className="h-6 w-6 text-sky-300" />
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg border border-sky-100 bg-sky-50/70 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-900">
                  <MessageSquareText className="h-4 w-4 text-sky-600" />
                  Requête utilisateur
                </div>
                <p className="text-sm leading-6 text-slate-600">
                  “Résume les obligations principales et cite les passages juridiques pertinents.”
                </p>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {pipeline.map(({ label, icon: Icon }, index) => (
                  <motion.div
                    key={label}
                    className="rounded-lg border border-sky-100 bg-white p-3 text-center shadow-sm"
                    animate={{ y: [0, -3, 0] }}
                    transition={{ duration: 2.2, delay: index * 0.18, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <Icon className="mx-auto mb-2 h-4 w-4 text-sky-600" />
                    <p className="text-xs font-medium text-slate-700">{label}</p>
                  </motion.div>
                ))}
              </div>

              <AiTerminal lines={["embedding.index loaded", "retriever.rerank latency=42ms", "citations.guardrail enabled"]} />

              <div className="rounded-lg bg-slate-950 p-4 text-white">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Network className="h-4 w-4 text-sky-300" />
                    Context graph
                  </div>
                  <span className="rounded-full bg-sky-400/15 px-3 py-1 text-xs text-sky-200">secured</span>
                </div>
                <div className="space-y-2">
                  {["Document officiel indexé", "Chunks classés par pertinence", "Réponse auditée et traçable"].map((item) => (
                    <div key={item} className="flex items-center gap-2 rounded-md bg-white/8 px-3 py-2 text-sm text-slate-100">
                      <CheckCircle2 className="h-4 w-4 text-sky-300" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Accès", icon: LockKeyhole },
                  { label: "Sources", icon: Database },
                  { label: "Admin", icon: ShieldCheck },
                ].map(({ label, icon: Icon }) => (
                  <div key={label} className="rounded-lg border border-sky-100 bg-white p-3">
                    <Icon className="mb-2 h-4 w-4 text-sky-600" />
                    <p className="text-sm font-medium text-slate-900">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        <div className="col-span-full grid grid-cols-1 gap-3 md:grid-cols-3">
          {[
            { title: "Recherche sémantique", text: "Connexion directe avec vos sources RAG et citations exploitables.", icon: FileSearch },
            { title: "Sécurité session", text: "Cookies HTTPOnly, refresh rotation et révocation contrôlée.", icon: LockKeyhole },
            { title: "Pilotage admin", text: "Gestion utilisateurs, rôles et audit logs pour la production.", icon: Cpu },
          ].map(({ title, text, icon: Icon }) => (
            <WorkflowCard key={title} title={title} detail={text} icon={Icon} />
          ))}
        </div>
      </section>
    </main>
  );
}
