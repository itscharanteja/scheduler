"use client";

import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GlassSkeleton } from "@/components/ui/glass-skeleton";
import { useLocation } from "@/context/LocationContext";
import { getSales, getShiftLogs, getShiftsByWeek } from "@/lib/supabase";
import { startOfWeek } from "date-fns";
import type { SalesDay, Shift } from "@/lib/types";

function shiftHours(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  return (eh * 60 + em - (sh * 60 + sm)) / 60;
}

function currency(value: number) {
  return new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function ReportsPage() {
  const { locationId } = useLocation();
  const [range, setRange] = useState("week");
  const [sales, setSales] = useState<SalesDay[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [completedTasks, setCompletedTasks] = useState(0);
  const [totalTasks, setTotalTasks] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
        const [salesData, logsData, scheduleData] = await Promise.all([
          getSales(locationId, 7),
          getShiftLogs(locationId, 100),
          getShiftsByWeek(weekStart, locationId),
        ]);
        if (!active) return;
        setSales([...salesData].reverse());
        setShifts(scheduleData.shifts);
        const logs = logsData as any[];
        setCompletedTasks(logs.filter((l) => l.status === "done").length);
        setTotalTasks(logs.length);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [locationId]);

  const report = useMemo(() => {
    const totalHours = shifts.reduce((sum, shift) => sum + shiftHours(shift.startTime, shift.endTime), 0);
    const taskCompletionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
    const totalRevenue = sales.reduce((sum, day) => sum + day.revenue, 0);
    const aiDrafts = shifts.filter((shift) => shift.createdByAi).length;
    const shiftLeaderDays = new Set(
      shifts.filter((s) => s.role === "shiftleader").map((s) => s.date)
    ).size;
    return { totalHours, taskCompletionRate, totalRevenue, aiDrafts, shiftLeaderDays };
  }, [shifts, sales, completedTasks, totalTasks]);

  const displaySales = range === "week" ? sales.slice(-7) : sales;

  if (loading) {
    return (
      <div className="space-y-6">
        <GlassSkeleton className="h-32" />
        <div className="grid gap-4 xl:grid-cols-2">
          <GlassSkeleton className="h-64" />
          <GlassSkeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="app-panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="toolbar-row">
            <Button variant={range === "week" ? "default" : "outline"} size="sm" onClick={() => setRange("week")}>
              This week
            </Button>
            <Button variant={range === "month" ? "default" : "outline"} size="sm" onClick={() => setRange("month")}>
              This month
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={() => toast.success("Export queued")}>
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="metric-card">
            <div className="metric-label">Scheduled hours</div>
            <div className="metric-value">{report.totalHours.toFixed(1)}h</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Task completion</div>
            <div className="metric-value">{report.taskCompletionRate.toFixed(0)}%</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Sales total</div>
            <div className="metric-value">{currency(report.totalRevenue)}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">AI draft shifts</div>
            <div className="metric-value">{report.aiDrafts}</div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="app-panel overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="section-title">Operational summary</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="ops-table min-w-[640px]">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Revenue</th>
                  <th>Orders</th>
                  <th>Labour ratio</th>
                  <th>Peak</th>
                </tr>
              </thead>
              <tbody>
                {displaySales.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-500">
                      No sales data for this period.
                    </td>
                  </tr>
                ) : (
                  displaySales.map((day) => (
                    <tr key={day.id}>
                      <td>{day.date}</td>
                      <td>{currency(day.revenue)}</td>
                      <td>{day.orders}</td>
                      <td>{day.revenue > 0 ? ((day.laborCost / day.revenue) * 100).toFixed(1) : "—"}%</td>
                      <td>{day.peakLabel}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="app-panel p-5">
          <h2 className="section-title">AI and execution outcomes</h2>
          <div className="mt-4 list-block">
            <div className="list-row">
              <div className="list-row-main">
                <div className="list-row-title">AI-generated shifts</div>
                <div className="list-row-copy">Track how many suggestions were turned into draft schedule items.</div>
              </div>
              <span className="status-chip status-info">{report.aiDrafts}</span>
            </div>
            <div className="list-row">
              <div className="list-row-main">
                <div className="list-row-title">Completed tasks</div>
                <div className="list-row-copy">Visible follow-through across delegated operational work.</div>
              </div>
              <span className="status-chip status-success">{completedTasks}</span>
            </div>
            <div className="list-row">
              <div className="list-row-main">
                <div className="list-row-title">Coverage quality</div>
                <div className="list-row-copy">Review understaffed days and compare with sales pressure.</div>
              </div>
              <span className={`status-chip ${report.shiftLeaderDays >= 5 ? "status-success" : "status-warning"}`}>
                {report.shiftLeaderDays >= 5 ? "Healthy" : "Needs review"}
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
