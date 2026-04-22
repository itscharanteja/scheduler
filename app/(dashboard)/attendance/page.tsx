"use client";

import { useEffect, useState, useMemo } from "react";
import { format, startOfWeek, endOfWeek, differenceInMinutes } from "date-fns";
import { Clock, RefreshCw, Filter } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "@/context/LocationContext";
import { useLanguage } from "@/context/LanguageContext";
import type { AttendanceSessionWithEmployee } from "@/lib/supabase/attendance";

function formatTimeShort(iso: string) {
  return format(new Date(iso), "HH:mm");
}

function formatDateShort(iso: string) {
  return format(new Date(iso), "MMM d");
}

function calcDuration(clockedInAt: string, clockedOutAt: string | null): string {
  if (!clockedOutAt) return "—";
  const mins = differenceInMinutes(new Date(clockedOutAt), new Date(clockedInAt));
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function calcTotalMins(sessions: AttendanceSessionWithEmployee[]): number {
  return sessions.reduce((sum, s) => {
    if (!s.clockedOutAt) return sum;
    return sum + differenceInMinutes(new Date(s.clockedOutAt), new Date(s.clockedInAt));
  }, 0);
}

function formatTotalHours(mins: number): string {
  if (mins === 0) return "0h";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function AttendancePage() {
  const { hasRole } = useAuth();
  const { locationId } = useLocation();
  const { lang } = useLanguage();

  const now = new Date();
  const defaultFrom = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const defaultTo = format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");

  const [sessions, setSessions] = useState<AttendanceSessionWithEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [employeeFilter, setEmployeeFilter] = useState("all");

  // Redirect non-admins
  if (!hasRole("admin", "super_admin")) {
    return (
      <div className="app-panel px-5 py-16 text-center">
        <p className="text-sm text-slate-500">
          {lang === "sv" ? "Åtkomst nekad." : "Access denied."}
        </p>
      </div>
    );
  }

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from, to });
      if (locationId) params.set("locationId", locationId);
      const res = await fetch(`/api/attendance/report?${params}`);
      if (!res.ok) throw new Error("Failed to load");
      const { sessions: data } = await res.json();
      setSessions(data ?? []);
    } catch {
      toast.error("Could not load attendance records");
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [locationId, from, to]);

  // Unique employee names for filter dropdown
  const employeeNames = useMemo(() => {
    const names = [...new Set(sessions.map((s) => s.employeeName))].sort();
    return names;
  }, [sessions]);

  const filtered = useMemo(() => {
    if (employeeFilter === "all") return sessions;
    return sessions.filter((s) => s.employeeName === employeeFilter);
  }, [sessions, employeeFilter]);

  // Per-employee totals
  const totals = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((s) => {
      if (!s.clockedOutAt) return;
      map[s.employeeName] =
        (map[s.employeeName] ?? 0) +
        differenceInMinutes(new Date(s.clockedOutAt), new Date(s.clockedInAt));
    });
    return map;
  }, [filtered]);

  return (
    <div className="app-panel flex flex-col gap-4 p-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-slate-500" />
          <h1 className="text-lg font-semibold text-slate-900">
            {lang === "sv" ? "Närvaro" : "Attendance"}
          </h1>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading} className="gap-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          {lang === "sv" ? "Uppdatera" : "Refresh"}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-xs text-slate-500">{lang === "sv" ? "Från" : "From"}</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-300"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500">{lang === "sv" ? "Till" : "To"}</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-300"
          />
        </div>
        <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
          <SelectTrigger className="h-7 w-44 text-xs">
            <SelectValue placeholder={lang === "sv" ? "Alla anställda" : "All employees"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {lang === "sv" ? "Alla anställda" : "All employees"}
            </SelectItem>
            {employeeNames.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 rounded bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">
          {lang === "sv" ? "Inga poster för vald period." : "No records for the selected period."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-xs text-slate-500">
                <th className="px-4 py-2.5 text-left font-medium">
                  {lang === "sv" ? "Anställd" : "Employee"}
                </th>
                <th className="px-4 py-2.5 text-left font-medium">
                  {lang === "sv" ? "Datum" : "Date"}
                </th>
                <th className="px-4 py-2.5 text-left font-medium">
                  {lang === "sv" ? "Incheckad" : "Clocked In"}
                </th>
                <th className="px-4 py-2.5 text-left font-medium">
                  {lang === "sv" ? "Utcheckad" : "Clocked Out"}
                </th>
                <th className="px-4 py-2.5 text-left font-medium">
                  {lang === "sv" ? "Tid" : "Duration"}
                </th>
                <th className="px-4 py-2.5 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((s) => (
                <tr key={s.id} className="bg-white hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-slate-800">{s.employeeName}</td>
                  <td className="px-4 py-2.5 text-slate-600">{formatDateShort(s.clockedInAt)}</td>
                  <td className="px-4 py-2.5 text-slate-600">{formatTimeShort(s.clockedInAt)}</td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {s.clockedOutAt ? formatTimeShort(s.clockedOutAt) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {calcDuration(s.clockedInAt, s.clockedOutAt)}
                  </td>
                  <td className="px-4 py-2.5">
                    {!s.clockedOutAt ? (
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-xs">
                        {lang === "sv" ? "Aktiv" : "Active"}
                      </Badge>
                    ) : (
                      <Badge className="bg-slate-100 text-slate-500 hover:bg-slate-100 text-xs">
                        {lang === "sv" ? "Avslutad" : "Done"}
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Per-employee summary */}
      {!loading && Object.keys(totals).length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="mb-2 text-xs font-medium text-slate-500 uppercase tracking-wide">
            {lang === "sv" ? "Totalt per anställd (filtrerat)" : "Total per employee (filtered)"}
          </p>
          <div className="flex flex-wrap gap-3">
            {Object.entries(totals).map(([name, mins]) => (
              <div key={name} className="flex items-center gap-1.5 text-sm">
                <span className="font-medium text-slate-700">{name}</span>
                <span className="text-slate-500">{formatTotalHours(mins)}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {lang === "sv" ? "Totalt: " : "Grand total: "}
            <span className="font-medium text-slate-600">
              {formatTotalHours(calcTotalMins(filtered))}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
