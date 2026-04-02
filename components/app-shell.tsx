"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Bot,
  Calendar,
  ChartNoAxesCombined,
  CheckSquare,
  ChevronRight,
  LayoutDashboard,
  Menu,
  MessageSquareMore,
  Plus,
  Search,
  Settings,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { LanguageProvider, useLanguage } from "@/context/LanguageContext";
import { LOCATION_ID } from "@/lib/constants";
import { getEmployees, getShiftLogs, getChannels } from "@/lib/supabase";
import type { AppNotification, Employee } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
};

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
        };

  if (pathname.startsWith("/dashboard/employees/")) {
    return { title: copy.profile[0], subtitle: copy.profile[1] };
  }
  if (pathname.startsWith("/dashboard/logs")) {
    return { title: copy.tasks[0], subtitle: copy.tasks[1] };
  }
  if (pathname.startsWith("/dashboard/chat")) {
    return { title: copy.messages[0], subtitle: copy.messages[1] };
  }
  if (pathname.startsWith("/dashboard/sales")) {
    return { title: copy.sales[0], subtitle: copy.sales[1] };
  }
  if (pathname.startsWith("/dashboard/ai-agent")) {
    return { title: copy.ai[0], subtitle: copy.ai[1] };
  }
  if (pathname.startsWith("/dashboard/employees")) {
    return { title: copy.team[0], subtitle: copy.team[1] };
  }
  if (pathname.startsWith("/dashboard/schedule")) {
    return { title: copy.schedule[0], subtitle: copy.schedule[1] };
  }
  if (pathname.startsWith("/dashboard/reports")) {
    return { title: copy.reports[0], subtitle: copy.reports[1] };
  }
  if (pathname.startsWith("/dashboard/settings")) {
    return { title: copy.settings[0], subtitle: copy.settings[1] };
  }
  return { title: copy.dashboard[0], subtitle: copy.dashboard[1] };
}

function NotificationPanel({
  notifications,
  loading,
  open,
  anchorRef,
  onClose,
  onRefresh,
  onMarkAsRead,
  onClear,
}: {
  notifications: AppNotification[];
  loading: boolean;
  open: boolean;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onRefresh: () => void;
  onMarkAsRead: (id: string) => void;
  onClear: () => void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState({ top: 64, right: 16 });

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPosition({
        top: rect.bottom + 10,
        right: Math.max(window.innerWidth - rect.right, 16),
      });
    };
    update();
    onRefresh();
    document.addEventListener("mousedown", handleOutside);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };

    function handleOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) {
        return;
      }
      onClose();
    }
  }, [anchorRef, onClose, onRefresh, open]);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      className="app-panel fixed z-50 w-[360px] max-w-[calc(100vw-24px)] p-3 animate-in fade-in zoom-in-95"
      style={{ top: position.top, right: position.right }}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="section-title text-sm">Notifications</div>
          <div className="section-copy">Shift updates, conflicts, and AI alerts.</div>
        </div>
        <button
          type="button"
          className="text-xs font-semibold text-slate-600 hover:text-slate-900"
          onClick={onClear}
        >
          Clear all
        </button>
      </div>
      <div className="list-block max-h-[360px] overflow-auto">
        {loading ? (
          <div className="app-panel-muted h-24 animate-pulse" />
        ) : notifications.length === 0 ? (
          <div className="app-panel-muted px-4 py-8 text-center text-sm text-slate-600">
            No unread issues right now.
          </div>
        ) : (
          notifications.map((item) => (
            <button
              key={item.id}
              type="button"
              className="list-row w-full text-left"
              onClick={() => onMarkAsRead(item.id)}
            >
              <div className="list-row-main">
                <div className="flex items-center gap-2">
                  <div className="list-row-title">{item.title}</div>
                  {!item.read ? <span className="status-chip status-info">New</span> : null}
                </div>
                <div className="list-row-copy">{item.message}</div>
              </div>
              <div className="text-xs text-slate-500">
                {new Date(item.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function ShellLayout({ children }: { children: React.ReactNode }) {
  const { lang, setLang } = useLanguage();
  const pathname = usePathname();
  const currentMeta = useMemo(() => getPageMeta(pathname, lang), [lang, pathname]);
  const bellRef = useRef<HTMLButtonElement | null>(null);

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [openTaskCount, setOpenTaskCount] = useState(0);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [channelCount, setChannelCount] = useState(0);

  const unreadCount = notifications.filter((item) => !item.read).length;

  useEffect(() => {
    (async () => {
      try {
        const [emps, shiftLogs, channels] = await Promise.all([
          getEmployees(),
          getShiftLogs(LOCATION_ID, 50),
          getChannels(LOCATION_ID),
        ]);
        setEmployees(emps);
        setLogs(shiftLogs as any[]);
        setOpenTaskCount((shiftLogs as any[]).filter((l) => l.status !== "done").length);
        setUnreadChatCount((channels as any[]).reduce((sum, ch) => sum + (ch.unread_count ?? 0), 0));
        setChannelCount(channels.length);
      } catch (error) {
        console.error("[app-shell] Failed to load shell data:", error);
      }
    })();
  }, []);

  const navItems = useMemo<NavItem[]>(
    () => [
      { href: "/dashboard", label: lang === "sv" ? "Dashboard" : "Dashboard", icon: LayoutDashboard },
      { href: "/dashboard/logs", label: lang === "sv" ? "Uppgifter" : "Tasks", icon: CheckSquare, badge: openTaskCount },
      { href: "/dashboard/schedule", label: lang === "sv" ? "Schema" : "Schedule", icon: Calendar },
      { href: "/dashboard/chat", label: lang === "sv" ? "Meddelanden" : "Messages", icon: MessageSquareMore, badge: unreadChatCount },
      { href: "/dashboard/sales", label: lang === "sv" ? "Försäljning" : "Sales", icon: ChartNoAxesCombined },
      { href: "/dashboard/ai-agent", label: lang === "sv" ? "AI-optimering" : "AI Optimisation", icon: Bot },
      { href: "/dashboard/employees", label: lang === "sv" ? "Team" : "Team", icon: Users },
      { href: "/dashboard/reports", label: lang === "sv" ? "Rapporter" : "Reports", icon: ChartNoAxesCombined },
      { href: "/dashboard/settings", label: lang === "sv" ? "Inställningar" : "Settings", icon: Settings },
    ],
    [lang, openTaskCount, unreadChatCount]
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
        href: `/dashboard/employees/${employee.id}`,
      }));

    const taskMatches = logs
      .filter((task) => task.title && task.title.toLowerCase().includes(deferredSearch))
      .slice(0, 4)
      .map((task) => ({
        id: task.id,
        label: task.title,
        description: "Task",
        href: "/dashboard/logs",
      }));

    return [...routeMatches, ...employeeMatches, ...taskMatches].slice(0, 8);
  }, [deferredSearch, employees, logs, navItems]);

  async function fetchNotifications() {
    setNotificationsLoading(true);
    try {
      const response = await fetch("/api/notifications?limit=12", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error("Failed to load notifications.");
      }
      setNotifications(Array.isArray(payload.notifications) ? payload.notifications : []);
    } catch (error) {
      console.error(error);
      toast.error("Could not load notifications");
    } finally {
      setNotificationsLoading(false);
    }
  }

  async function markNotificationAsRead(id: string) {
    setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, read: true } : item)));
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch (error) {
      console.error(error);
    }
  }

  async function clearNotifications() {
    try {
      await fetch("/api/notifications", { method: "DELETE" });
      setNotifications([]);
      toast.success("Notifications cleared");
    } catch (error) {
      console.error(error);
      toast.error("Could not clear notifications");
    }
  }

  useEffect(() => {
    void fetchNotifications();
  }, [pathname]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  return (
    <div className="app-shell">
      <div className="app-grid">
        <aside className="app-sidebar">
          <div className="px-3">
            <div className="flex items-center justify-between gap-3">
              <Link href="/dashboard" className="text-2xl font-semibold tracking-[-0.04em] text-slate-950">
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

          <div className="app-panel-muted p-4">
            <div className="section-title text-sm">
              {lang === "sv" ? "Snabbstatus" : "Quick status"}
            </div>
            <div className="mt-3 grid gap-2 text-sm text-slate-700">
              <div className="flex items-center justify-between">
                <span>{lang === "sv" ? "Öppna uppgifter" : "Open tasks"}</span>
                <span className="font-semibold text-slate-950">{openTaskCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>{lang === "sv" ? "Olästa meddelanden" : "Unread messages"}</span>
                <span className="font-semibold text-slate-950">{unreadChatCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>{lang === "sv" ? "Kanaler live" : "Active channels"}</span>
                <span className="font-semibold text-slate-950">{channelCount}</span>
              </div>
            </div>
          </div>
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
                <Button asChild className="h-10 rounded-xl px-4">
                  <Link href="/dashboard/schedule?tab=day">
                    <Plus className="h-4 w-4" />
                    {lang === "sv" ? "Lägg till pass" : "Add Shift"}
                  </Link>
                </Button>
                <button
                  ref={bellRef}
                  type="button"
                  className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700"
                  onClick={() => setNotificationsOpen((prev) => !prev)}
                  aria-label="Notifications"
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 ? (
                    <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-blue-500" />
                  ) : null}
                </button>
                <Button
                  variant="outline"
                  className="h-10 rounded-xl border-slate-200 bg-white"
                  onClick={() => setLang(lang === "en" ? "sv" : "en")}
                >
                  {lang === "en" ? "SV" : "EN"}
                </Button>
                <Button asChild variant="outline" className="hidden h-10 rounded-xl border-slate-200 bg-white sm:inline-flex">
                  <Link href="/dashboard/settings">
                    <Settings className="h-4 w-4" />
                    {lang === "sv" ? "Inställningar" : "Settings"}
                  </Link>
                </Button>
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

      <NotificationPanel
        notifications={notifications}
        loading={notificationsLoading}
        open={notificationsOpen}
        anchorRef={bellRef}
        onClose={() => setNotificationsOpen(false)}
        onRefresh={() => void fetchNotifications()}
        onMarkAsRead={(id) => void markNotificationAsRead(id)}
        onClear={() => void clearNotifications()}
      />
    </div>
  );
}

export function LanguageAppShell({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <ShellLayout>{children}</ShellLayout>
    </LanguageProvider>
  );
}
