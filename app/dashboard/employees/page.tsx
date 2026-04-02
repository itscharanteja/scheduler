"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Clock3, MapPin, Phone, Plus, Search } from "lucide-react";
import { startOfWeek } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/context/LanguageContext";
import {
  createEmployee,
  getEmployees,
  getLocations,
  getShiftsByWeek,
  type CreateEmployeeInput,
} from "@/lib/supabase";
import type { Employee, Location, Shift } from "@/lib/types";

type FormState = {
  name: string;
  role: string;
  phone: string;
  contractHours: string;
};

const emptyForm: FormState = {
  name: "",
  role: "service",
  phone: "",
  contractHours: "20",
};

function roleClass(role: string) {
  if (role === "shiftleader") return "status-warning";
  if (role === "rutin") return "status-info";
  return "status-neutral";
}

export default function EmployeesDashboardPage() {
  const { lang } = useLanguage();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [weekShifts, setWeekShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
        const [emps, locs, schedule] = await Promise.all([
          getEmployees(),
          getLocations(),
          getShiftsByWeek(weekStart),
        ]);
        if (!active) return;
        setEmployees(emps);
        setLocations(locs);
        setWeekShifts(schedule.shifts);
      } catch (error) {
        console.error(error);
        toast.error("Could not load employee data");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const text =
    lang === "sv"
      ? {
          search: "Sök namn, roll eller enhet",
          add: "Lägg till person",
          total: "Totalt i teamet",
          onShift: "På pass idag",
          avgHours: "Snitt kontraktstimmar",
          now: "Jobbar nu",
          availability: "Tillgänglighet",
          role: "Roll",
          create: "Skapa person",
          cancel: "Avbryt",
          empty: "Ingen person matchar nuvarande filter.",
          phone: "Telefon",
          contract: "Kontrakt",
        }
      : {
          search: "Search name, role, or location",
          add: "Add person",
          total: "Total team members",
          onShift: "On shift today",
          avgHours: "Average contract hours",
          now: "Working now",
          availability: "Availability",
          role: "Role",
          create: "Create person",
          cancel: "Cancel",
          empty: "No team members match the current filters.",
          phone: "Phone",
          contract: "Contract",
        };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const rows = await getEmployees();
        if (mounted) {
          setEmployees(rows);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const today = new Date().toISOString().split("T")[0];
  const onShiftIds = new Set(weekShifts.filter((shift) => shift.date === today).map((shift) => shift.employeeId));

  const getLocationName = (locationId: string): string => {
    return locations.find((loc) => loc.id === locationId)?.name ?? "Unknown";
  };

  const filtered = useMemo(() => {
    return employees.filter((employee) => {
      const haystack = `${employee.name} ${employee.role} ${getLocationName(employee.locationId)}`.toLowerCase();
      return (
        (search.trim() ? haystack.includes(search.trim().toLowerCase()) : true) &&
        (roleFilter === "all" ? true : employee.role === roleFilter)
      );
    });
  }, [employees, locations, roleFilter, search]);

  const summary = useMemo(() => {
    const totalHours =
      employees.length > 0
        ? employees.reduce((sum, employee) => sum + employee.contractHours, 0) / employees.length
        : 0;
    return {
      total: employees.length,
      onShift: onShiftIds.size,
      average: totalHours,
    };
  }, [employees, onShiftIds.size]);

  async function handleCreateEmployee() {
    setSaving(true);
    try {
      const payload: CreateEmployeeInput = {
        name: form.name.trim(),
        role: form.role,
        contractHours: Number(form.contractHours || 0),
        maxWeeklyHours: Number(form.contractHours || 0) + 4,
        employmentType: "part-time",
        phone: form.phone.trim(),
        locationId: locations[0]?.id ?? "",
        hourlyRate: form.role === "shiftleader" ? 210 : 172,
      };
      const created = await createEmployee(payload);
      setEmployees((prev) => [created, ...prev]);
      setForm(emptyForm);
      setIsCreateOpen(false);
      toast.success("Team member created");
    } catch (error) {
      console.error(error);
      toast.error("Could not create team member");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="app-panel p-5">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="metric-card">
              <div className="metric-label">{text.total}</div>
              <div className="metric-value">{summary.total}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">{text.onShift}</div>
              <div className="metric-value">{summary.onShift}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">{text.avgHours}</div>
              <div className="metric-value">{summary.average.toFixed(0)}h</div>
            </div>
          </div>
        </div>

        <div className="app-panel p-5">
          <div className="flex flex-wrap items-center gap-3">
            <label className="relative min-w-[240px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={text.search}
                className="pl-9"
              />
            </label>
            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
              className="filter-input min-w-[170px]"
            >
              <option value="all">All roles</option>
              <option value="service">Service</option>
              <option value="shiftleader">Shift leader</option>
              <option value="rutin">Rutin</option>
            </select>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              {text.add}
            </Button>
          </div>
        </div>
      </section>

      <section className="app-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="ops-table min-w-[900px]">
            <thead>
              <tr>
                <th>Name</th>
                <th>{text.role}</th>
                <th>Store</th>
                <th>{text.availability}</th>
                <th>{text.phone}</th>
                <th>{text.contract}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-sm text-slate-600">Loading team...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-slate-600">{text.empty}</td>
                </tr>
              ) : (
                filtered.map((employee) => {
                  const workingNow = onShiftIds.has(employee.id);
                  return (
                    <tr key={employee.id}>
                      <td>
                        <div className="font-semibold text-slate-950">{employee.name}</div>
                        <div className="mt-1 text-sm text-slate-600">{employee.employmentType}</div>
                      </td>
                      <td>
                        <span className={`status-chip ${roleClass(employee.role)}`}>{employee.role}</span>
                      </td>
                      <td>
                        <div className="inline-flex items-center gap-2 text-sm text-slate-700">
                          <MapPin className="h-4 w-4 text-slate-400" />
                          {getLocationName(employee.locationId)}
                        </div>
                      </td>
                      <td>
                        <span className={`status-chip ${workingNow ? "status-success" : "status-neutral"}`}>
                          {workingNow ? text.now : "Off shift"}
                        </span>
                      </td>
                      <td>
                        <div className="inline-flex items-center gap-2 text-sm text-slate-700">
                          <Phone className="h-4 w-4 text-slate-400" />
                          {employee.phone}
                        </div>
                      </td>
                      <td>
                        <div className="inline-flex items-center gap-2 text-sm text-slate-700">
                          <Clock3 className="h-4 w-4 text-slate-400" />
                          {employee.contractHours}h / {employee.maxWeeklyHours}h
                        </div>
                      </td>
                      <td>
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/dashboard/employees/${employee.id}`}>Open</Link>
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{text.add}</DialogTitle>
            <DialogDescription>Add a team member for scheduling and task assignment.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="Name" />
            <select
              value={form.role}
              onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value }))}
              className="filter-input"
            >
              <option value="service">Service</option>
              <option value="shiftleader">Shift leader</option>
              <option value="rutin">Rutin</option>
            </select>
            <Input value={form.phone} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} placeholder={text.phone} />
            <Input value={form.contractHours} onChange={(event) => setForm((prev) => ({ ...prev, contractHours: event.target.value }))} placeholder={text.contract} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>{text.cancel}</Button>
            <Button onClick={() => void handleCreateEmployee()} disabled={saving || !form.name.trim()}>
              {text.create}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
