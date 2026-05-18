import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  Scale, MessageSquare, Database, Search, Settings,
  Upload, PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useHealthCheck } from "@workspace/api-client-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const STORAGE_KEY = "lexia-sidebar-collapsed";

const navigation = [
  { name: "Dashboard",    href: "/",                 icon: Scale         },
  { name: "Chat Engine",  href: "/chat",             icon: MessageSquare },
  { name: "Bibliothèque", href: "/documents",        icon: Database      },
  { name: "Importer",     href: "/documents/ingest", icon: Upload        },
  { name: "Recherche",    href: "/search",           icon: Search        },
  { name: "Paramètres",   href: "/settings",         icon: Settings      },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: health } = useHealthCheck();
  const isOk = health?.status === "ok";

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(STORAGE_KEY) === "true"; } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, String(collapsed)); } catch { /* noop */ }
  }, [collapsed]);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === "[" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setCollapsed(c => !c); }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

  const isActive = (href: string) =>
    href === "/" ? location === "/" : location.startsWith(href);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex h-screen overflow-hidden bg-background text-foreground dark">

        {/* ── Sidebar ───────────────────────────────────── */}
        <aside className={cn(
          "relative flex flex-col flex-shrink-0 overflow-hidden",
          "transition-[width] duration-200 ease-in-out",
          "border-r border-sidebar-border",
          collapsed ? "w-[60px]" : "w-[220px]",
        )} style={{ background: "hsl(var(--sidebar))" }}>

          {/* Subtle top gradient accent */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent pointer-events-none" />

          {/* Brand */}
          <div className={cn(
            "flex items-center flex-shrink-0 h-[56px] px-3",
            !collapsed && "gap-3",
          )}>
            <div className={cn(
              "relative flex-shrink-0 flex items-center justify-center",
              "w-8 h-8 rounded-lg bg-primary glow-blue",
              "shadow-[0_0_0_1px_hsl(221_100%_68%/0.3)]",
              collapsed && "mx-auto",
            )}>
              <Scale className="w-4 h-4 text-white" />
              {isOk && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border-2 border-sidebar" />
              )}
            </div>
            {!collapsed && (
              <div className="min-w-0 leading-none">
                <div className="font-serif font-bold text-[15px] tracking-tight text-sidebar-foreground">LexIA</div>
                <div className="font-mono text-[9px] text-muted-foreground/50 uppercase tracking-[0.12em] mt-0.5">IA Juridique</div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="mx-3 h-px bg-sidebar-border/60" />

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-0.5">
            {navigation.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;

              const inner = (
                <Link
                  href={item.href}
                  className={cn(
                    "group relative flex items-center rounded-lg",
                    "transition-all duration-150 select-none outline-none",
                    collapsed
                      ? "justify-center w-10 h-10 mx-auto"
                      : "gap-2.5 px-2.5 py-2 w-full",
                    active
                      ? [
                          "text-primary",
                          "bg-gradient-to-r from-primary/12 to-primary/5",
                          "shadow-[inset_0_0_0_1px_hsl(221_100%_58%/0.18)]",
                        ]
                      : "text-muted-foreground hover:text-foreground hover:bg-white/[0.05]",
                  )}
                >
                  {/* Left border accent */}
                  {active && !collapsed && (
                    <span className="absolute left-0 inset-y-1.5 w-[3px] rounded-full bg-primary" />
                  )}
                  <Icon className={cn(
                    "flex-shrink-0 transition-colors duration-150",
                    collapsed ? "w-[18px] h-[18px]" : "w-4 h-4",
                    active ? "text-primary" : "text-muted-foreground/70 group-hover:text-foreground",
                  )} />
                  {!collapsed && (
                    <span className={cn(
                      "text-[13px] font-medium truncate leading-none",
                      active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                    )}>
                      {item.name}
                    </span>
                  )}
                </Link>
              );

              return (
                <div key={item.href}>
                  {collapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>{inner}</TooltipTrigger>
                      <TooltipContent side="right" sideOffset={8} className="text-xs font-medium">
                        {item.name}
                      </TooltipContent>
                    </Tooltip>
                  ) : inner}
                </div>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="flex-shrink-0 p-2 space-y-1">
            <div className="mx-1 h-px bg-sidebar-border/60 mb-2" />

            {/* Status pill */}
            {!collapsed ? (
              <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/[0.03]">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    isOk
                      ? "bg-emerald-400 shadow-[0_0_6px_2px_hsl(142_60%_50%/0.5)]"
                      : "bg-red-400 shadow-[0_0_6px_2px_hsl(0_80%_58%/0.5)]",
                  )} />
                  <span className="text-[11px] text-muted-foreground font-medium">Système</span>
                </div>
                <span className={cn(
                  "text-[11px] font-mono font-semibold",
                  isOk ? "text-emerald-400" : "text-red-400",
                )}>
                  {isOk ? "En ligne" : "Hors ligne"}
                </span>
              </div>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={cn(
                    "w-10 h-10 mx-auto rounded-lg flex items-center justify-center",
                    isOk ? "bg-emerald-950/30" : "bg-red-950/30",
                  )}>
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      isOk
                        ? "bg-emerald-400 shadow-[0_0_6px_2px_hsl(142_60%_50%/0.5)]"
                        : "bg-red-400",
                    )} />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8} className="text-xs">
                  {isOk ? "Système en ligne" : "Système hors ligne"}
                </TooltipContent>
              </Tooltip>
            )}

            {/* Toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setCollapsed(c => !c)}
                  aria-label={collapsed ? "Ouvrir le menu" : "Réduire le menu"}
                  className={cn(
                    "flex items-center rounded-lg transition-all duration-150",
                    "text-muted-foreground/40 hover:text-muted-foreground hover:bg-white/[0.05]",
                    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    collapsed ? "justify-center w-10 h-10 mx-auto" : "w-full gap-2 px-2.5 py-2",
                  )}
                >
                  {collapsed
                    ? <PanelLeftOpen className="w-3.5 h-3.5" />
                    : (
                      <>
                        <PanelLeftClose className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="text-[11px] font-medium">Réduire</span>
                        <kbd className="ml-auto text-[9px] font-mono opacity-35">⌘[</kbd>
                      </>
                    )
                  }
                </button>
              </TooltipTrigger>
              {collapsed && (
                <TooltipContent side="right" sideOffset={8} className="text-xs">
                  Ouvrir <kbd className="ml-1 opacity-50">⌘[</kbd>
                </TooltipContent>
              )}
            </Tooltip>
          </div>
        </aside>

        {/* ── Main ──────────────────────────────────────── */}
        <main className="flex-1 flex flex-col overflow-hidden relative min-w-0">
          {children}
        </main>
      </div>
    </TooltipProvider>
  );
}
