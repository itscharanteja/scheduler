"use client";

import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import {
  getEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  isSupabaseConfigured,
  type CreateEmployeeInput,
  type UpdateEmployeeInput,
} from "@/lib/supabase";
import type { Employee } from "@/lib/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, Trash2, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

type EmployeeFormState = {
  name: string;
  role: string;
  employmentType: "full-time" | "part-time" | "hourly";
  contractHours: string;
  maxWeeklyHours: string;
  hourlyRate: string;
  phone: string;
};

const emptyForm: EmployeeFormState = {
  name: "",
  role: "service",
  employmentType: "full-time",
  contractHours: "",
  maxWeeklyHours: "",
  hourlyRate: "",
  phone: "",
};

function roleColor(role: string): string {
  switch (role) {
    case "service":
      return "bg-sky-500/20 text-sky-300 border-sky-500/40";
    case "shiftleader":
      return "bg-[#e8b84b]/20 text-[#e8b84b] border-[#e8b84b]/50";
    case "rutin":
      return "bg-purple-500/20 text-purple-300 border-purple-500/40";
    default:
      return "bg-zinc-700/40 text-zinc-200 border-zinc-500/40";
  }
}

function employmentColor(type: Employee["employmentType"]): string {
  switch (type) {
    case "full-time":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/40";
    case "part-time":
      return "bg-sky-500/15 text-sky-300 border-sky-500/40";
    case "hourly":
    default:
      return "bg-purple-500/15 text-purple-300 border-purple-500/40";
  }
}

export default function EmployeesDashboardPage() {
  const { t } = useLanguage();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [form, setForm] = useState<EmployeeFormState>(emptyForm);

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<Employee | null>(
    null
  );

  useEffect(() => {
    let isActive = true;
    (async () => {
      try {
        setLoading(true);
        const data = await getEmployees();
        if (!isActive) return;
        setEmployees(data);
      } catch (err) {
        console.error(err);
        if (!isActive) return;
        setError(err instanceof Error ? err.message : "Failed to load employees.");
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    })();
    return () => {
      isActive = false;
    };
  }, []);

  const stats = useMemo(() => {
    const total = employees.length;
    const fullTime = employees.filter(
      (e) => e.employmentType === "full-time"
    ).length;
    const partTime = employees.filter(
      (e) => e.employmentType === "part-time"
    ).length;
    const totalHours = employees.reduce(
      (sum, e) => sum + (e.contractHours || 0),
      0
    );
    return { total, fullTime, partTime, totalHours };
  }, [employees]);

  const roleOptions: { value: string; label: string }[] = [
    { value: "service", label: t("role.service") },
    { value: "shiftleader", label: t("role.shiftleader") },
    { value: "rutin", label: t("role.rutin") },
  ];

  const employmentOptions: {
    value: Employee["employmentType"];
    label: string;
  }[] = [
    { value: "full-time", label: t("employment.fullTime") },
    { value: "part-time", label: t("employment.partTime") },
    { value: "hourly", label: t("employment.hourly") },
  ];

  function openCreate() {
    setEditingEmployee(null);
    setForm(emptyForm);
    setIsFormOpen(true);
  }

  function openEdit(emp: Employee) {
    setEditingEmployee(emp);
    setForm({
      name: emp.name,
      role: emp.role,
      employmentType: emp.employmentType,
      contractHours: emp.contractHours.toString(),
      maxWeeklyHours: emp.maxWeeklyHours.toString(),
      hourlyRate:
        typeof emp.hourlyRate === "number" ? emp.hourlyRate.toString() : "",
      phone: emp.phone,
    });
    setIsFormOpen(true);
  }

  function closeForm() {
    setIsFormOpen(false);
    setEditingEmployee(null);
    setForm(emptyForm);
  }

  async function handleSubmit() {
    if (!isSupabaseConfigured) {
      setError(t("employees.supabaseNotConfigured"));
      return;
    }
    try {
      setSaving(true);
      setError(null);

      const payload: CreateEmployeeInput = {
        name: form.name.trim(),
        role: form.role,
        contractHours: Number(form.contractHours || 0),
        maxWeeklyHours: Number(form.maxWeeklyHours || 0),
        employmentType: form.employmentType,
        phone: form.phone.trim(),
        hourlyRate: form.hourlyRate ? Number(form.hourlyRate) : undefined,
      };

      if (editingEmployee) {
        const updated = await updateEmployee(editingEmployee.id, payload as UpdateEmployeeInput);
        setEmployees((prev) =>
          prev.map((e) => (e.id === updated.id ? updated : e))
        );
        toast.success("Employee saved");
      } else {
        const created = await createEmployee(payload);
        setEmployees((prev) => [created, ...prev]);
        toast.success("Employee saved");
      }

      closeForm();
    } catch (err) {
      console.error(err);
      setError("Failed to save employee.");
      toast.error("Failed to save — try again");
    } finally {
      setSaving(false);
    }
  }

  function openDelete(emp: Employee) {
    setSelectedForDelete(emp);
    setIsDeleteOpen(true);
  }

  function closeDelete() {
    setSelectedForDelete(null);
    setIsDeleteOpen(false);
  }

  async function handleDelete() {
    if (!selectedForDelete) return;
    if (!isSupabaseConfigured) {
      setError(t("employees.supabaseNotConfigured"));
      return;
    }
    try {
      setDeleting(true);
      setError(null);
      await deleteEmployee(selectedForDelete.id);
      setEmployees((prev) =>
        prev.filter((e) => e.id !== selectedForDelete.id)
      );
      toast.success("Employee saved");
      closeDelete();
    } catch (err) {
      console.error(err);
      setError("Failed to delete employee.");
      toast.error("Failed to save — try again");
    } finally {
      setDeleting(false);
    }
  }

  const hasEmployees = employees.length > 0;

  return (
    <div className="space-y-6">
      {!isSupabaseConfigured && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-950/40 px-4 py-3 text-sm text-amber-200">
          {t("employees.supabaseNotConfigured")}
        </div>
      )}

      {/* Summary stats */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-4">
          <Card className="border-[#2a2a2a] bg-[#141414]">
            <CardContent className="py-3 px-4">
              <div className="text-xs text-[#888888]">
                {t("employees.summary.total")}
              </div>
              <div className="mt-1 text-lg font-mono text-[#f0f0f0]">
                {stats.total}
              </div>
            </CardContent>
          </Card>
          <Card className="border-[#2a2a2a] bg-[#141414]">
            <CardContent className="py-3 px-4">
              <div className="text-xs text-[#888888]">
                {t("employees.summary.fullTime")}
              </div>
              <div className="mt-1 text-lg font-mono text-[#f0f0f0]">
                {stats.fullTime}
              </div>
            </CardContent>
          </Card>
          <Card className="border-[#2a2a2a] bg-[#141414]">
            <CardContent className="py-3 px-4">
              <div className="text-xs text-[#888888]">
                {t("employees.summary.partTime")}
              </div>
              <div className="mt-1 text-lg font-mono text-[#f0f0f0]">
                {stats.partTime}
              </div>
            </CardContent>
          </Card>
          <Card className="border-[#2a2a2a] bg-[#141414]">
            <CardContent className="py-3 px-4">
              <div className="text-xs text-[#888888]">
                {t("employees.summary.totalHours")}
              </div>
              <div className="mt-1 text-lg font-mono text-[#f0f0f0]">
                {stats.totalHours}h
              </div>
            </CardContent>
          </Card>
        </div>

        <Button
          size="sm"
          className="bg-[#e8b84b] text-black hover:bg-[#f0c75c]"
          onClick={openCreate}
        >
          <Plus className="mr-2 h-4 w-4" />
          {t("employees.addEmployee")}
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md border border-red-800 bg-red-950 px-3 py-2 text-xs text-red-200">
          {error}
        </div>
      )}

      {/* Employee grid */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card
              key={i}
              className="border-[#2a2a2a] bg-[#141414] animate-pulse"
            >
              <CardHeader className="space-y-2">
                <div className="h-4 w-32 rounded bg-[#1f1f1f]" />
                <div className="h-3 w-20 rounded bg-[#1f1f1f]" />
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="h-3 w-28 rounded bg-[#1f1f1f]" />
                <div className="h-3 w-24 rounded bg-[#1f1f1f]" />
                <div className="h-3 w-40 rounded bg-[#1f1f1f]" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !hasEmployees ? (
        <div className="rounded-md border border-dashed border-[#2a2a2a] bg-[#111111] px-6 py-10 text-center text-sm text-[#888888]">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-[#2a2a2a] bg-[#141414] text-2xl">
            👥
          </div>
          <p className="text-sm text-[#bbbbbb]">
            No employees yet — add your first team member
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {employees.map((emp) => {
            const roleLabel =
              roleOptions.find((r) => r.value === emp.role)?.label ??
              emp.role;
            const employmentLabel =
              employmentOptions.find((e) => e.value === emp.employmentType)
                ?.label ?? emp.employmentType;

            return (
              <Card
                key={emp.id}
                className="border-[#2a2a2a] bg-[#141414] flex flex-col justify-between"
              >
                <CardHeader className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="font-mono text-base text-[#f0f0f0]">
                        {emp.name}
                      </CardTitle>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <Badge
                          variant="outline"
                          className={roleColor(emp.role)}
                        >
                          {roleLabel}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={employmentColor(emp.employmentType)}
                        >
                          {employmentLabel}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-[#888888] hover:text-[#f0f0f0]"
                        onClick={() => openEdit(emp)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-red-400 hover:text-red-200"
                        onClick={() => openDelete(emp)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-[#bbbbbb]">
                  <div>
                    {t("label.contractHours")}:{" "}
                    <span className="font-mono">
                      {emp.contractHours}h / {emp.maxWeeklyHours}h
                    </span>{" "}
                    {t("employees.perWeek")}
                  </div>
                  <div>
                    {t("label.phone")}:{" "}
                    <span className="font-mono">
                      {emp.phone || "—"}
                    </span>
                  </div>
                  {typeof emp.hourlyRate === "number" && (
                    <div>
                      {t("label.hourlyRate")}:{" "}
                      <span className="font-mono">
                        {emp.hourlyRate.toFixed(2)} SEK
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Employee Dialog */}
      <Dialog open={isFormOpen} onOpenChange={(open) => !open && closeForm()}>
        <DialogContent className="bg-[#141414] border-[#2a2a2a]">
          <DialogHeader>
            <DialogTitle className="font-mono text-[#f0f0f0]">
              {editingEmployee
                ? t("employees.editEmployee")
                : t("employees.addEmployee")}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#888888]">
              {editingEmployee
                ? t("employees.editEmployee")
                : t("employees.addEmployee")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs text-[#888888]">
                {t("label.name")}
              </label>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                className="bg-[#0f0f0f] border-[#2a2a2a] text-sm"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs text-[#888888]">
                  {t("label.role")}
                </label>
                <Select
                  value={form.role}
                  onValueChange={(value) =>
                    setForm((f) => ({ ...f, role: value }))
                  }
                >
                  <SelectTrigger className="bg-[#0f0f0f] border-[#2a2a2a] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#141414] border-[#2a2a2a]">
                    {roleOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-[#888888]">
                  {t("label.employmentType")}
                </label>
                <Select
                  value={form.employmentType}
                  onValueChange={(value: Employee["employmentType"]) =>
                    setForm((f) => ({ ...f, employmentType: value }))
                  }
                >
                  <SelectTrigger className="bg-[#0f0f0f] border-[#2a2a2a] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#141414] border-[#2a2a2a]">
                    {employmentOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs text-[#888888]">
                  {t("label.contractHours")}
                </label>
                <Input
                  type="number"
                  value={form.contractHours}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, contractHours: e.target.value }))
                  }
                  className="bg-[#0f0f0f] border-[#2a2a2a] text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-[#888888]">
                  {t("label.maxWeeklyHours")}
                </label>
                <Input
                  type="number"
                  value={form.maxWeeklyHours}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, maxWeeklyHours: e.target.value }))
                  }
                  className="bg-[#0f0f0f] border-[#2a2a2a] text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs text-[#888888]">
                  {t("label.hourlyRate")}
                </label>
                <Input
                  type="number"
                  value={form.hourlyRate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, hourlyRate: e.target.value }))
                  }
                  className="bg-[#0f0f0f] border-[#2a2a2a] text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-[#888888]">
                  {t("label.phone")}
                </label>
                <Input
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: e.target.value }))
                  }
                  className="bg-[#0f0f0f] border-[#2a2a2a] text-sm"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button
              variant="outline"
              size="sm"
              className="border-[#2a2a2a] text-[#f0f0f0]"
              onClick={closeForm}
              disabled={saving}
            >
              {t("button.cancel")}
            </Button>
            <Button
              size="sm"
              className="bg-[#e8b84b] text-black hover:bg-[#f0c75c]"
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("button.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog
        open={isDeleteOpen}
        onOpenChange={(open) => !open && closeDelete()}
      >
        <DialogContent className="bg-[#141414] border-[#2a2a2a]">
          <DialogHeader>
            <DialogTitle className="font-mono text-[#f0f0f0]">
              {t("employees.deleteEmployee")}
            </DialogTitle>
            <DialogDescription className="text-sm text-[#bbbbbb]">
              {t("employees.deleteConfirm")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              size="sm"
              className="border-[#2a2a2a] text-[#f0f0f0]"
              onClick={closeDelete}
              disabled={deleting}
            >
              {t("button.cancel")}
            </Button>
            <Button
              size="sm"
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t("button.edit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
