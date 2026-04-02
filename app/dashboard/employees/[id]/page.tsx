"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Clock3, Mail, MapPin, MessageCircleMore, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/LanguageContext";
import { getLocationName, mockEmployeeActivity, mockShifts } from "@/lib/mock-data";
import { getEmployees } from "@/lib/supabase";
import type { Employee } from "@/lib/types";

function shiftHours(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  return (eh * 60 + em - (sh * 60 + sm)) / 60;
}

export default function EmployeeProfilePage() {
  const { lang } = useLanguage();
  const params = useParams<{ id: string }>();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const rows = await getEmployees();
      if (!active) return;
      setEmployee(rows.find((row) => row.id === params.id) ?? null);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [params.id]);

  const shifts = useMemo(
    () =>
      mockShifts
        .filter((shift) => shift.employeeId === params.id)
        .sort((a, b) => `${b.date}${b.startTime}`.localeCompare(`${a.date}${a.startTime}`)),
    [params.id]
  );

  const activity = useMemo(
    () =>
      mockEmployeeActivity
        .filter((item) => item.employeeId === params.id)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 6),
    [params.id]
  );

  const recentHours = shifts.slice(0, 5).reduce(
    (sum, shift) => sum + shiftHours(shift.startTime, shift.endTime),
    0
  );

  if (loading) {
    return <div className="app-panel px-5 py-10 text-sm text-slate-600">Loading profile...</div>;
  }

  if (!employee) {
    return <div className="app-panel px-5 py-10 text-sm text-slate-600">Team member not found.</div>;
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="outline" className="w-fit">
        <Link href="/dashboard/employees">
          <ArrowLeft className="h-4 w-4" />
          {lang === "sv" ? "Tillbaka till teamet" : "Back to team"}
        </Link>
      </Button>

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="app-panel p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-[-0.03em] text-slate-950">{employee.name}</h2>
              <p className="mt-2 text-sm text-slate-600">{employee.role} • {employee.employmentType}</p>
            </div>
            <span className={`status-chip ${employee.role === "shiftleader" ? "status-warning" : employee.role === "rutin" ? "status-info" : "status-neutral"}`}>
              {employee.role}
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="app-panel-muted p-4">
              <div className="metric-label">Location</div>
              <div className="mt-2 inline-flex items-center gap-2 text-sm text-slate-800">
                <MapPin className="h-4 w-4 text-slate-400" />
                {getLocationName(employee.locationId)}
              </div>
            </div>
            <div className="app-panel-muted p-4">
              <div className="metric-label">Phone</div>
              <div className="mt-2 inline-flex items-center gap-2 text-sm text-slate-800">
                <Phone className="h-4 w-4 text-slate-400" />
                {employee.phone}
              </div>
            </div>
            <div className="app-panel-muted p-4">
              <div className="metric-label">Contract</div>
              <div className="mt-2 text-sm font-semibold text-slate-950">
                {employee.contractHours}h / {employee.maxWeeklyHours}h
              </div>
            </div>
            <div className="app-panel-muted p-4">
              <div className="metric-label">Recent 5 shifts</div>
              <div className="mt-2 text-sm font-semibold text-slate-950">{recentHours.toFixed(1)}h</div>
            </div>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <Button asChild>
              <Link href="/dashboard/chat">
                <MessageCircleMore className="h-4 w-4" />
                {lang === "sv" ? "Skicka meddelande" : "Send message"}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard/schedule?tab=day">
                <Clock3 className="h-4 w-4" />
                {lang === "sv" ? "Justera pass" : "Adjust shifts"}
              </Link>
            </Button>
          </div>
        </div>

        <div className="app-panel p-5">
          <h3 className="section-title">Recent shifts</h3>
          <div className="mt-4 list-block">
            {shifts.slice(0, 6).map((shift) => (
              <div key={shift.id} className="list-row">
                <div className="list-row-main">
                  <div className="list-row-title">{shift.date}</div>
                  <div className="list-row-copy">{shift.startTime.slice(0, 5)}-{shift.endTime.slice(0, 5)} • {shift.role}</div>
                </div>
                <span className={`status-chip ${shift.status === "published" ? "status-success" : "status-neutral"}`}>
                  {shift.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="app-panel p-5">
        <h3 className="section-title">Recent activity</h3>
        <div className="mt-4 list-block">
          {activity.map((item) => (
            <div key={item.id} className="list-row">
              <div className="list-row-main">
                <div className="list-row-title">{item.title}</div>
                <div className="list-row-copy">{item.detail}</div>
              </div>
              <div className="inline-flex items-center gap-2 text-xs text-slate-500">
                <Mail className="h-3.5 w-3.5" />
                {new Date(item.timestamp).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
