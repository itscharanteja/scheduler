"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLanguage } from "@/context/LanguageContext";
import { useDatabaseStatus } from "@/context/DatabaseStatusContext";
import type { Employee } from "@/lib/types";

export type ShiftForm = {
  employeeId: string;
  date: string;
  startTime: string;
  endTime: string;
  role: string;
};

export function ShiftPopover({
  trigger,
  title,
  employees,
  defaultForm,
  editingShiftId = null,
  onOpenChangeState,
  onSave,
  onDelete,
}: {
  trigger: React.ReactNode;
  title: string;
  employees: Employee[];
  defaultForm: ShiftForm;
  editingShiftId?: string | null;
  onOpenChangeState?: (isOpen: boolean) => void;
  onSave: (form: ShiftForm) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ShiftForm>(defaultForm);
  const [saving, setSaving] = useState(false);
  const { isDegraded } = useDatabaseStatus();
  const { lang } = useLanguage();

  function handleOpenChange(next: boolean) {
    if (next) setForm(defaultForm);
    setOpen(next);
    onOpenChangeState?.(next);
  }

  async function handleSave() {
    if (isDegraded) {
      toast.error(
        lang === "sv"
          ? "Databasen startar upp. Vänta ett ögonblick innan du sparar pass."
          : "Database is currently waking up. Please wait a moment before saving shifts."
      );
      return;
    }
    setSaving(true);
    try {
      await onSave(form);
      setOpen(false);
      onOpenChangeState?.(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    if (isDegraded) {
      toast.error(
        lang === "sv"
          ? "Databasen startar upp. Vänta ett ögonblick innan du tar bort pass."
          : "Database is currently waking up. Please wait a moment before deleting shifts."
      );
      return;
    }
    setSaving(true);
    try {
      await onDelete();
      setOpen(false);
      onOpenChangeState?.(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-72" align="start">
        <p className="mb-3 text-[13px] font-semibold text-slate-800">{title}</p>
        <div className="grid gap-2">
          <select
            value={form.employeeId}
            onChange={(e) => {
              const emp = employees.find((em) => em.id === e.target.value);
              setForm((prev) => ({ ...prev, employeeId: e.target.value, role: emp?.role ?? prev.role }));
            }}
            className="filter-input text-sm"
          >
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.name}</option>
            ))}
          </select>
          <Input type="date" value={form.date} className="h-10 text-sm" onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))} />
          <div className="grid grid-cols-2 gap-2">
            <Input type="time" value={form.startTime} className="h-10 text-sm" onChange={(e) => setForm((prev) => ({ ...prev, startTime: e.target.value }))} />
            <Input type="time" value={form.endTime} className="h-10 text-sm" onChange={(e) => setForm((prev) => ({ ...prev, endTime: e.target.value }))} />
          </div>
          <select
            value={form.role}
            onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
            className="filter-input text-sm"
          >
            <option value="service">Service</option>
            <option value="shiftleader">Shift leader</option>
            <option value="rutin">Rutin</option>
            <option value="sales">Sales</option>
            <option value="reception">Reception</option>
          </select>
        </div>
        <div className="mt-3 flex items-center justify-end gap-2">
          {editingShiftId && onDelete && (
            <Button size="sm" variant="outline" disabled={saving} onClick={() => void handleDelete()}>
              Delete
            </Button>
          )}
          <Button size="sm" disabled={saving} onClick={() => void handleSave()}>
            {editingShiftId ? "Save" : "Add shift"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
