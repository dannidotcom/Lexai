import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { ClipboardCheck, KeyRound, LockKeyhole, MonitorSmartphone, ShieldCheck } from "lucide-react";
import { AiBackdrop, AiBadge, AiTerminal, AiThinkingIndicator } from "@/features/auth/components/ai-platform-ui";

const featureCards = [
  { label: "Jetons sécurisés", detail: "Access court + refresh rotatif", icon: KeyRound },
  { label: "Sessions maîtrisées", detail: "Révocation par appareil", icon: MonitorSmartphone },
  { label: "Journal sécurité", detail: "Actions sensibles tracées", icon: ClipboardCheck },
];

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-white text-slate-950">
      <AiBackdrop />

      <div className="relative mx-auto grid min-h-screen max-w-6xl grid-cols-1 items-center gap-10 px-5 py-8 md:grid-cols-[1fr_430px]">
        <motion.section
          className="space-y-8"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
        >
          <AiBadge icon={ShieldCheck}>Portail d’authentification entreprise</AiBadge>

          <div className="max-w-2xl space-y-4">
            <h1 className="text-4xl font-semibold tracking-normal text-slate-950 md:text-6xl">{title}</h1>
            <p className="text-base leading-7 text-slate-600 md:text-lg">{subtitle}</p>
          </div>

          <div className="grid max-w-xl grid-cols-1 gap-3 text-sm text-slate-700 sm:grid-cols-3">
            {featureCards.map(({ label, detail, icon: Icon }, index) => (
              <motion.div
                key={label}
                className="rounded-lg border border-sky-100 bg-white/80 px-4 py-4 shadow-sm backdrop-blur"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 + index * 0.08, duration: 0.45 }}
              >
                <Icon className="mb-3 h-4 w-4 text-sky-500" />
                <span className="block font-medium text-slate-950">{label}</span>
                <span className="mt-1 block text-xs text-slate-500">{detail}</span>
              </motion.div>
            ))}
          </div>

          <motion.div
            className="max-w-xl rounded-lg border border-sky-100 bg-white/75 p-4 shadow-sm backdrop-blur"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.38, duration: 0.5 }}
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-950">Contrôle de session</p>
                <p className="text-xs text-slate-500">Utilisateur, appareil et rôle vérifiés</p>
              </div>
              <AiThinkingIndicator label="Policy check" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {["Identité", "Session", "Accès"].map((item) => (
                <div key={item} className="rounded-md bg-sky-50 px-3 py-2 text-center text-xs font-medium text-sky-700">
                  {item}
                </div>
              ))}
            </div>
          </motion.div>
          <AiTerminal lines={["policy.rbac=enabled", "session.rotation=required", "audit.security=recording"]} />
        </motion.section>

        <motion.section
          className="rounded-lg border border-sky-100 bg-white/90 p-5 text-slate-950 shadow-2xl shadow-sky-200/50 backdrop-blur-xl md:p-6"
          initial={{ opacity: 0, x: 24, scale: 0.98 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
        >
          {children}
        </motion.section>
      </div>
    </main>
  );
}
