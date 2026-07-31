"use client";

import { createContext, useContext, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  Building2,
  Calendar,
  ChartNoAxesCombined,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  ClipboardEdit,
  ClipboardList,
  Clock,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Menu,
  Newspaper,
  User,
  MessageSquareMore,
  Package,
  Plus,
  Search,
  Settings,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { LanguageProvider, useLanguage } from "@/context/LanguageContext";
import { useAuth, type UserRole } from "@/context/AuthContext";
import { LocationProvider, useLocation } from "@/context/LocationContext";
import { getEmployees, getTasks, getChannels } from "@/lib/supabase";
import type { Employee } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  /** If set, only users with one of these roles see this item. */
  roles?: UserRole[];
};

interface ShellData {
  employees: Employee[];
  unreadChatCount: number;
}

const ShellDataContext = createContext<ShellData>({ employees: [], unreadChatCount: 0 });

/** Reuse employees/unread-count already fetched by the app shell instead of re-fetching per page. */
export function useShellData() {
  return useContext(ShellDataContext);
}

function getPageMeta(pathname: string, lang: "en" | "sv") {
  const copy =
    lang === "sv"
      ? {
          dashboard: ["Dashboard", "Det viktigaste för dagens drift, bemanning och risker."],
          tasks: ["Uppgifter", "Slutför, delegera och följ upp skiftarbete utan extra klick."],
          schedule: ["Schema", "Hantera täckning, konflikter och snabbjusteringar i samma vy."],
          messages: ["Meddelanden", "Operativa kanaler, viktiga notiser och snabba svar."],
          sales: ["Försäljning", "Dagens tempo, timtrender och signaler som påverkar bemanning."],
          ai: ["AI-optimering", "Granska rekommendationer, förstå varför och godkänn direkt."],
          team: ["Team", "Se vem som jobbar, tillgänglighet, roller och uppmärksamhetspunkter."],
          reports: ["Rapporter", "Jämför nyckeltal, uppföljning och exportera arbetsdata."],
          settings: ["Inställningar", "Styr arbetsyta, notiser, AI-regler och butiksinställningar."],
          profile: ["Medarbetarprofil", "Snabb sammanfattning av arbetspass, aktivitet och kontaktvägar."],
          shiftlogs: ["Skiftloggar", "Skiftledare dokumenterar händelser och problem per pass."],
          forms: ["Formulär", "Fyll i och hantera operativa formulär och checklistor."],
        }
      : {
          dashboard: ["Dashboard", "What matters today across operations, staffing, tasks, and risk."],
          tasks: ["Tasks", "Complete, assign, and track shift work without extra navigation."],
          schedule: ["Schedule", "Manage coverage, conflicts, and quick adjustments in one place."],
          messages: ["Messages", "Operational channels, pinned notices, and fast replies."],
          sales: ["Sales & Analytics", "Today’s pace, hourly trends, and staffing signals."],
          ai: ["AI Optimisation", "Review recommendations, understand why, and approve quickly."],
          team: ["Team", "See who is working, available, and needs attention."],
          reports: ["Reports", "Compare key metrics, follow-up outcomes, and export operational data."],
          settings: ["Settings", "Manage workspace defaults, alerts, AI rules, and store setup."],
          profile: ["Team Member", "Quick context on shifts, recent activity, and contact details."],
          shiftlogs: ["Shift Logs", "Shift leaders document events, tasks, and issues each shift."],
          forms: ["Forms", "Fill in and manage operational forms and checklists."],
        };

  if (pathname.startsWith("/employees/")) {
    return { title: copy.profile[0], subtitle: copy.profile[1] };
  }
  if (pathname.startsWith("/logs")) {
    return { title: copy.tasks[0], subtitle: copy.tasks[1] };
  }
  if (pathname.startsWith("/shift-logs")) {
    return { title: copy.shiftlogs[0], subtitle: copy.shiftlogs[1] };
  }
  if (pathname.startsWith("/forms")) {
    return { title: copy.forms[0], subtitle: copy.forms[1] };
  }
  if (pathname.startsWith("/chat")) {
    return { title: copy.messages[0], subtitle: copy.messages[1] };
  }
  if (pathname.startsWith("/sales")) {
    return { title: copy.sales[0], subtitle: copy.sales[1] };
  }
  if (pathname.startsWith("/ai-agent")) {
    return { title: copy.ai[0], subtitle: copy.ai[1] };
  }
  if (pathname.startsWith("/employees")) {
    return { title: copy.team[0], subtitle: copy.team[1] };
  }
  if (pathname.startsWith("/schedule")) {
    return { title: copy.schedule[0], subtitle: copy.schedule[1] };
  }
  if (pathname.startsWith("/reports")) {
    return { title: copy.reports[0], subtitle: copy.reports[1] };
  }
  if (pathname.startsWith("/settings")) {
    return { title: copy.settings[0], subtitle: copy.settings[1] };
  }
  return { title: copy.dashboard[0], subtitle: copy.dashboard[1] };
}


function ShellLayout({ children }: { children: React.ReactNode }) {
  const { lang, setLang } = useLanguage();
  const { user, hasRole, signOut } = useAuth();
  const { locationId, locations, setLocationId } = useLocation();
  const isSuperAdmin = hasRole("super_admin");
  const pathname = usePathname();
  const currentMeta = useMemo(() => getPageMeta(pathname, lang), [lang, pathname]);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [branchOpen, setBranchOpen] = useState(false);
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [openTaskCount, setOpenTaskCount] = useState(0);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [channelCount, setChannelCount] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const isMyTasks = !hasRole("admin", "super_admin");
        const taskFilter = isMyTasks && user?.employeeId
          ? { assigneeId: user.employeeId, createdBy: user.employeeId }
          : undefined;
        const [emps, taskData, channels] = await Promise.all([
          getEmployees(locationId),
          getTasks(locationId, taskFilter),
          getChannels(locationId),
        ]);
        setEmployees(emps);
        setLogs(taskData);
        setOpenTaskCount(taskData.filter((t: any) => t.title && t.status !== "done").length);
        setUnreadChatCount((channels as any[]).reduce((sum, ch) => sum + (ch.unread_count ?? 0), 0));
        setChannelCount(channels.length);
      } catch (error) {
        console.error("[app-shell] Failed to load shell data:", error);
      }
    })();
  }, [user?.employeeId, locationId]); // re-run when user or active branch changes

  const navItems = useMemo<NavItem[]>(
    () =>
      (
        [
          { href: "/", label: lang === "sv" ? "Dashboard" : "Dashboard", icon: LayoutDashboard },
          { href: "/logs", label: lang === "sv" ? "Uppgifter" : "Tasks", icon: CheckSquare, badge: openTaskCount },
          { href: "/shift-logs", label: lang === "sv" ? "Skiftloggar" : "Shift Logs", icon: ClipboardList, roles: ["user_lead", "admin", "super_admin"] },
          { href: "/forms", label: lang === "sv" ? "Formulär" : "Forms", icon: ClipboardEdit, roles: ["user_lead", "admin", "super_admin"] },
          { href: "/schedule", label: lang === "sv" ? "Schema" : "Schedule", icon: Calendar },
          { href: "/chat", label: lang === "sv" ? "Meddelanden" : "Messages", icon: MessageSquareMore, badge: unreadChatCount },
          { href: "/feed", label: lang === "sv" ? "Flöde" : "Feed", icon: Newspaper },
          { href: "/sales", label: lang === "sv" ? "Försäljning" : "Sales", icon: ChartNoAxesCombined, roles: ["user_lead", "admin", "super_admin"] },
          { href: "/inventory", label: lang === "sv" ? "Lager" : "Inventory", icon: Package, roles: ["user_lead", "admin", "super_admin"] },
          { href: "/reports", label: lang === "sv" ? "Rapporter" : "Reports", icon: ChartNoAxesCombined, roles: ["user_lead", "admin", "super_admin"] },
          { href: "/employees", label: lang === "sv" ? "Team" : "Team", icon: Users, roles: ["admin", "super_admin"] },
          { href: "/attendance", label: lang === "sv" ? "Närvaro" : "Attendance", icon: Clock, roles: ["admin", "super_admin"] },
          { href: "/ai-agent", label: lang === "sv" ? "AI-optimering" : "AI Optimisation", icon: Bot, roles: ["admin", "super_admin"] },
          { href: "/settings", label: lang === "sv" ? "Inställningar" : "Settings", icon: Settings, roles: ["admin", "super_admin"] },
        ] satisfies NavItem[]
      ).filter((item) => !item.roles || hasRole(...item.roles)),
    [lang, openTaskCount, unreadChatCount, hasRole]
  );

  const primaryMobileNav = navItems.slice(0, 5);
  const spotlightItems = useMemo(() => {
    if (!deferredSearch) return [];
    const routeMatches = navItems
      .filter((item) => item.label.toLowerCase().includes(deferredSearch))
      .map((item) => ({
        id: item.href,
        label: item.label,
        description: "Go to page",
        href: item.href,
      }));

    const employeeMatches = employees
      .filter((employee) => employee.name.toLowerCase().includes(deferredSearch))
      .slice(0, 4)
      .map((employee) => ({
        id: employee.id,
        label: employee.name,
        description: "Team member",
        href: `/employees/${employee.id}`,
      }));

    const taskMatches = logs
      .filter((task) => task.title && task.title.toLowerCase().includes(deferredSearch))
      .slice(0, 4)
      .map((task) => ({
        id: task.id,
        label: task.title,
        description: "Task",
        href: "/logs",
      }));

    return [...routeMatches, ...employeeMatches, ...taskMatches].slice(0, 8);
  }, [deferredSearch, employees, logs, navItems]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  return (
    <ShellDataContext.Provider value={{ employees, unreadChatCount }}>
    <div className="app-shell">
      <div className="app-grid">
        <aside className="app-sidebar">
          <div className="px-3">
            <div className="flex items-center justify-between gap-3">
              <Link href="/" className="text-2xl font-semibold tracking-[-0.04em] text-slate-950">
                Skift
              </Link>
              <span className="status-chip status-neutral">
                {lang === "sv" ? "Drift" : "Operations"}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {lang === "sv"
                ? "Snabb arbetsyta för bemanning, uppgifter, meddelanden och AI-beslut."
                : "Fast workspace for staffing, tasks, messages, and AI decisions."}
            </p>
          </div>

          {isSuperAdmin && locations.length > 0 && (
            <div className="px-3 mt-2 relative">
              <button
                type="button"
                onClick={() => setBranchOpen((v) => !v)}
                className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="flex-1 truncate">
                  {locations.find((l) => l.id === locationId)?.name ?? "Select branch"}
                </span>
                <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${branchOpen ? "rotate-180" : ""}`} />
              </button>

              {branchOpen && (
                <div className="absolute left-3 right-3 top-[calc(100%+4px)] z-50 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                  {locations.map((loc) => (
                    <button
                      key={loc.id}
                      type="button"
                      onClick={() => { setLocationId(loc.id); setBranchOpen(false); }}
                      className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs transition-colors hover:bg-slate-50 ${loc.id === locationId ? "font-semibold text-slate-900 bg-slate-50" : "text-slate-600"}`}
                    >
                      <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="truncate">{loc.name}</span>
                      {loc.id === locationId && (
                        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-indigo-500" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="app-sidebar-section flex-1 overflow-auto">
            <div className="app-sidebar-label">{lang === "sv" ? "Arbetsyta" : "Workspace"}</div>
            <div className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`app-nav-item ${isActive ? "app-nav-item-active" : ""}`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.label}</span>
                    {item.badge ? (
                      <span className="status-chip status-info">{item.badge}</span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>

          {hasRole("admin", "super_admin") && locationId && (
            <div className="px-3 pb-2">
              <a
                href={`/punch?loc=${locationId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Clock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="flex-1">{lang === "sv" ? "Web-punch" : "Web Punch"}</span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              </a>
            </div>
          )}

          {user && (
            <div className="app-panel-muted p-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-600">
                  <User className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-semibold text-slate-900">
                    {(user.employeeId && employees.find(e => e.id === user.employeeId)?.name) || user.name}
                  </div>
                  <div className="truncate text-xs text-slate-500">{user.role.replace(/_/g, " ")}</div>
                </div>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
                  aria-label="Sign out"
                  title="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
              {user.employeeId && (
                <Link
                  href={`/employees/${user.employeeId}`}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <User className="h-3.5 w-3.5" />
                  {lang === "sv" ? "Min profil" : "My Profile"}
                </Link>
              )}
            </div>
          )}
        </aside>

        <div className="app-main">
          <div className="app-page">
            <header className="app-topbar">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 lg:hidden"
                  onClick={() => setMobileNavOpen((prev) => !prev)}
                  aria-label="Toggle navigation"
                >
                  <Menu className="h-5 w-5" />
                </button>
                <div className="relative w-full max-w-xl">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={lang === "sv" ? "Sök uppgifter, personal, meddelanden..." : "Search tasks, staff, messages..."}
                    className="h-11 border-slate-200 bg-white pl-9"
                  />
                  {deferredSearch && spotlightItems.length > 0 ? (
                    <div className="app-panel absolute left-0 right-0 top-[calc(100%+8px)] z-40 p-2">
                      <div className="list-block">
                        {spotlightItems.map((item) => (
                          <Link
                            key={`${item.description}-${item.id}`}
                            href={item.href}
                            className="list-row"
                            onClick={() => setSearch("")}
                          >
                            <div className="list-row-main">
                              <div className="list-row-title">{item.label}</div>
                              <div className="list-row-copy">{item.description}</div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-slate-400" />
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {hasRole("admin", "super_admin") && (
                  <Button asChild className="h-10 rounded-xl px-4">
                    <Link href="/schedule?tab=day">
                      <Plus className="h-4 w-4" />
                      {lang === "sv" ? "Lägg till pass" : "Add Shift"}
                    </Link>
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="h-10 rounded-xl border-slate-200 bg-white"
                  onClick={() => setLang(lang === "en" ? "sv" : "en")}
                >
                  {lang === "en" ? "SV" : "EN"}
                </Button>
                {hasRole("admin", "super_admin") && (
                  <Button asChild variant="outline" className="hidden h-10 rounded-xl border-slate-200 bg-white sm:inline-flex">
                    <Link href="/settings">
                      <Settings className="h-4 w-4" />
                      {lang === "sv" ? "Inställningar" : "Settings"}
                    </Link>
                  </Button>
                )}
              </div>
            </header>

            {mobileNavOpen ? (
              <div className="app-panel mt-4 p-3 lg:hidden">
                <div className="space-y-1">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`app-nav-item ${isActive ? "app-nav-item-active" : ""}`}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="flex-1 text-sm font-medium">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {!/^\/employees\/.+/.test(pathname) && (
              <div className="page-header">
                <div>
                  <h1 className="page-title">{currentMeta.title}</h1>
                  <p className="page-subtitle">{currentMeta.subtitle}</p>
                </div>
                <div className="toolbar-row">
                  <div className="status-chip status-neutral">
                    {lang === "sv" ? "Olästa meddelanden" : "Unread messages"} {unreadChatCount}
                  </div>
                  <div className="status-chip status-info">
                    {lang === "sv" ? "Aktiva uppgifter" : "Active tasks"} {openTaskCount}
                  </div>
                </div>
              </div>
            )}

            <div key={pathname} className="animate-page-enter">
              {children}
            </div>
          </div>
        </div>
      </div>

      <nav className="app-mobile-nav">
        {primaryMobileNav.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`app-mobile-nav-item ${isActive ? "app-mobile-nav-item-active" : ""}`}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

    </div>
    </ShellDataContext.Provider>
  );
}

function LocationAwareShell({ children }: { children: React.ReactNode }) {
  const { hasRole } = useAuth();
  return (
    <LocationProvider isSuperAdmin={hasRole("super_admin")}>
      <ShellLayout>{children}</ShellLayout>
    </LocationProvider>
  );
}

export function LanguageAppShell({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <LocationAwareShell>{children}</LocationAwareShell>
    </LanguageProvider>
  );
}
