"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  AlertTriangle,
  CheckSquare,
  ChevronRight,
  Loader2,
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

  // Synchronously seed the SWR memory cache before child components mount (once on initial render)
  useState(() => {
    if (initialSnapshot) {
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
  });

  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const [currentTime] = useState(() => Date.now());
  const [todayKey] = useState(() => new Date().toISOString().split("T")[0]);
  const weekStartStr = initialWeekStartStr;

  const { data: scheduleData, isLoading: scheduleLoading } = useCachedQuery<WeekSchedule>(
    `shifts:week:${weekStartStr}`,
    (signal) => getShiftsByWeek(initialWeekStartStr, locationId, signal),
    { locationId, userId: user?.id }
  );
  const rawShifts = scheduleData?.shifts ?? initialSnapshot?.schedule?.shifts;
  const weekShifts = useMemo(() => rawShifts ?? [], [rawShifts]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: logs, isLoading: tasksLoading } = useCachedQuery<any[]>(
    "tasks:dashboard",
    (signal) => getTasks(locationId, undefined, signal),
    { locationId, userId: user?.id }
  );
  const taskList = logs ?? initialSnapshot?.tasks ?? [];

  const { data: initialSales, isLoading: salesLoading } = useCachedQuery<SalesDay[]>(
    "sales:today",
    (signal) => getSales(locationId, 1, signal),
    { locationId, userId: user?.id }
  );
  const salesList = initialSales ?? initialSnapshot?.sales ?? [];

  const { data: cachedAlerts, isLoading: alertsLoading } = useCachedQuery<DashboardAlert[]>(
    "alerts:dashboard",
    (signal) => getAlerts(locationId, signal),
    { locationId, userId: user?.id }
  );
  const currentAlerts = cachedAlerts ?? initialSnapshot?.alerts ?? [];

  const { data: cachedActivity, isLoading: activityLoading } = useCachedQuery<EmployeeActivityItem[]>(
    "activity:dashboard",
    (signal) => getActivity(locationId, 5, signal),
    { locationId, userId: user?.id }
  );
  const currentActivity = cachedActivity ?? initialSnapshot?.activity ?? [];

  const employeesCount =
    shellEmployees.length > 0
      ? shellEmployees.length
      : initialSnapshot?.employees.length ?? 0;

  const unreadChatCount =
    shellChatCount > 0
      ? shellChatCount
      : initialSnapshot?.channels.reduce((sum, ch) => sum + (ch.unreadCount ?? 0), 0) ?? 0;

  const isSalesLoading = (!isClient && !initialSnapshot) || (salesLoading && salesList.length === 0);
  const isScheduleLoading = (!isClient && !initialSnapshot) || (scheduleLoading && weekShifts.length === 0);
  const isTasksLoading = (!isClient && !initialSnapshot) || (tasksLoading && taskList.length === 0);
  const isMessagesLoading = !isClient && !initialSnapshot;

  const currentSales = salesList.length > 0 ? salesList[0] : null;
  const hasSalesData = currentSales !== null && currentSales !== undefined;
  const hasScheduleData = weekShifts.length > 0 || employeesCount > 0;
  const hasTasksData = taskList.length > 0;
  const hasMessagesData = shellChatCount > 0 || (initialSnapshot?.channels && initialSnapshot.channels.length > 0);

  const todayShifts = useMemo(
    () => weekShifts.filter((shift) => shift.date === todayKey),
    [todayKey, weekShifts]
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const openTasks = taskList.filter((task: any) => task.status !== "done");
  const overdueTasks = openTasks.filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (task: any) => task.dueTime && new Date(task.dueTime).getTime() < currentTime
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
          loading: "Laddar...",
          noData: "Ingen data",
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
          loading: "Loading...",
          noData: "No data",
        };

  const cards = [
    {
      title: copy.sales,
      loading: isSalesLoading,
      hasData: hasSalesData,
      value: currentSales
        ? new Intl.NumberFormat("sv-SE", {
            style: "currency",
            currency: "SEK",
            maximumFractionDigits: 0,
          }).format(currentSales.revenue)
        : copy.noData,
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
      loading: isScheduleLoading,
      hasData: hasScheduleData,
      value: hasScheduleData
        ? `${staffOnShift}/${Math.max(employeesCount, staffOnShift)}`
        : copy.noData,
      note: hasScheduleData
        ? shiftLeaderCoverage
          ? copy.leaderReady
          : copy.noLeader
        : copy.noData,
      status: shiftLeaderCoverage ? "status-success" : "status-danger",
      actionHref: "/schedule",
      actionLabel: copy.open,
      icon: Users,
    },
    {
      title: copy.tasks,
      loading: isTasksLoading,
      hasData: hasTasksData,
      value: hasTasksData ? `${openTasks.length}` : copy.noData,
      note: hasTasksData ? `${overdueTasks.length} ${copy.dueNow}` : copy.noData,
      status: statusClass(overdueTasks.length, 1, 2),
      actionHref: "/logs",
      actionLabel: copy.review,
      icon: CheckSquare,
    },
    {
      title: copy.messages,
      loading: isMessagesLoading,
      hasData: hasMessagesData,
      value: hasMessagesData ? `${unreadChatCount}` : copy.noData,
      note: hasMessagesData ? copy.unread : copy.noData,
      status: statusClass(unreadChatCount, 2, 4),
      actionHref: "/chat",
      actionLabel: copy.open,
      icon: MessageSquareMore,
    },
  ];

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
            {isScheduleLoading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                <span>{copy.loading}</span>
              </div>
            ) : myShifts.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-slate-500">
                {copy.noData}
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
            {activityLoading && currentActivity.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                <span>{copy.loading}</span>
              </div>
            ) : currentActivity.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-slate-500">
                {copy.noData}
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
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className="metric-card">
              <div className="flex items-center justify-between gap-3">
                <div className="metric-label">{card.title}</div>
                <div className={`status-chip ${card.status}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
              </div>
              {card.loading ? (
                <div className="my-3 flex items-center gap-2 py-1 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                  <span>{copy.loading}</span>
                </div>
              ) : !card.hasData ? (
                <div className="my-3 py-1">
                  <div className="text-xl font-semibold text-slate-400">
                    {copy.noData}
                  </div>
                  <div className="metric-note mt-1">{card.note}</div>
                </div>
              ) : (
                <>
                  <div className="metric-value">{card.value}</div>
                  <div className="metric-note">{card.note}</div>
                </>
              )}
              <div className="mt-4">
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="w-full justify-between"
                  disabled={card.loading}
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
            {alertsLoading && currentAlerts.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                <span>{copy.loading}</span>
              </div>
            ) : currentAlerts.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-slate-500">
                {copy.noData}
              </div>
            ) : (
              currentAlerts.slice(0, 3).map((alert) => (
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
              <Link href="/employees">{copy.viewAll}</Link>
            </Button>
          </div>
          <div className="mt-4 list-block">
            {activityLoading && currentActivity.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                <span>{copy.loading}</span>
              </div>
            ) : currentActivity.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-slate-500">
                {copy.noData}
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
      </section>
    </div>
  );
}
