import type { ReactNode } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Bot,
  BrainCircuit,
  Database,
  Gauge,
  GitBranch,
  LayoutDashboard,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const particles = [
  { left: "8%", top: "18%", delay: 0 },
  { left: "18%", top: "72%", delay: 0.8 },
  { left: "42%", top: "12%", delay: 1.4 },
  { left: "58%", top: "78%", delay: 0.3 },
  { left: "76%", top: "22%", delay: 1.1 },
  { left: "88%", top: "62%", delay: 0.6 },
];

export function AiBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,#ffffff_0%,#effaff_42%,#ffffff_100%)]" />
      <div className="absolute inset-0 opacity-[0.42] [background-image:linear-gradient(rgba(14,165,233,.15)_1px,transparent_1px),linear-gradient(90deg,rgba(14,165,233,.15)_1px,transparent_1px)] [background-size:44px_44px]" />
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(56,189,248,.34),transparent_28%),radial-gradient(circle_at_82%_70%,rgba(34,211,238,.22),transparent_30%)]"
        animate={{ opacity: [0.55, 0.9, 0.55] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      />
      <svg className="absolute inset-0 h-full w-full opacity-40" aria-hidden="true">
        <motion.path
          d="M80 160 C260 60, 330 260, 510 160 S820 60, 980 210"
          fill="none"
          stroke="url(#ai-line)"
          strokeWidth="1"
          strokeDasharray="8 10"
          animate={{ pathLength: [0.2, 1, 0.2] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.path
          d="M120 620 C300 460, 420 680, 610 520 S860 420, 1050 570"
          fill="none"
          stroke="url(#ai-line)"
          strokeWidth="1"
          strokeDasharray="7 12"
          animate={{ pathLength: [1, 0.25, 1] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        />
        <defs>
          <linearGradient id="ai-line" x1="0" x2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0" />
            <stop offset="45%" stopColor="#06b6d4" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      {particles.map((particle) => (
        <motion.span
          key={`${particle.left}-${particle.top}`}
          className="absolute h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_18px_rgba(34,211,238,.9)]"
          style={{ left: particle.left, top: particle.top }}
          animate={{ y: [0, -14, 0], opacity: [0.25, 1, 0.25], scale: [1, 1.45, 1] }}
          transition={{ duration: 4.5, delay: particle.delay, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

export function AiBadge({ children, icon: Icon = Sparkles }: { children: ReactNode; icon?: typeof Sparkles }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/85 px-4 py-2 text-sm font-medium text-slate-900 shadow-sm shadow-sky-100 backdrop-blur">
      <Icon className="h-4 w-4 text-sky-500" />
      {children}
    </div>
  );
}

export function AiThinkingIndicator({ label = "AI thinking" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50/80 px-3 py-2 text-xs font-medium text-sky-700">
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-60" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-sky-500" />
      </span>
      {label}
    </div>
  );
}

export function AiTerminal({ lines }: { lines: string[] }) {
  return (
    <div className="rounded-lg bg-slate-950 p-4 text-white shadow-xl shadow-sky-200/40">
      <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        </div>
        <span className="text-xs text-sky-200">orchestration.log</span>
      </div>
      <div className="space-y-2 font-mono text-xs text-slate-200">
        {lines.map((line, index) => (
          <motion.p
            key={line}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.12, duration: 0.35 }}
          >
            <span className="text-cyan-300">&gt;</span> {line}
          </motion.p>
        ))}
      </div>
    </div>
  );
}

export function AiSidebar() {
  const location = useLocation();
  const items = [
    { label: "Workspace", path: "/dashboard", icon: LayoutDashboard },
    { label: "Agents", path: "/dashboard", icon: Bot },
    { label: "Knowledge", path: "/dashboard", icon: Database },
    { label: "Admin", path: "/admin/users", icon: ShieldCheck },
  ];

  return (
    <aside className="rounded-lg border border-white/10 bg-slate-950 p-3 text-white shadow-2xl shadow-sky-200/40 lg:min-h-[calc(100vh-2.5rem)]">
      <div className="mb-5 flex items-center gap-3 rounded-lg border border-white/10 bg-white/8 p-3">
        <div className="rounded-md bg-sky-400/15 p-2">
          <BrainCircuit className="h-5 w-5 text-sky-300" />
        </div>
        <div>
          <p className="font-semibold">LexIA</p>
          <p className="text-xs text-slate-400">AI Agent Platform</p>
        </div>
      </div>

      <nav className="space-y-1">
        {items.map(({ label, path, icon: Icon }) => {
          const active = location.pathname === path;
          return (
            <Link
              key={label}
              to={path}
              className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition ${
                active ? "bg-sky-400/15 text-sky-100 shadow-[inset_0_0_0_1px_rgba(125,211,252,.25)]" : "text-slate-300 hover:bg-white/8 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-cyan-100">Runtime</span>
          <Activity className="h-4 w-4 text-cyan-300" />
        </div>
        <div className="h-1.5 rounded-full bg-white/10">
          <motion.div
            className="h-1.5 rounded-full bg-cyan-300"
            animate={{ width: ["48%", "82%", "62%", "90%"] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      </div>
    </aside>
  );
}

export function WorkflowCard({ title, detail, icon: Icon = GitBranch }: { title: string; detail: string; icon?: typeof GitBranch }) {
  return (
    <motion.div
      className="group rounded-lg border border-sky-100 bg-white/85 p-4 shadow-sm backdrop-blur transition hover:-translate-y-1 hover:border-sky-200 hover:shadow-xl hover:shadow-sky-100/80"
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
    >
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50 text-sky-600 group-hover:bg-sky-500 group-hover:text-white">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="font-semibold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">{detail}</p>
    </motion.div>
  );
}

export function MonitoringCard({ value, label, icon: Icon = Gauge }: { value: string | number; label: string; icon?: typeof Gauge }) {
  return (
    <motion.div
      className="rounded-lg border border-sky-100 bg-white/85 p-5 shadow-sm backdrop-blur"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.4 }}
    >
      <Icon className="mb-4 h-5 w-5 text-sky-600" />
      <p className="text-2xl font-semibold text-slate-950">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
    </motion.div>
  );
}
