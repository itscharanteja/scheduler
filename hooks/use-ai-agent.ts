"use client";

import { format } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { createShift, getEmployees, getShiftsByWeek, isSupabaseConfigured } from "@/lib/supabase";
import type { Employee, Shift } from "@/lib/types";

export type GeneratedShift = {
  employeeId: string;
  employeeName: string;
  date: string;
  startTime: string;
  endTime: string;
  role: string;
  createdByAi: true;
};

export type GenerationResult = {
  explanation: string;
  warnings: string[];
  shifts: GeneratedShift[];
};

function shiftHours(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  return (eh * 60 + em - sh * 60 - sm) / 60;
}

type UseAIAgentOptions = {
  weekStart: Date;
  locationId: string;
  autoLoad?: boolean;
};

export function useAIAgent({
  weekStart,
  locationId,
  autoLoad = true,
}: UseAIAgentOptions) {
  const [prompt, setPrompt] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [existingShifts, setExistingShifts] = useState<Shift[]>([]);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const reloadData = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setEmployees([]);
      setExistingShifts([]);
      setLoadingData(false);
      return;
    }
    setLoadingData(true);
    setError(null);
    try {
      const [employeeRows, schedule] = await Promise.all([
        getEmployees(locationId),
        getShiftsByWeek(weekStart, locationId),
      ]);
      setEmployees(employeeRows);
      setExistingShifts(schedule.shifts);
    } catch (loadErr) {
      console.error(loadErr);
      setError("Failed to load employees/shifts for AI generation.");
    } finally {
      setLoadingData(false);
    }
  }, [locationId, weekStart]);

  useEffect(() => {
    if (!autoLoad) return;
    void reloadData();
  }, [autoLoad, reloadData]);

  const hourImpact = useMemo(() => {
    const currentByEmployee = new Map<string, number>();
    for (const shift of existingShifts) {
      currentByEmployee.set(
        shift.employeeId,
        (currentByEmployee.get(shift.employeeId) ?? 0) +
          shiftHours(shift.startTime, shift.endTime)
      );
    }

    const generatedByEmployee = new Map<string, number>();
    for (const shift of result?.shifts ?? []) {
      generatedByEmployee.set(
        shift.employeeId,
        (generatedByEmployee.get(shift.employeeId) ?? 0) +
          shiftHours(shift.startTime, shift.endTime)
      );
    }

    return employees.map((employee) => {
      const current = currentByEmployee.get(employee.id) ?? 0;
      const generated = generatedByEmployee.get(employee.id) ?? 0;
      const projected = current + generated;
      return {
        id: employee.id,
        name: employee.name,
        current,
        generated,
        projected,
        max: employee.maxWeeklyHours,
        exceeds: projected > employee.maxWeeklyHours,
      };
    });
  }, [employees, existingShifts, result]);

  const generate = useCallback(
    async (promptOverride?: string) => {
      const nextPrompt = (promptOverride ?? prompt).trim();
      if (!nextPrompt) return;
      setGenerating(true);
      setError(null);
      setSuccess(null);
      try {
        const employeePayload = employees.map((employee) => {
          const currentScheduledHours = existingShifts
            .filter((shift) => shift.employeeId === employee.id)
            .reduce((sum, shift) => sum + shiftHours(shift.startTime, shift.endTime), 0);
          return {
            id: employee.id,
            name: employee.name,
            role: employee.role,
            maxWeeklyHours: employee.maxWeeklyHours,
            contractHours: employee.contractHours,
            currentScheduledHours: Number(currentScheduledHours.toFixed(2)),
          };
        });

        const response = await fetch("/api/generate-schedule", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            prompt: nextPrompt,
            employees: employeePayload,
            existingShifts: existingShifts.map((shift) => ({
              employeeId: shift.employeeId,
              employeeName: shift.employeeName,
              date: shift.date,
              startTime: shift.startTime,
              endTime: shift.endTime,
              role: shift.role,
            })),
            weekStart: format(weekStart, "yyyy-MM-dd"),
            locationId,
          }),
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(typeof payload?.error === "string" ? payload.error : "Failed to generate schedule.");
        }
        const normalizedShifts: GeneratedShift[] = Array.isArray(payload?.shifts)
          ? payload.shifts.map((shift: GeneratedShift) => ({
              ...shift,
              employeeName:
                shift.employeeName ||
                employees.find((employee) => employee.id === shift.employeeId)?.name ||
                "",
            }))
          : [];

        setResult({
          explanation: typeof payload?.explanation === "string" ? payload.explanation : "",
          warnings: Array.isArray(payload?.warnings) ? payload.warnings : [],
          shifts: normalizedShifts,
        });
        toast.success("AI schedule generated");
      } catch (generationError) {
        console.error(generationError);
        setError(
          generationError instanceof Error
            ? generationError.message
            : "Failed to generate schedule."
        );
        toast.error("Failed to save — try again");
      } finally {
        setGenerating(false);
      }
    },
    [employees, existingShifts, prompt, weekStart]
  );

  const applyGenerated = useCallback(async (): Promise<string | null> => {
    if (!result?.shifts.length || !isSupabaseConfigured) return null;
    setApplying(true);
    setError(null);
    setSuccess(null);
    try {
      const results = await Promise.allSettled(
        result.shifts.map((shift) => {
          const employee = employees.find((item) => item.id === shift.employeeId);
          return createShift({
            employeeId: shift.employeeId,
            date: shift.date,
            startTime: shift.startTime,
            endTime: shift.endTime,
            role: shift.role,
            locationId: employee?.locationId || locationId,
            status: "draft",
            createdByAi: true,
          });
        })
      );

      const saved = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;

      if (saved === 0) {
        const firstError = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
        throw new Error(firstError?.reason?.message ?? "No shifts could be saved.");
      }

      const msg = `${saved} shift${saved !== 1 ? "s" : ""} applied as draft.${failed > 0 ? ` ${failed} could not be saved.` : ""}`;
      setSuccess(msg);
      toast.success(`${saved} shift${saved !== 1 ? "s" : ""} applied`);
      setResult(null);
      await reloadData();
      return format(weekStart, "RRRR-'W'II");
    } catch (applyError) {
      console.error(applyError);
      const msg = applyError instanceof Error ? applyError.message : "Failed to apply generated shifts.";
      setError(msg);
      toast.error("Failed to save — try again");
      return null;
    } finally {
      setApplying(false);
    }
  }, [employees, locationId, reloadData, result, weekStart]);

  return {
    prompt,
    setPrompt,
    employees,
    existingShifts,
    result,
    setResult,
    loadingData,
    generating,
    applying,
    error,
    success,
    hourImpact,
    generate,
    applyGenerated,
    reloadData,
    isSupabaseConfigured,
  };
}
