"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { startOfWeek } from "date-fns";
import { ArrowLeft, Check, Clock3, Mail, MapPin, MessageCircleMore, Pencil, Phone, Shield, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { getEmployees, getLocations, getShiftsByWeek, getEmployeeActivity, updateEmployee } from "@/lib/supabase";
import type { Employee, EmployeeActivityItem, Location, Shift } from "@/lib/types";

type AccountProfile = { role: string; fullName: string };

function shiftHours(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  return (eh * 60 + em - (sh * 60 + sm)) / 60;
}

function suggestedRole(empRole: string): string {
  return empRole === "shiftleader" ? "user_lead" : "user";
}

export default function EmployeeProfilePage() {
  const { lang } = useLanguage();
  const { hasRole } = useAuth();
  const params = useParams<{ id: string }>();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [weekShifts, setWeekShifts] = useState<Shift[]>([]);
  const [activity, setActivity] = useState<EmployeeActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Role editing state
  const [isEditingRole, setIsEditingRole] = useState(false);
  const [editingRole, setEditingRole] = useState("");
  const [savingRole, setSavingRole] = useState(false);

  // Account management state
  const [accountProfile, setAccountProfile] = useState<AccountProfile | null | undefined>(undefined);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("user");
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
        const [rows, locs, schedule, activityData] = await Promise.all([
          getEmployees(),
          getLocations(),
          getShiftsByWeek(weekStart),
          getEmployeeActivity(params.id, 6),
        ]);
        if (!active) return;
        setEmployee(rows.find((row) => row.id === params.id) ?? null);
        setLocations(locs);
        setWeekShifts(schedule.shifts);
        setActivity(activityData);

        // Check if this employee already has an app account (admin+ only)
        if (hasRole("admin", "super_admin")) {
          fetch(`/api/admin/invite-employee?employeeId=${params.id}`)
            .then((r) => r.json())
            .then((d) => {
              if (active) setAccountProfile(d.hasAccount ? d.profile : null);
            })
            .catch(() => { if (active) setAccountProfile(null); });
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [params.id, hasRole]);

  async function handleInvite() {
    if (!employee || !inviteEmail.trim()) return;
    setInviting(true);
    try {
      const res = await fetch("/api/admin/invite-employee", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          employeeId: employee.id,
          email: inviteEmail.trim(),
          appRole: inviteRole,
          fullName: employee.name,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send invite");
      toast.success(`Invite sent to ${inviteEmail.trim()}`);
      setAccountProfile({ role: inviteRole, fullName: employee.name });
      setIsInviteOpen(false);
      setInviteEmail("");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to send invite");
    } finally {
      setInviting(false);
    }
  }

  async function handleSaveRole() {
    if (!employee || !editingRole || editingRole === employee.role) {
      setIsEditingRole(false);
      return;
    }
    setSavingRole(true);
    try {
      const updated = await updateEmployee(employee.id, { role: editingRole });
      setEmployee(updated);
      setIsEditingRole(false);
      toast.success(lang === "sv" ? "Roll uppdaterad" : "Role updated");
    } catch {
      toast.error(lang === "sv" ? "Kunde inte uppdatera rollen" : "Could not update role");
    } finally {
      setSavingRole(false);
    }
  }

  const shifts = useMemo(
    () =>
      weekShifts
        .filter((shift) => shift.employeeId === params.id)
        .sort((a, b) => `${b.date}${b.startTime}`.localeCompare(`${a.date}${a.startTime}`)),
    [params.id, weekShifts]
  );

  const getLocationName = (locationId: string): string => {
    return locations.find((loc) => loc.id === locationId)?.name ?? "Unknown";
  };


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
      <div className="page-header">
        <div>
          <h1 className="page-title">{employee.name}</h1>
          <p className="page-subtitle">{employee.role} • {employee.employmentType}</p>
        </div>
        <div className="toolbar-row">
          <span className="status-chip status-neutral">{employee.role}</span>
          <Button asChild variant="outline" size="sm">
            <Link href="/employees">
              <ArrowLeft className="h-4 w-4" />
              {lang === "sv" ? "Tillbaka till teamet" : "Back to team"}
            </Link>
          </Button>
        </div>
      </div>

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="app-panel p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">{employee.name}</h2>
              <p className="mt-1 text-sm text-slate-600">{employee.employmentType}</p>
            </div>
            {hasRole("admin", "super_admin") && (
              isEditingRole ? (
                <div className="flex items-center gap-2">
                  <Select value={editingRole} onValueChange={setEditingRole}>
                    <SelectTrigger className="h-8 w-36 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="service">service</SelectItem>
                      <SelectItem value="shiftleader">shiftleader</SelectItem>
                      <SelectItem value="rutin">rutin</SelectItem>
                    </SelectContent>
                  </Select>
                  <button
                    type="button"
                    onClick={() => void handleSaveRole()}
                    disabled={savingRole}
                    className="rounded-lg p-1.5 text-green-600 hover:bg-green-50 disabled:opacity-50"
                    title={lang === "sv" ? "Spara" : "Save"}
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingRole(false)}
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                    title={lang === "sv" ? "Avbryt" : "Cancel"}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => { setEditingRole(employee.role); setIsEditingRole(true); }}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                  title={lang === "sv" ? "Redigera roll" : "Edit role"}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {employee.role}
                </button>
              )
            )}
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
              <Link href="/chat">
                <MessageCircleMore className="h-4 w-4" />
                {lang === "sv" ? "Skicka meddelande" : "Send message"}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/schedule?tab=day">
                <Clock3 className="h-4 w-4" />
                {lang === "sv" ? "Justera pass" : "Adjust shifts"}
              </Link>
            </Button>
          </div>

          {hasRole("admin", "super_admin") && (
            <div className="mt-4 border-t pt-4">
              {accountProfile ? (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Shield className="h-4 w-4 text-slate-400" />
                  {lang === "sv" ? "Appkonto:" : "App account:"}
                  <span className="font-medium text-slate-900">{accountProfile.role}</span>
                </div>
              ) : accountProfile === null ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setInviteRole(suggestedRole(employee.role));
                    setIsInviteOpen(true);
                  }}
                >
                  <UserPlus className="h-4 w-4" />
                  {lang === "sv" ? "Skapa appkonto" : "Create App Account"}
                </Button>
              ) : null /* still loading */}
            </div>
          )}
        </div>

        <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{lang === "sv" ? "Skapa appkonto" : "Create App Account"}</DialogTitle>
              <DialogDescription>
                {lang === "sv"
                  ? `Bjud in ${employee.name} via e-post. De får en länk för att sätta sitt lösenord.`
                  : `Invite ${employee.name} by email. They'll receive a link to set their password.`}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-1.5">
                <label htmlFor="invite-email" className="text-sm font-medium text-slate-700">Email</label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="name@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <label htmlFor="invite-role" className="text-sm font-medium text-slate-700">{lang === "sv" ? "Roll" : "Role"}</label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger id="invite-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {hasRole("super_admin") && (
                      <SelectItem value="admin">Admin</SelectItem>
                    )}
                    <SelectItem value="user_lead">User Lead</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsInviteOpen(false)}>
                {lang === "sv" ? "Avbryt" : "Cancel"}
              </Button>
              <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
                {inviting
                  ? (lang === "sv" ? "Skickar..." : "Sending...")
                  : (lang === "sv" ? "Skicka inbjudan" : "Send Invite")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
          {activity.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-slate-500">No activity recorded yet.</div>
          ) : (
            activity.map((item) => (
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
            ))
          )}
        </div>
      </section>
    </div>
  );
}
