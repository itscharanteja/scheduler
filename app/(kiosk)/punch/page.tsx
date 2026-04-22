"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, LogIn, LogOut, Bookmark, ArrowLeft, CheckCircle } from "lucide-react";
import type { KioskEmployee, AttendanceSession } from "@/lib/supabase/attendance";

type Screen = "grid" | "confirm" | "done" | "invalid";

type EmployeeWithStatus = KioskEmployee & {
  activeSession: AttendanceSession | null;
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function LiveClock() {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
  useEffect(() => {
    const id = setInterval(() => {
      setTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    }, 10_000);
    return () => clearInterval(id);
  }, []);
  return <span>{time}</span>;
}

function PunchContent() {
  const searchParams = useSearchParams();
  const locationId = searchParams.get("loc");

  const [screen, setScreen] = useState<Screen>(locationId ? "grid" : "invalid");
  const [locationName, setLocationName] = useState<string>("");
  const [employees, setEmployees] = useState<EmployeeWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<EmployeeWithStatus | null>(null);
  const [punching, setPunching] = useState(false);
  const [doneMsg, setDoneMsg] = useState("");
  const [error, setError] = useState("");

  const loadEmployees = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    setError("");
    try {
      // Fetch employee list
      const empRes = await fetch(`/api/punch/employees?loc=${locationId}`);
      if (!empRes.ok) throw new Error("Failed to load employees");
      const { employees: empList }: { employees: KioskEmployee[] } = await empRes.json();

      // Fetch active session for each employee in parallel
      const withStatus = await Promise.all(
        empList.map(async (emp) => {
          try {
            const statusRes = await fetch(`/api/punch/status?employeeId=${emp.id}`);
            if (!statusRes.ok) return { ...emp, activeSession: null };
            const { session } = await statusRes.json();
            return { ...emp, activeSession: session ?? null };
          } catch {
            return { ...emp, activeSession: null };
          }
        }),
      );

      setEmployees(withStatus);

      // Try to get the location name from the first employee's location
      // (we just show a generic header if unavailable)
      setLocationName("Web Punch");
    } catch {
      setError("Unable to load employees. Please check the kiosk link.");
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    if (locationId) {
      loadEmployees();
    }
  }, [locationId, loadEmployees]);

  async function handlePunch() {
    if (!selected || !locationId) return;
    const action = selected.activeSession ? "clock_out" : "clock_in";
    setPunching(true);
    setError("");

    try {
      const res = await fetch("/api/punch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId, employeeId: selected.id, action }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Punch failed");
      }

      const { session }: { session: AttendanceSession } = await res.json();
      const timeStr = formatTime(
        action === "clock_in" ? session.clockedInAt : (session.clockedOutAt ?? new Date().toISOString()),
      );
      setDoneMsg(
        action === "clock_in"
          ? `Clocked in at ${timeStr}`
          : `Clocked out at ${timeStr}`,
      );
      setScreen("done");

      // Auto-return to grid after 2.5 seconds
      setTimeout(() => {
        setSelected(null);
        setDoneMsg("");
        loadEmployees();
        setScreen("grid");
      }, 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Punch failed");
    } finally {
      setPunching(false);
    }
  }

  // ---------- Invalid link ----------
  if (screen === "invalid") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <Card className="w-full max-w-sm text-center">
          <CardContent className="pt-8 pb-8 space-y-3">
            <Clock className="mx-auto h-10 w-10 text-slate-400" />
            <p className="font-semibold text-slate-800">Invalid kiosk link</p>
            <p className="text-sm text-slate-500">
              This link is missing a location code. Ask your manager to share the correct kiosk URL.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---------- Done confirmation ----------
  if (screen === "done") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <CheckCircle className="h-14 w-14 text-green-500" />
          <p className="text-xl font-semibold text-slate-800">{selected?.name}</p>
          <p className="text-base text-slate-600">{doneMsg}</p>
        </div>
      </div>
    );
  }

  // ---------- Confirm punch ----------
  if (screen === "confirm" && selected) {
    const isClockedIn = Boolean(selected.activeSession);
    return (
      <div className="flex min-h-screen flex-col bg-slate-50">
        {/* Header */}
        <div className="flex items-center gap-3 border-b bg-white px-4 py-3">
          <button
            onClick={() => { setSelected(null); setScreen("grid"); setError(""); }}
            className="rounded-full p-1.5 hover:bg-slate-100 transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5 text-slate-600" />
          </button>
          <span className="text-sm font-medium text-slate-700">{locationName}</span>
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
          {/* Avatar */}
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-200 text-2xl font-bold text-slate-600">
            {selected.name.charAt(0).toUpperCase()}
          </div>

          <div className="text-center">
            <p className="text-2xl font-semibold text-slate-900">{selected.name}</p>
            <p className="text-sm text-slate-500 capitalize mt-1">{selected.role}</p>
          </div>

          {isClockedIn && selected.activeSession && (
            <p className="text-sm text-slate-500">
              Clocked in at{" "}
              <span className="font-medium text-slate-700">
                {formatTime(selected.activeSession.clockedInAt)}
              </span>
            </p>
          )}

          {error && (
            <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <Button
            size="lg"
            className={`w-full max-w-xs h-14 text-base font-semibold gap-2 ${
              isClockedIn
                ? "bg-red-500 hover:bg-red-600 text-white"
                : "bg-green-600 hover:bg-green-700 text-white"
            }`}
            onClick={handlePunch}
            disabled={punching}
          >
            {isClockedIn ? (
              <><LogOut className="h-5 w-5" /> {punching ? "Clocking out…" : "Clock Out"}</>
            ) : (
              <><LogIn className="h-5 w-5" /> {punching ? "Clocking in…" : "Clock In"}</>
            )}
          </Button>

          <button
            onClick={() => { setSelected(null); setScreen("grid"); setError(""); }}
            className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ---------- Employee grid ----------
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-slate-500" />
          <span className="font-semibold text-slate-800">{locationName || "Punch"}</span>
        </div>
        <span className="text-sm font-mono text-slate-500">
          <LiveClock />
        </span>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-slate-200 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <p className="text-sm text-red-600">{error}</p>
            <Button size="sm" variant="outline" onClick={loadEmployees}>
              Try again
            </Button>
          </div>
        ) : employees.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-400">No employees found for this location.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {employees.map((emp) => {
              const isClockedIn = Boolean(emp.activeSession);
              return (
                <button
                  key={emp.id}
                  onClick={() => { setSelected(emp); setScreen("confirm"); setError(""); }}
                  className="flex flex-col items-center gap-2 rounded-xl border bg-white p-4 text-center shadow-sm transition-all hover:shadow-md active:scale-95"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-lg font-bold text-slate-600">
                    {emp.name.charAt(0).toUpperCase()}
                  </div>
                  <p className="text-sm font-medium text-slate-800 leading-tight">{emp.name}</p>
                  <Badge
                    className={`text-xs px-2 py-0.5 ${
                      isClockedIn
                        ? "bg-green-100 text-green-700 hover:bg-green-100"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    {isClockedIn ? "IN" : "OUT"}
                  </Badge>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer — Add to Home Screen hint */}
      <div className="border-t bg-white px-4 py-3">
        <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
          <Bookmark className="h-3.5 w-3.5" />
          <span>Add to Home Screen for quick access — use your browser&apos;s menu → Add to Home Screen</span>
        </div>
      </div>
    </div>
  );
}

export default function PunchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <Clock className="h-8 w-8 animate-pulse text-slate-300" />
        </div>
      }
    >
      <PunchContent />
    </Suspense>
  );
}
