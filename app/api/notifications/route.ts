import { addDays, format, startOfWeek } from "date-fns";
import { NextRequest, NextResponse } from "next/server";
import { LOCATION_ID } from "@/lib/constants";
import { getCallerSession, unauthorized } from "@/lib/api-auth";
import { getShiftsByWeek, isSupabaseConfigured } from "@/lib/supabase";
import { getRuntimeStore } from "@/lib/server/runtime-store";
import type { AppNotification, NotificationKind } from "@/lib/types";

function roleLabel(role: string): string {
  if (!role) return "Shift";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function buildShiftNotifications(shifts: Awaited<ReturnType<typeof getShiftsByWeek>>["shifts"]): AppNotification[] {
  const byDate = shifts
    .slice()
    .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`))
    .slice(-10);

  return byDate.map((shift) => ({
    id: `shift-${shift.id}`,
    type: shift.createdByAi ? "ai_suggestion" : "shift_assigned",
    title: shift.createdByAi ? "AI optimization suggestion" : "Shift assigned",
    message: `${shift.employeeName || "Employee"} • ${roleLabel(shift.role)} • ${shift.startTime.slice(0, 5)}-${shift.endTime.slice(0, 5)} (${shift.date})`,
    timestamp: `${shift.date}T${shift.startTime}:00`,
    read: false,
  }));
}

function detectOverlapNotifications(shifts: Awaited<ReturnType<typeof getShiftsByWeek>>["shifts"]): AppNotification[] {
  const byEmployee = new Map<string, typeof shifts>();
  for (const shift of shifts) {
    const list = byEmployee.get(shift.employeeId) ?? [];
    list.push(shift);
    byEmployee.set(shift.employeeId, list);
  }

  const conflicts: AppNotification[] = [];
  byEmployee.forEach((items) => {
    const ordered = items
      .slice()
      .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
    for (let i = 1; i < ordered.length; i++) {
      const prev = ordered[i - 1];
      const current = ordered[i];
      if (prev.date !== current.date) continue;
      if (prev.endTime > current.startTime) {
        conflicts.push({
          id: `conflict-${prev.id}-${current.id}`,
          type: "shift_conflict",
          title: "Shift conflict detected",
          message: `${current.employeeName || "Employee"} has overlapping shifts on ${current.date}`,
          timestamp: `${current.date}T${current.startTime}:00`,
          read: false,
        });
      }
    }
  });

  return conflicts;
}

function mergeNotifications(base: AppNotification[], manual: AppNotification[]): AppNotification[] {
  const map = new Map<string, AppNotification>();
  [...manual, ...base].forEach((item) => {
    if (!map.has(item.id)) map.set(item.id, item);
  });
  return Array.from(map.values()).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export async function GET(req: Request) {
  const caller = await getCallerSession(req as NextRequest);
  if (!caller) return unauthorized();
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") ?? 12);

  const store = getRuntimeStore();
  const manual = store.notifications;

  let generated: AppNotification[] = [];
  if (isSupabaseConfigured) {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const schedule = await getShiftsByWeek(weekStart, LOCATION_ID);
    generated = [...buildShiftNotifications(schedule.shifts), ...detectOverlapNotifications(schedule.shifts)];
  } else {
    const today = new Date();
    generated = [
      {
        id: "fallback-assigned",
        type: "shift_assigned",
        title: "Shift assigned",
        message: `A draft shift was created for ${format(today, "yyyy-MM-dd")}.`,
        timestamp: today.toISOString(),
        read: false,
      },
      {
        id: "fallback-suggestion",
        type: "ai_suggestion",
        title: "AI optimization suggestion",
        message: "Try balancing service roles across evening shifts this week.",
        timestamp: addDays(today, -1).toISOString(),
        read: false,
      },
    ];
  }

  const merged = mergeNotifications(generated, manual).map((item) => ({
    ...item,
    read: item.read || store.readNotificationIds.includes(item.id),
  }));
  return NextResponse.json({ notifications: merged.slice(0, Number.isFinite(limit) ? limit : 12) });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<AppNotification> & { type?: NotificationKind };
    if (!body.type || !body.title || !body.message) {
      return NextResponse.json({ error: "type, title and message are required." }, { status: 400 });
    }
    const item: AppNotification = {
      id: body.id ?? `manual-${Date.now()}`,
      type: body.type,
      title: body.title,
      message: body.message,
      timestamp: body.timestamp ?? new Date().toISOString(),
      read: Boolean(body.read),
    };
    const store = getRuntimeStore();
    store.notifications = [item, ...store.notifications];
    return NextResponse.json({ notification: item }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid notification payload." }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as { id?: string; markAllRead?: boolean };
    const store = getRuntimeStore();
    if (body.markAllRead) {
      store.notifications = store.notifications.map((item) => ({ ...item, read: true }));
      const ids = store.notifications.map((item) => item.id);
      store.readNotificationIds = Array.from(new Set([...store.readNotificationIds, ...ids]));
      return NextResponse.json({ notifications: store.notifications });
    }
    if (!body.id) {
      return NextResponse.json({ error: "id is required when markAllRead is false." }, { status: 400 });
    }
    store.notifications = store.notifications.map((item) =>
      item.id === body.id ? { ...item, read: true } : item
    );
    if (!store.readNotificationIds.includes(body.id)) {
      store.readNotificationIds.push(body.id);
    }
    return NextResponse.json({ notifications: store.notifications });
  } catch {
    return NextResponse.json({ error: "Invalid patch payload." }, { status: 400 });
  }
}

export async function DELETE() {
  const store = getRuntimeStore();
  store.notifications = [];
  store.readNotificationIds = [];
  return NextResponse.json({ success: true });
}
