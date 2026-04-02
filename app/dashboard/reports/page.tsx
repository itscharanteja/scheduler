"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { mockLogs, mockSales, mockShifts } from "@/lib/mock-data";

function shiftHours(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  return (eh * 60 + em - (sh * 60 + sm)) / 60;
}

export default function ReportsPage() {
  const [range, setRange] = useState("week");

  const report = useMemo(() => {
    const totalHours = mockShifts.reduce((sum, shift) => sum + shiftHours(shift.startTime, shift.endTime), 0);
    const completedTasks = mockLogs.filter((task) => task.status === "done").length;
    const taskCompletionRate = (completedTasks / mockLogs.length) * 100;
    const totalRevenue = mockSales.reduce((sum, day) => sum + day.revenue, 0);
    return {
      totalHours,
      taskCompletionRate,
      totalRevenue,
      aiDrafts: mockShifts.filter((shift) => shift.createdByAi).length,
    };
  }, []);

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
            <div className="metric-value">{new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK", maximumFractionDigits: 0 }).format(report.totalRevenue)}</div>
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
                {mockSales.map((day) => (
                  <tr key={day.id}>
                    <td>{day.date}</td>
                    <td>{new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK", maximumFractionDigits: 0 }).format(day.revenue)}</td>
                    <td>{day.orders}</td>
                    <td>{((day.laborCost / day.revenue) * 100).toFixed(1)}%</td>
                    <td>{day.peakLabel}</td>
                  </tr>
                ))}
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
              <span className="status-chip status-success">{mockLogs.filter((task) => task.status === "done").length}</span>
            </div>
            <div className="list-row">
              <div className="list-row-main">
                <div className="list-row-title">Coverage quality</div>
                <div className="list-row-copy">Review understaffed days and compare with sales pressure.</div>
              </div>
              <span className="status-chip status-warning">
                {mockShifts.filter((shift) => shift.role === "shiftleader").length < 7 ? "Needs review" : "Healthy"}
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
