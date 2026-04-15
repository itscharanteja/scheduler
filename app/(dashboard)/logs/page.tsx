"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  CircleDashed,
  Clock3,
  Filter,
  Layers,
  Plus,
  Search,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "@/context/LocationContext";
import { getEmployees, getTasks, createTask, updateTask, deleteTask } from "@/lib/supabase";
import type { Employee } from "@/lib/types";
import { cn } from "@/lib/utils";

type Task = {
  id: string;
  title: string;
  note: string;
  category: string;
  priority: "low" | "medium" | "high";
  status: "open" | "delegated" | "done";
  assigneeId: string | null;
  assigneeName: string | null;
  createdBy: string | null;
  dueTime: string | null;
  createdAt: string;
  completedAt: string | null;
};

type TaskStatusFilter = "all" | "open" | "delegated" | "done";
type PriorityFilter = "all" | Task["priority"];

function priorityBorderColor(priority: Task["priority"]) {
  if (priority === "high") return "#ef4444";
  if (priority === "medium") return "#f59e0b";
  return "#e2e8f0";
}

function priorityClass(priority: Task["priority"]) {
  if (priority === "high") return "status-danger";
  if (priority === "medium") return "status-warning";
  return "status-neutral";
}

function statusLabel(status: Task["status"], lang: "en" | "sv") {
  if (status === "done") return lang === "sv" ? "Klar" : "Completed";
  if (status === "delegated") return lang === "sv" ? "Pågår" : "In Progress";
  return lang === "sv" ? "Väntar" : "Pending";
}

function statusClass(status: Task["status"]) {
  if (status === "done") return "status-success";
  if (status === "delegated") return "status-info";
  return "status-neutral";
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-3 px-5 py-14 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100">
        <Layers className="h-5 w-5 text-slate-400" />
      </div>
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}

function TaskCardList({
  tasks,
  employees,
  selectedIds,
  canManage,
  lang,
  text,
  onToggle,
  onMarkDone,
  onUpdateAssignee,
  onUpdateDueTime,
  onDelete,
}: {
  tasks: Task[];
  employees: Employee[];
  selectedIds: string[];
  canManage: boolean;
  lang: "en" | "sv";
  text: Record<string, string>;
  onToggle: (id: string, checked: boolean) => void;
  onMarkDone: (ids: string[]) => void;
  onUpdateAssignee: (taskId: string, assigneeId: string) => void;
  onUpdateDueTime: (taskId: string, value: string) => void;
  onDelete?: (id: string) => void;
}) {
  if (tasks.length === 0) return null;

  return (
    <div className="divide-y divide-slate-100">
      {tasks.map((task) => (
        <div
          key={task.id}
          className={cn(
            "group flex gap-3 px-5 py-4 transition-all duration-200 hover:bg-slate-50/60",
            task.status === "done" && "opacity-50"
          )}
          style={{ borderLeft: `3px solid ${priorityBorderColor(task.priority)}` }}
        >
          {/* Checkbox */}
          {canManage && (
            <div className="shrink-0 pt-0.5">
              <input
                type="checkbox"
                checked={selectedIds.includes(task.id)}
                onChange={(e) => onToggle(task.id, e.target.checked)}
                className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-blue-600"
                aria-label={`Select ${task.title}`}
              />
            </div>
          )}

          {/* Body */}
          <div className="min-w-0 flex-1">
            {/* Title row + action buttons */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-sm font-semibold leading-snug text-slate-900",
                    task.status === "done" && "line-through text-slate-400"
                  )}
                >
                  {task.title}
                </p>
                {task.note && (
                  <p className="mt-0.5 text-xs leading-snug text-slate-500">{task.note}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex shrink-0 items-center gap-1.5">
                {task.status !== "done" ? (
                  <Button
                    size="sm"
                    onClick={() => onMarkDone([task.id])}
                    className="h-7 gap-1.5 px-2.5 text-xs"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {text.bulkComplete}
                  </Button>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {task.completedAt
                      ? new Date(task.completedAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : text.done}
                  </div>
                )}
                {onDelete && (
                  <button
                    onClick={() => onDelete(task.id)}
                    aria-label="Delete task"
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Meta row */}
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <span className={`status-chip ${statusClass(task.status)}`}>
                {statusLabel(task.status, lang)}
              </span>
              <span className={`status-chip ${priorityClass(task.priority)}`}>
                {text[task.priority]}
              </span>

              {/* Assignee */}
              <div className="flex items-center gap-1.5">
                <UserRound className="h-3.5 w-3.5 text-slate-400" />
                {canManage ? (
                  <select
                    value={task.assigneeId ?? ""}
                    onChange={(e) => onUpdateAssignee(task.id, e.target.value)}
                    className="h-7 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  >
                    <option value="">{text.unassigned}</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs text-slate-600">
                    {task.assigneeName ?? text.unassigned}
                  </span>
                )}
              </div>

              {/* Due time */}
              <div className="flex items-center gap-1.5">
                <Clock3 className="h-3.5 w-3.5 text-slate-400" />
                {canManage ? (
                  <Input
                    type="datetime-local"
                    value={
                      task.dueTime ? new Date(task.dueTime).toISOString().slice(0, 16) : ""
                    }
                    onChange={(e) => onUpdateDueTime(task.id, e.target.value)}
                    className="h-7 w-auto border-slate-200 px-2 text-xs"
                  />
                ) : (
                  <span className="text-xs text-slate-600">
                    {task.dueTime
                      ? new Date(task.dueTime).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </span>
                )}
              </div>

              {/* Category badge */}
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-500">
                {task.category}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function LogsPage() {
  const { lang } = useLanguage();
  const { user, hasRole } = useAuth();
  const { locationId } = useLocation();
  const canManage = hasRole("admin", "super_admin");
  const showOnlyMyTasks = !hasRole("admin", "super_admin");

  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueTime, setDueTime] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const emps = await getEmployees();
        const filter =
          showOnlyMyTasks && user?.employeeId
            ? { assigneeId: user.employeeId, createdBy: user.employeeId }
            : undefined;
        const rows = await getTasks(locationId, filter);
        if (!active) return;
        setTasks(rows as Task[]);
        setEmployees(emps);
        setAssigneeId(emps[0]?.id ?? "");
      } catch (error) {
        console.error(error);
        toast.error("Could not load tasks");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [showOnlyMyTasks, user?.employeeId]);

  const text =
    lang === "sv"
      ? {
          search: "Sök uppgifter, stationer eller ansvariga",
          add: "Ny uppgift",
          issue: "Uppgiftstitel",
          note: "Kort beskrivning",
          due: "Deadline",
          assign: "Ansvarig",
          create: "Skapa uppgift",
          bulkComplete: "Klar",
          empty: "Inga uppgifter.",
          today: "Idag",
          upcoming: "Kommande",
          completed: "Klart",
          all: "Alla",
          open: "Väntar",
          delegated: "Pågår",
          done: "Klar",
          high: "Brådskande",
          medium: "Granskas",
          low: "Normal",
          station: "Område",
          unassigned: "Ej tilldelad",
          completedToast: "Uppgift markerad klar",
          createdToast: "Uppgift skapad",
          selectAll: "Välj alla",
          clear: "Rensa",
          assignedToYou: "Tilldelad till dig",
          createdByYou: "Skapad av dig",
          assignedDesc: "Uppgifter som tilldelats dig.",
          createdDesc: "Uppgifter du har skapat och tilldelat andra.",
          allTasksDesc: "Slutför arbete direkt. Delegera eller justera deadline utan att lämna listan.",
        }
      : {
          search: "Search tasks, stations, or assignees",
          add: "New task",
          issue: "Task title",
          note: "Short note",
          due: "Due",
          assign: "Assignee",
          create: "Create task",
          bulkComplete: "Done",
          empty: "No tasks.",
          today: "Today",
          upcoming: "Upcoming",
          completed: "Completed",
          all: "All",
          open: "Pending",
          delegated: "In Progress",
          done: "Completed",
          high: "Urgent",
          medium: "Needs Review",
          low: "Normal",
          station: "Area",
          unassigned: "Unassigned",
          completedToast: "Task marked complete",
          createdToast: "Task created",
          selectAll: "Select all",
          clear: "Clear",
          assignedToYou: "Assigned to you",
          createdByYou: "Created by you",
          assignedDesc: "Tasks that have been assigned to you.",
          createdDesc: "Tasks you created and assigned to others.",
          allTasksDesc: "Complete work inline. Reassign or adjust due time without leaving the list.",
        };

  function applyFilters(list: Task[]) {
    return list.filter((task) => {
      if (!task.title) return false;
      const haystack =
        `${task.title} ${task.note} ${task.assigneeName ?? ""} ${task.category}`.toLowerCase();
      return (
        (query.trim() ? haystack.includes(query.trim().toLowerCase()) : true) &&
        (statusFilter === "all" ? true : task.status === statusFilter) &&
        (priorityFilter === "all" ? true : task.priority === priorityFilter)
      );
    });
  }

  const filteredAll = useMemo(
    () => applyFilters(tasks),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, query, statusFilter, priorityFilter]
  );

  const assignedToMe = useMemo(
    () => applyFilters(tasks.filter((t) => t.assigneeId === user?.employeeId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, user?.employeeId, query, statusFilter, priorityFilter]
  );
  const createdByMe = useMemo(
    () =>
      applyFilters(
        tasks.filter(
          (t) => t.createdBy === user?.employeeId && t.assigneeId !== user?.employeeId
        )
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, user?.employeeId, query, statusFilter, priorityFilter]
  );

  const summary = useMemo(
    () => ({
      open: tasks.filter((t) => t.title && t.status === "open").length,
      delegated: tasks.filter((t) => t.title && t.status === "delegated").length,
      done: tasks.filter((t) => t.title && t.status === "done").length,
    }),
    [tasks]
  );

  function toggleTask(id: string, checked: boolean) {
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((item) => item !== id)));
  }

  function markDone(ids: string[]) {
    if (ids.length === 0) return;
    setTasks((prev) =>
      prev.map((task) =>
        ids.includes(task.id)
          ? { ...task, status: "done", completedAt: new Date().toISOString() }
          : task
      )
    );
    setSelectedIds([]);
    Promise.all(ids.map((id) => updateTask(id, { status: "done" }))).catch(() => {
      toast.error("Failed to update some tasks");
    });
    toast.success(text.completedToast);
  }

  async function handleCreateTask() {
    if (!title.trim()) return;
    const created = await createTask({
      locationId: locationId,
      title: title.trim(),
      note: note.trim(),
      category: "ops",
      priority: "medium",
      assigneeId: assigneeId || null,
      createdBy: user?.employeeId ?? null,
      dueTime: dueTime ? new Date(dueTime).toISOString() : null,
    });
    if (created) {
      setTasks((prev) => [created as Task, ...prev]);
      setTitle("");
      setNote("");
      toast.success(text.createdToast);
    } else {
      toast.error("Failed to create task");
    }
  }

  function updateAssignee(taskId: string, nextAssigneeId: string) {
    const assignee = employees.find((e) => e.id === nextAssigneeId);
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? {
              ...task,
              assigneeId: nextAssigneeId || null,
              assigneeName: assignee?.name ?? null,
              status: task.status === "open" ? "delegated" : task.status,
            }
          : task
      )
    );
    updateTask(taskId, { assigneeId: nextAssigneeId || null }).catch(() => {
      toast.error("Failed to update assignee");
    });
  }

  function handleDelete(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    deleteTask(id).catch(() => toast.error("Failed to delete task"));
  }

  function updateDueTime(taskId: string, nextValue: string) {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? { ...task, dueTime: nextValue ? new Date(nextValue).toISOString() : null }
          : task
      )
    );
    updateTask(taskId, {
      dueTime: nextValue ? new Date(nextValue).toISOString() : null,
    }).catch(() => {
      toast.error("Failed to update due time");
    });
  }

  const cardListProps = {
    employees,
    selectedIds,
    canManage,
    lang,
    text,
    onToggle: toggleTask,
    onMarkDone: markDone,
    onUpdateAssignee: updateAssignee,
    onUpdateDueTime: updateDueTime,
  };

  const hasActiveFilters = query.trim() || statusFilter !== "all" || priorityFilter !== "all";

  return (
    <div className="space-y-5">
      {/* ── Top grid: metrics + create form ── */}
      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        {/* Metrics + filters */}
        <div className="app-panel p-5">
          <div className="grid gap-3 md:grid-cols-3">
            {/* Pending */}
            <div
              className="metric-card"
              style={{ borderTop: "3px solid #f59e0b" }}
            >
              <div className="flex items-start justify-between">
                <div className="metric-label">{text.open}</div>
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100">
                  <CircleDashed className="h-3.5 w-3.5 text-amber-600" />
                </div>
              </div>
              <div className="metric-value">{loading ? "—" : summary.open}</div>
              <div className="metric-note">{text.today}</div>
            </div>

            {/* In Progress */}
            <div
              className="metric-card"
              style={{ borderTop: "3px solid #3b82f6" }}
            >
              <div className="flex items-start justify-between">
                <div className="metric-label">{text.delegated}</div>
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100">
                  <Clock3 className="h-3.5 w-3.5 text-blue-600" />
                </div>
              </div>
              <div className="metric-value">{loading ? "—" : summary.delegated}</div>
              <div className="metric-note">{text.upcoming}</div>
            </div>

            {/* Completed */}
            <div
              className="metric-card"
              style={{ borderTop: "3px solid #10b981" }}
            >
              <div className="flex items-start justify-between">
                <div className="metric-label">{text.done}</div>
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                </div>
              </div>
              <div className="metric-value">{loading ? "—" : summary.done}</div>
              <div className="metric-note">{text.completed}</div>
            </div>
          </div>

          {/* Filter bar */}
          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <label className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={text.search}
                className="pl-9"
              />
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as TaskStatusFilter)}
              className="filter-input min-w-[140px]"
            >
              <option value="all">{text.all}</option>
              <option value="open">{text.open}</option>
              <option value="delegated">{text.delegated}</option>
              <option value="done">{text.done}</option>
            </select>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}
              className="filter-input min-w-[140px]"
            >
              <option value="all">{text.all}</option>
              <option value="high">{text.high}</option>
              <option value="medium">{text.medium}</option>
              <option value="low">{text.low}</option>
            </select>
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setQuery("");
                  setStatusFilter("all");
                  setPriorityFilter("all");
                }}
                className="gap-1.5"
              >
                <Filter className="h-3.5 w-3.5" />
                {text.clear}
              </Button>
            )}
          </div>
        </div>

        {/* Create task form */}
        <div className="app-panel p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="section-title">{text.add}</h2>
              <p className="section-copy">
                {lang === "sv"
                  ? "Håll rutinarbete synligt och delegerbart."
                  : "Keep routine work visible and assignable."}
              </p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50">
              <Plus className="h-4 w-4 text-blue-600" />
            </div>
          </div>
          <div className="mt-4 grid gap-2.5">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={text.issue}
              disabled={loading}
            />
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={text.note}
              disabled={loading}
            />
            <div className="grid grid-cols-2 gap-2.5">
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="filter-input"
                disabled={loading}
              >
                <option value="">{text.unassigned}</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
              </select>
              <Input
                type="datetime-local"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                disabled={loading}
              />
            </div>
            <Button
              onClick={() => void handleCreateTask()}
              disabled={loading || !title.trim()}
              className="w-full gap-2"
            >
              <Plus className="h-4 w-4" />
              {text.create}
            </Button>
          </div>
        </div>
      </section>

      {/* ── Task list(s) ── */}
      {canManage ? (
        /* Admin / super_admin: flat list with bulk controls */
        <section className="app-panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <h3 className="section-title">{text.open}</h3>
              <p className="section-copy">{text.allTasksDesc}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedIds(filteredAll.map((t) => t.id))}
              >
                {text.selectAll}
              </Button>
              <Button
                size="sm"
                onClick={() => markDone(selectedIds)}
                disabled={selectedIds.length === 0}
                className="gap-1.5"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {text.bulkComplete}
              </Button>
            </div>
          </div>
          {filteredAll.length === 0 ? (
            <EmptyState label={text.empty} />
          ) : (
            <TaskCardList tasks={filteredAll} {...cardListProps} />
          )}
        </section>
      ) : (
        /* user / user_lead: two sections */
        <>
          <section className="app-panel overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="section-title">{text.assignedToYou}</h3>
              <p className="section-copy">{text.assignedDesc}</p>
            </div>
            {assignedToMe.length === 0 ? (
              <EmptyState label={text.empty} />
            ) : (
              <TaskCardList tasks={assignedToMe} {...cardListProps} />
            )}
          </section>

          <section className="app-panel overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="section-title">{text.createdByYou}</h3>
              <p className="section-copy">{text.createdDesc}</p>
            </div>
            {createdByMe.length === 0 ? (
              <EmptyState label={text.empty} />
            ) : (
              <TaskCardList tasks={createdByMe} {...cardListProps} onDelete={handleDelete} />
            )}
          </section>
        </>
      )}
    </div>
  );
}
