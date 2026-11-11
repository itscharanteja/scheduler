"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  AlertTriangle,
  CheckSquare,
  ChevronRight,
  MessageSquareMore,
  Plus,
  TrendingUp,
  Users,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "@/context/LocationContext";
import { useShellData } from "@/components/app-shell";
import { hydrateCache, useCachedQuery } from "@/lib/cache/swr-cache";
import {
  getShiftsByWeek,
  getTasks,
  getSales,
  getAlerts,
  getActivity,
} from "@/lib/supabase";
import type {
  SalesDay,
  DashboardAlert,
  EmployeeActivityItem,
  WeekSchedule,
} from "@/lib/types";
import type { DashboardSnapshot } from "@/lib/services/dashboard-snapshot";
import { Button } from "@/components/ui/button";
import { GlassSkeleton } from "@/components/ui/glass-skeleton";

function shiftHours(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  return (eh * 60 + em - (sh * 60 + sm)) / 60;
}

function statusClass(value: number, warningAt: number, dangerAt: number) {
  if (value >= dangerAt) return "status-danger";
  if (value >= warningAt) return "status-warning";
  return "status-success";
}

export default function DashboardClient({
  initialSnapshot,
  initialWeekStartStr,
}: {
  initialSnapshot?: DashboardSnapshot;
  initialWeekStartStr: string;
}) {
  const { lang } = useLanguage();
  const { user, hasRole } = useAuth();
  const { locationId } = useLocation();
  const isBasicUser = !hasRole("user_lead", "admin", "super_admin");
  const { employees: shellEmployees, unreadChatCount: shellChatCount } = useShellData();

  // Synchronously seed the SWR memory cache before child components mount (once per snapshot)
  const hydratedRef = useRef<string | null>(null);
  const snapshotKey = initialSnapshot
    ? `${initialSnapshot.timestamp}:${locationId}:${user?.id ?? "anonymous"}:${initialWeekStartStr}`
    : null;

  if (initialSnapshot && hydratedRef.current !== snapshotKey) {
    hydratedRef.current = snapshotKey;
    hydrateCache(
      {
        employees: initialSnapshot.employees,
        [`shifts:week:${initialWeekStartStr}`]: initialSnapshot.schedule,
        "tasks:dashboard": initialSnapshot.tasks,
        "tasks:all": initialSnapshot.tasks,
        ...(user?.employeeId
          ? {
              [`tasks:my:${user.employeeId}`]: initialSnapshot.tasks.filter(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (t: any) =>
                  t.assigneeId === user.employeeId ||
                  t.createdBy === user.employeeId
              ),
            }
          : {}),
        channels: initialSnapshot.channels,
        "sales:today": initialSnapshot.sales,
        "alerts:dashboard": initialSnapshot.alerts,
        "activity:dashboard": initialSnapshot.activity,
      },
      { locationId, userId: user?.id }
    );
  }

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const todayKey = new Date().toISOString().split("T")[0];
  const weekStartStr = initialWeekStartStr;

  const { data: scheduleData, isLoading: scheduleLoading } = useCachedQuery<WeekSchedule>(
    `shifts:week:${weekStartStr}`,
    (signal) => getShiftsByWeek(initialWeekStartStr, locationId, signal),
    { locationId, userId: user?.id }
  );
  const rawShifts = scheduleData?.shifts ?? initialSnapshot?.schedule?.shifts;
  const weekShifts = useMemo(() => rawShifts ?? [], [rawShifts]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: logs = initialSnapshot?.tasks ?? [] } = useCachedQuery<any[]>(
    "tasks:dashboard",
    (signal) => getTasks(locationId, undefined, signal),
    { locationId, userId: user?.id }
  );

  const { data: initialSales = initialSnapshot?.sales ?? [] } = useCachedQuery<SalesDay[]>(
    "sales:today",
    (signal) => getSales(locationId, 1, signal),
    { locationId, userId: user?.id }
  );

  const { data: cachedAlerts = initialSnapshot?.alerts ?? [] } = useCachedQuery<DashboardAlert[]>(
    "alerts:dashboard",
    (signal) => getAlerts(locationId, signal),
    { locationId, userId: user?.id }
  );

  const { data: cachedActivity = initialSnapshot?.activity ?? [] } = useCachedQuery<EmployeeActivityItem[]>(
    "activity:dashboard",
    (signal) => getActivity(locationId, 5, signal),
    { locationId, userId: user?.id }
  );

  const employeesCount =
    shellEmployees.length > 0
      ? shellEmployees.length
      : initialSnapshot?.employees.length ?? 0;

  const unreadChatCount =
    shellChatCount > 0
      ? shellChatCount
      : initialSnapshot?.channels.reduce((sum, ch) => sum + (ch.unreadCount ?? 0), 0) ?? 0;

  const currentSales = initialSales[0] ?? null;
  const currentAlerts = cachedAlerts;
  const currentActivity = cachedActivity;

  // Zero-skeleton initial paint when initialSnapshot is primed
  const loading =
    (!mounted && !initialSnapshot) ||
    (scheduleLoading && !scheduleData && weekShifts.length === 0);

  const todayShifts = useMemo(
    () => weekShifts.filter((shift) => shift.date === todayKey),
    [todayKey, weekShifts]
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const openTasks = logs.filter((task: any) => task.status !== "done");
  const overdueTasks = openTasks.filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (task: any) => task.dueTime && new Date(task.dueTime).getTime() < Date.now()
  );
  const staffOnShift = new Set(todayShifts.map((shift) => shift.employeeId)).size;
  const shiftLeaderCoverage = todayShifts.some((shift) => shift.role === "shiftleader");
  const totalHours = todayShifts.reduce(
    (sum, shift) => sum + shiftHours(shift.startTime, shift.endTime),
    0
  );

  const copy =
    lang === "sv"
      ? {
          sales: "Försäljning idag",
          team: "På pass nu",
          tasks: "Uppgifter nu",
          messages: "Olästa meddelanden",
          alerts: "Viktigt just nu",
          quickActions: "Snabbåtgärder",
          activity: "Senaste teamaktivitet",
          viewAll: "Visa allt",
          review: "Granska",
          open: "Öppna",
          addShift: "Lägg till pass",
          assignTask: "Ny uppgift",
          sendMessage: "Skicka meddelande",
          noLeader: "Ingen skiftledare planerad idag",
          leaderReady: "Skiftledare planerad för dagen",
          labour: "Planerade timmar idag",
          staffing: "Bemanningsstatus",
          dueNow: "Förfaller nu",
          unread: "Olästa uppdateringar",
          noSales: "Ingen försäljningsdata idag",
        }
      : {
          sales: "Sales today",
          team: "On shift now",
          tasks: "Tasks due now",
          messages: "Unread messages",
          alerts: "Needs attention",
          quickActions: "Quick actions",
          activity: "Recent team activity",
          viewAll: "View all",
          review: "Review",
          open: "Open",
          addShift: "Add shift",
          assignTask: "New task",
          sendMessage: "Send message",
          noLeader: "No shift leader scheduled today",
          leaderReady: "Shift leader scheduled for today",
          labour: "Planned hours today",
          staffing: "Staffing status",
          dueNow: "Due now",
          unread: "Unread updates",
          noSales: "No sales data for today",
        };

  const cards = [
    {
      title: copy.sales,
      value: currentSales
        ? new Intl.NumberFormat("sv-SE", {
            style: "currency",
            currency: "SEK",
            maximumFractionDigits: 0,
          }).format(currentSales.revenue)
        : "—",
      note: currentSales
        ? `${currentSales.orders} orders • ${currentSales.peakLabel}`
        : copy.noSales,
      status: "status-success",
      actionHref: "/sales",
      actionLabel: copy.open,
      icon: TrendingUp,
    },
    {
      title: copy.team,
      value: `${staffOnShift}/${Math.max(employeesCount, staffOnShift)}`,
      note: shiftLeaderCoverage ? copy.leaderReady : copy.noLeader,
      status: shiftLeaderCoverage ? "status-success" : "status-danger",
      actionHref: "/schedule",
      actionLabel: copy.open,
      icon: Users,
    },
    {
      title: copy.tasks,
      value: `${openTasks.length}`,
      note: `${overdueTasks.length} ${copy.dueNow}`,
      status: statusClass(overdueTasks.length, 1, 2),
      actionHref: "/logs",
      actionLabel: copy.review,
      icon: CheckSquare,
    },
    {
      title: copy.messages,
      value: `${unreadChatCount}`,
      note: copy.unread,
      status: statusClass(unreadChatCount, 2, 4),
      actionHref: "/chat",
      actionLabel: copy.open,
      icon: MessageSquareMore,
    },
  ];

  // Hydration barrier only for unhydrated cold renders without snapshot
  if (!mounted && !initialSnapshot) {
    return (
      <div className="space-y-6">
        <section className="app-panel p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <GlassSkeleton className="h-6 w-48" />
              <GlassSkeleton className="h-4 w-96 max-w-full" />
            </div>
            <div className="toolbar-row">
              <GlassSkeleton className="h-10 w-28 rounded-xl" />
              <GlassSkeleton className="h-10 w-28 rounded-xl" />
            </div>
          </div>
        </section>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <GlassSkeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </section>
      </div>
    );
  }

  // Simplified dashboard for basic user role
  if (isBasicUser) {
    const myShifts = weekShifts
      .filter((s) => s.employeeId === user?.employeeId)
      .sort((a, b) => a.date.localeCompare(b.date));

    return (
      <div className="space-y-6">
        <div className="app-panel p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="section-title">
                {lang === "sv" ? "Dina kommande pass" : "Your upcoming shifts"}
              </h3>
              <p className="section-copy">
                {lang === "sv"
                  ? "Pass schemalagda för dig den här veckan."
                  : "Shifts scheduled for you this week."}
              </p>
            </div>
          </div>
          <div className="mt-4 list-block">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <GlassSkeleton key={i} className="h-12" />
              ))
            ) : myShifts.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-slate-500">
                {lang === "sv"
                  ? "Inga pass den här veckan."
                  : "No shifts scheduled this week."}
              </div>
            ) : (
              myShifts.map((shift) => (
                <div key={shift.id} className="list-row">
                  <div className="list-row-main">
                    <div className="list-row-title">
                      {format(new Date(`${shift.date}T00:00:00`), "EEE d MMM")}
                    </div>
                    <div className="list-row-copy">
                      {shift.startTime} – {shift.endTime}
                      {shift.role ? ` · ${shift.role}` : ""}
                    </div>
                  </div>
                  <span className="status-chip status-neutral">
                    {shiftHours(shift.startTime, shift.endTime).toFixed(1)}h
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="app-panel p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="section-title">{copy.activity}</h3>
              <p className="section-copy">
                {lang === "sv"
                  ? "Senaste synliga signaler från teamet."
                  : "Latest visible signals from the team."}
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/chat">{copy.open}</Link>
            </Button>
          </div>
          <div className="mt-4 list-block">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <GlassSkeleton key={i} className="h-12" />
              ))
            ) : currentActivity.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-slate-500">
                {lang === "sv" ? "Ingen aktivitet ännu." : "No activity yet."}
              </div>
            ) : (
              currentActivity.map((item) => (
                <div key={item.id} className="list-row">
                  <div className="list-row-main">
                    <div className="list-row-title">{item.title}</div>
                    <div className="list-row-copy">{item.detail}</div>
                  </div>
                  <div
                    className="text-xs text-slate-500"
                    suppressHydrationWarning
                  >
                    {new Date(item.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="app-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">
              {copy.quickActions}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              {lang === "sv"
                ? "Få fram rätt åtgärd direkt. Lägg till pass, skapa uppgift eller svara på operativa meddelanden utan omvägar."
                : "Bring the right action forward. Add shifts, create tasks, or respond to operational messages without extra steps."}
            </p>
          </div>
          <div className="toolbar-row">
            <Button asChild>
              <Link href="/schedule?tab=day">
                <Plus className="h-4 w-4" />
                {copy.addShift}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/logs">{copy.assignTask}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/chat">{copy.sendMessage}</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, index) => (
              <GlassSkeleton key={index} className="h-40" />
            ))
          : cards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.title} className="metric-card">
                  <div className="flex items-center justify-between gap-3">
                    <div className="metric-label">{card.title}</div>
                    <div className={`status-chip ${card.status}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                  </div>
                  <div className="metric-value">{card.value}</div>
                  <div className="metric-note">{card.note}</div>
                  <div className="mt-4">
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="w-full justify-between"
                    >
                      <Link href={card.actionHref}>
                        {card.actionLabel}
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            })}
      </section>

      <section className="space-y-4">
        <div className="app-panel p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="section-title">{copy.alerts}</h3>
              <p className="section-copy">
                {copy.staffing}: {staffOnShift} people scheduled,{" "}
                {totalHours.toFixed(1)}h {copy.labour.toLowerCase()}.
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/schedule">{copy.viewAll}</Link>
            </Button>
          </div>
          <div className="mt-4 list-block">
            {currentAlerts.slice(0, 3).map((alert) => (
              <div
                key={alert.id}
                className={`list-row ${alert.tone === "critical" ? "surface-danger" : alert.tone === "warning" ? "surface-warning" : "surface-info"}`}
              >
                <div className="list-row-main">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-current" />
                    <div className="list-row-title">{alert.title}</div>
                  </div>
                  <div className="list-row-copy">{alert.message}</div>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href="/logs">{copy.review}</Link>
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="app-panel p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="section-title">{copy.activity}</h3>
              <p className="section-copy">
                {lang === "sv"
                  ? "Senaste synliga signaler från teamet."
                  : "Latest visible signals from the team."}
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/employees">{copy.viewAll}</Link>
            </Button>
          </div>
          <div className="mt-4 list-block">
            {currentActivity.map((item) => (
              <div key={item.id} className="list-row">
                <div className="list-row-main">
                  <div className="list-row-title">{item.title}</div>
                  <div className="list-row-copy">{item.detail}</div>
                </div>
                <div
                  className="text-xs text-slate-500"
                  suppressHydrationWarning
                >
                  {new Date(item.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            ))}
            {currentActivity.length === 0 && !loading && (
              <div className="px-4 py-6 text-center text-sm text-slate-500">
                {lang === "sv" ? "Ingen aktivitet ännu." : "No activity yet."}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
