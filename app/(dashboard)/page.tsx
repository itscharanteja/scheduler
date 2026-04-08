"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { addDays, format, startOfWeek } from "date-fns";
import {
  AlertTriangle,
  Bot,
  CheckSquare,
  ChevronRight,
  MessageSquareMore,
  Plus,
  TrendingUp,
  Users,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { LOCATION_ID } from "@/lib/constants";
import {
  getEmployees,
  getShiftsByWeek,
  getTasks,
  getChannels,
  getSales,
  getAlerts,
  getActivity,
} from "@/lib/supabase";
import type {
  Shift,
  SalesDay,
  DashboardAlert,
  EmployeeActivityItem,
} from "@/lib/types";
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

export default function DashboardPage() {
  const { lang } = useLanguage();
  const { user, hasRole } = useAuth();
  const isBasicUser = !hasRole("user_lead", "admin", "super_admin");
  const [employeesCount, setEmployeesCount] = useState(0);
  const [weekShifts, setWeekShifts] = useState<Shift[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [todaySales, setTodaySales] = useState<SalesDay | null>(null);
  const [alerts, setAlerts] = useState<DashboardAlert[]>([]);
  const [activity, setActivity] = useState<EmployeeActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const todayKey = new Date().toISOString().split("T")[0];
  const weekStart = useMemo(
    () => startOfWeek(new Date(`${todayKey}T00:00:00`), { weekStartsOn: 1 }),
    [todayKey],
  );

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const [
          employees,
          schedule,
          shiftLogs,
          channels,
          sales,
          alertData,
          activityData,
        ] = await Promise.all([
          getEmployees(),
          getShiftsByWeek(weekStart, LOCATION_ID),
          getTasks(LOCATION_ID),
          getChannels(LOCATION_ID),
          getSales(LOCATION_ID, 1),
          getAlerts(LOCATION_ID),
          getActivity(LOCATION_ID, 5),
        ]);
        if (!active) return;
        setEmployeesCount(employees.length);
        setWeekShifts(schedule.shifts);
        setLogs(shiftLogs);
        setUnreadChatCount(
          (channels as any[]).reduce(
            (sum, ch) => sum + (ch.unread_count ?? 0),
            0,
          ),
        );
        setTodaySales(sales[0] ?? null);
        setAlerts(alertData);
        setActivity(activityData);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [weekStart]);

  const todayShifts = useMemo(
    () => weekShifts.filter((shift) => shift.date === todayKey),
    [todayKey, weekShifts],
  );

  const openTasks = logs.filter((task) => task.status !== "done");
  const overdueTasks = openTasks.filter(
    (task) =>
      task.dueTime &&
      new Date(task.dueTime).getTime() < Date.now(),
  );
  const staffOnShift = new Set(todayShifts.map((shift) => shift.employeeId))
    .size;
  const shiftLeaderCoverage = todayShifts.some(
    (shift) => shift.role === "shiftleader",
  );
  const totalHours = todayShifts.reduce(
    (sum, shift) => sum + shiftHours(shift.startTime, shift.endTime),
    0,
  );
  const coverageGaps = Math.max(0, 6 - staffOnShift);

  const copy =
    lang === "sv"
      ? {
          sales: "Försäljning idag",
          team: "På pass nu",
          tasks: "Uppgifter nu",
          gaps: "Bemanningsluckor",
          messages: "Olästa meddelanden",
          alerts: "Viktigt just nu",
          ai: "AI-förslag",
          quickActions: "Snabbåtgärder",
          activity: "Senaste teamaktivitet",
          viewAll: "Visa allt",
          review: "Granska",
          open: "Öppna",
          approve: "Godkänn",
          addShift: "Lägg till pass",
          assignTask: "Ny uppgift",
          sendMessage: "Skicka meddelande",
          noLeader: "Ingen skiftledare planerad idag",
          leaderReady: "Skiftledare planerad för dagen",
          labour: "Planerade timmar idag",
          store: "Enhet",
          staffing: "Bemanningsstatus",
          dueNow: "Förfaller nu",
          unread: "Olästa uppdateringar",
          suggestion: "AI ser hög trycknivå 18:00–20:00",
          suggestionBody:
            "Lägg till en extra serviceperson för att minska köbildning och hålla leveranstider.",
          noSales: "Ingen försäljningsdata idag",
        }
      : {
          sales: "Sales today",
          team: "On shift now",
          tasks: "Tasks due now",
          gaps: "Coverage gaps",
          messages: "Unread messages",
          alerts: "Needs attention",
          ai: "AI suggestions",
          quickActions: "Quick actions",
          activity: "Recent team activity",
          viewAll: "View all",
          review: "Review",
          open: "Open",
          approve: "Approve",
          addShift: "Add shift",
          assignTask: "New task",
          sendMessage: "Send message",
          noLeader: "No shift leader scheduled today",
          leaderReady: "Shift leader scheduled for today",
          labour: "Planned hours today",
          store: "Store",
          staffing: "Staffing status",
          dueNow: "Due now",
          unread: "Unread updates",
          suggestion: "AI sees pressure from 18:00-20:00",
          suggestionBody:
            "Add one more service teammate to reduce queue time and protect delivery speed.",
          noSales: "No sales data for today",
        };

  const cards = [
    {
      title: copy.sales,
      value: todaySales
        ? new Intl.NumberFormat("sv-SE", {
            style: "currency",
            currency: "SEK",
            maximumFractionDigits: 0,
          }).format(todaySales.revenue)
        : "—",
      note: todaySales
        ? `${todaySales.orders} orders • ${todaySales.peakLabel}`
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
      actionHref: "/employees",
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
            {loading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <GlassSkeleton key={i} className="h-12" />
                ))
              : myShifts.length === 0
                ? (
                  <div className="px-4 py-6 text-center text-sm text-slate-500">
                    {lang === "sv" ? "Inga pass den här veckan." : "No shifts scheduled this week."}
                  </div>
                )
                : myShifts.map((shift) => (
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
              <Link href="/chat">{copy.open}</Link>
            </Button>
          </div>
          <div className="mt-4 list-block">
            {loading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <GlassSkeleton key={i} className="h-12" />
                ))
              : activity.length === 0
                ? (
                  <div className="px-4 py-6 text-center text-sm text-slate-500">
                    {lang === "sv" ? "Ingen aktivitet ännu." : "No activity yet."}
                  </div>
                )
                : activity.map((item) => (
                  <div key={item.id} className="list-row">
                    <div className="list-row-main">
                      <div className="list-row-title">{item.title}</div>
                      <div className="list-row-copy">{item.detail}</div>
                    </div>
                    <div className="text-xs text-slate-500" suppressHydrationWarning>
                      {new Date(item.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                ))}
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
            <div className="status-chip status-neutral">
              {copy.store}: {copy.store}
            </div>
            <h2 className="mt-3 text-xl font-semibold text-slate-950">
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

      <section className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-4">
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
              {alerts.slice(0, 3).map((alert) => (
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
              {activity.map((item) => (
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
              {activity.length === 0 && !loading && (
                <div className="px-4 py-6 text-center text-sm text-slate-500">
                  {lang === "sv" ? "Ingen aktivitet ännu." : "No activity yet."}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="app-panel p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="section-title">{copy.ai}</h3>
                <p className="section-copy">
                  {lang === "sv"
                    ? "Direkt godkänn eller gå vidare till AI-vyn."
                    : "Approve directly or open the full AI workspace."}
                </p>
              </div>
              <span className="status-chip status-info">
                <Bot className="h-3.5 w-3.5" />1
              </span>
            </div>
            <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4">
              <div className="text-sm font-semibold text-slate-950">
                {copy.suggestion}
              </div>
              <div className="mt-2 text-sm text-slate-700">
                {copy.suggestionBody}
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <Button asChild size="sm">
                  <Link href="/ai-agent">{copy.approve}</Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href="/ai-agent">{copy.review}</Link>
                </Button>
              </div>
            </div>
          </div>

          <div className="app-panel p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="section-title">{copy.gaps}</h3>
                <p className="section-copy">
                  {lang === "sv"
                    ? "Fokusera på dagens luckor innan passet blir stressigt."
                    : "Focus on today's gaps before the shift gets busy."}
                </p>
              </div>
              <span
                className={`status-chip ${coverageGaps > 0 ? "status-warning" : "status-success"}`}
              >
                {coverageGaps}
              </span>
            </div>
            <div className="mt-4 list-block">
              {Array.from({ length: 3 }, (_, index) => {
                const slot = addDays(new Date(`${todayKey}T00:00:00`), index);
                return (
                  <div key={index} className="list-row">
                    <div className="list-row-main">
                      <div className="list-row-title">
                        {format(slot, "EEE d MMM")} •{" "}
                        {index === 0
                          ? "18:00-20:00"
                          : index === 1
                            ? "11:00-13:00"
                            : "20:00-22:00"}
                      </div>
                      <div className="list-row-copy">
                        {index === 0
                          ? lang === "sv"
                            ? "Efterfrågan väntas stiga snabbare än nuvarande bemanning."
                            : "Demand is expected to rise faster than current staffing."
                          : lang === "sv"
                            ? "Täckning ser stabil ut men bör bevakas."
                            : "Coverage looks stable but should be watched."}
                      </div>
                    </div>
                    <span
                      className={`status-chip ${index === 0 ? "status-danger" : "status-neutral"}`}
                    >
                      {index === 0 ? "Urgent" : "Watch"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
