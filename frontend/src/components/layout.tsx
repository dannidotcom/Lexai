import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  Scale, MessageSquare, Database, Search, Settings,
  Upload, Menu, X, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useHealthCheck } from "@workspace/api-client-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const STORAGE_KEY = "lexia-sidebar-collapsed";

const navigation = [
  { name: "Dashboard",    href: "/",                 icon: Scale,         section: "main" },
  { name: "Chat Engine",  href: "/chat",             icon: MessageSquare, section: "main" },
  { name: "Bibliothèque", href: "/documents",        icon: Database,      section: "main" },
  { name: "Importer",     href: "/documents/ingest", icon: Upload,        section: "main" },
  { name: "Recherche",    href: "/search",           icon: Search,        section: "bottom" },
  { name: "Paramètres",   href: "/settings",         icon: Settings,      section: "bottom" },
];

const mainNav    = navigation.filter(n => n.section === "main");
const bottomNav  = navigation.filter(n => n.section === "bottom");

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

  const NavItem = ({ item }: { item: typeof navigation[number] }) => {
    const active = isActive(item.href);
    const Icon = item.icon;

    const inner = (
      <Link
        href={item.href}
        className={cn(
          "group flex items-center rounded-full transition-all duration-150 select-none outline-none",
          collapsed
            ? "justify-center w-9 h-9 mx-auto"
            : "gap-3 px-3 py-2 w-full",
          active
            ? "bg-sidebar-primary/15 text-sidebar-primary"
            : "text-sidebar-muted-foreground hover:bg-white/[0.06] hover:text-sidebar-foreground",
        )}
      >
        <Icon className={cn(
          "flex-shrink-0",
          collapsed ? "w-[18px] h-[18px]" : "w-[17px] h-[17px]",
          active ? "text-sidebar-primary" : "text-sidebar-muted-foreground group-hover:text-sidebar-foreground",
        )} />
        {!collapsed && (
          <span className={cn(
            "text-[13px] font-medium leading-none truncate",
            active ? "text-sidebar-primary" : "",
          )}>
            {item.name}
          </span>
        )}
        {!collapsed && active && (
          <ChevronRight className="w-3 h-3 ml-auto flex-shrink-0 text-sidebar-primary/60" />
        )}
      </Link>
    );

    return (
      <div key={item.href}>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>{inner}</TooltipTrigger>
            <TooltipContent side="right" sideOffset={10}
              className="text-[12px] font-medium bg-gray-900 text-gray-100 border-gray-700">
              {item.name}
            </TooltipContent>
          </Tooltip>
        ) : inner}
      </div>
    );
  };

  return (
    <TooltipProvider delayDuration={200}>
      {/* ── Root: no dark class — main content is LIGHT ── */}
      <div className="flex h-screen overflow-hidden bg-background text-foreground">

        {/* ── SIDEBAR: explicitly dark ── */}
        <aside
          className={cn(
            "dark relative flex flex-col flex-shrink-0 overflow-hidden",
            "transition-[width] duration-200 ease-in-out",
            collapsed ? "w-[60px]" : "w-[216px]",
          )}
          style={{ background: "hsl(var(--sidebar))", borderRight: "1px solid hsl(var(--sidebar-border))" }}
        >
          {/* Brand row */}
          <div className={cn(
            "flex items-center h-[56px] flex-shrink-0",
            collapsed ? "justify-center px-0" : "px-3 gap-2",
          )}>
            {!collapsed && (
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-sidebar-primary flex items-center justify-center flex-shrink-0">
                  <Scale className="w-4 h-4 text-sidebar-primary-foreground" />
                </div>
                <div className="min-w-0 leading-none">
                  <span className="text-[14px] font-semibold text-sidebar-foreground tracking-tight">LexIA</span>
                </div>
              </div>
            )}
            <button
              onClick={() => setCollapsed(c => !c)}
              aria-label="Toggle sidebar"
              className={cn(
                "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                "text-sidebar-muted-foreground hover:text-sidebar-foreground hover:bg-white/[0.07]",
                "transition-colors duration-150",
                collapsed && "mx-auto",
              )}
            >
              {collapsed
                ? <Menu className="w-4 h-4" />
                : <X className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Main nav */}
          <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-1 space-y-0.5">
            {mainNav.map(item => <NavItem key={item.href} item={item} />)}
          </nav>

          {/* Bottom nav */}
          <div className="flex-shrink-0 px-2 pb-3 space-y-0.5">
            <div className="h-px mx-1 mb-2" style={{ background: "hsl(var(--sidebar-border))" }} />
            {bottomNav.map(item => <NavItem key={item.href} item={item} />)}

            {/* System status */}
            <div className={cn(
              "flex items-center mt-1.5 px-3 py-2 rounded-full",
              collapsed && "justify-center px-0",
            )}>
              <div className="relative flex-shrink-0">
                <div className="w-5 h-5 rounded-full bg-sidebar-muted flex items-center justify-center">
                  <span className="text-[8px] font-bold text-sidebar-foreground uppercase">
                    {isOk ? "✓" : "!"}
                  </span>
                </div>
                <div className={cn(
                  "absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-sidebar",
                  isOk ? "bg-emerald-400" : "bg-red-400",
                )} />
              </div>
              {!collapsed && (
                <div className="ml-2.5 min-w-0 flex-1">
                  <p className="text-[12px] text-sidebar-foreground font-medium truncate leading-none">Système</p>
                  <p className={cn(
                    "text-[10px] mt-0.5 font-mono",
                    isOk ? "text-emerald-400" : "text-red-400",
                  )}>
                    {isOk ? "En ligne" : "Hors ligne"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* ── MAIN: light theme ── */}
        <main className="flex-1 flex flex-col overflow-hidden min-w-0 bg-background">
          {children}
        </main>
      </div>
    </TooltipProvider>
  );
}
