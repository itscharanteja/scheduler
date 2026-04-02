"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Clock3, Filter, Plus, Search, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/context/LanguageContext";
import { mockEmployees, mockLogs } from "@/lib/mock-data";
import type { ShiftLeaderLogEntry } from "@/lib/types";

type TaskStatusFilter = "all" | "open" | "delegated" | "done";
type PriorityFilter = "all" | ShiftLeaderLogEntry["priority"];

function priorityClass(priority: ShiftLeaderLogEntry["priority"]) {
  if (priority === "high") return "status-danger";
  if (priority === "medium") return "status-warning";
  return "status-neutral";
}

function statusLabel(status: ShiftLeaderLogEntry["status"], lang: "en" | "sv") {
  if (lang === "sv") {
    if (status === "done") return "Completed";
    if (status === "delegated") return "In Progress";
    return "Pending";
  }
  if (status === "done") return "Completed";
  if (status === "delegated") return "In Progress";
  return "Pending";
}

function statusClass(status: ShiftLeaderLogEntry["status"]) {
  if (status === "done") return "status-success";
  if (status === "delegated") return "status-info";
  return "status-neutral";
}

export default function LogsPage() {
  const { lang } = useLanguage();
  const [tasks, setTasks] = useState(mockLogs);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [assigneeId, setAssigneeId] = useState(mockEmployees[0]?.id ?? "");
  const [dueTime, setDueTime] = useState("2026-03-28T17:30");

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
          bulkComplete: "Markera valda klara",
          empty: "Inga uppgifter matchar nuvarande filter.",
          today: "Idag",
          upcoming: "Kommande",
          completed: "Klart",
          all: "Alla",
          open: "Pending",
          delegated: "In Progress",
          done: "Completed",
          high: "Urgent",
          medium: "Needs Review",
          low: "Normal",
          station: "Område",
          unassigned: "Ej tilldelad",
          completedToast: "Uppgift markerad klar",
          createdToast: "Uppgift skapad",
          selectAll: "Välj alla",
          clear: "Rensa filter",
        }
      : {
          search: "Search tasks, stations, or assignees",
          add: "New task",
          issue: "Task title",
          note: "Short note",
          due: "Due",
          assign: "Assignee",
          create: "Create task",
          bulkComplete: "Mark complete",
          empty: "No tasks match the current filters.",
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
          clear: "Clear filters",
        };

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const haystack = `${task.title} ${task.note} ${task.assigneeName ?? ""} ${task.category}`.toLowerCase();
      return (
        (query.trim() ? haystack.includes(query.trim().toLowerCase()) : true) &&
        (statusFilter === "all" ? true : task.status === statusFilter) &&
        (priorityFilter === "all" ? true : task.priority === priorityFilter)
      );
    });
  }, [priorityFilter, query, statusFilter, tasks]);

  const summary = useMemo(
    () => ({
      open: tasks.filter((task) => task.status === "open").length,
      delegated: tasks.filter((task) => task.status === "delegated").length,
      done: tasks.filter((task) => task.status === "done").length,
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
    toast.success(text.completedToast);
  }

  function createTask() {
    if (!title.trim()) return;
    const assignee = mockEmployees.find((employee) => employee.id === assigneeId);
    setTasks((prev) => [
      {
        id: `task-${Date.now()}`,
        title: title.trim(),
        note: note.trim(),
        category: "ops",
        priority: "medium",
        status: "open",
        assigneeId,
        assigneeName: assignee?.name,
        dueTime: new Date(dueTime).toISOString(),
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    setTitle("");
    setNote("");
    toast.success(text.createdToast);
  }

  function updateAssignee(taskId: string, nextAssigneeId: string) {
    const assignee = mockEmployees.find((employee) => employee.id === nextAssigneeId);
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? {
              ...task,
              assigneeId: nextAssigneeId,
              assigneeName: assignee?.name,
              status: task.status === "open" ? "delegated" : task.status,
            }
          : task
      )
    );
  }

  function updateDueTime(taskId: string, nextValue: string) {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId ? { ...task, dueTime: new Date(nextValue).toISOString() } : task
      )
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="app-panel p-5">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="metric-card">
              <div className="metric-label">{text.open}</div>
              <div className="metric-value">{summary.open}</div>
              <div className="metric-note">{text.today}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">{text.delegated}</div>
              <div className="metric-value">{summary.delegated}</div>
              <div className="metric-note">{text.upcoming}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">{text.done}</div>
              <div className="metric-value">{summary.done}</div>
              <div className="metric-note">{text.completed}</div>
            </div>
          </div>

          <div className="mt-5 toolbar-row">
            <label className="relative min-w-[240px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={text.search}
                className="pl-9"
              />
            </label>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as TaskStatusFilter)}
              className="filter-input min-w-[160px]"
            >
              <option value="all">{text.all}</option>
              <option value="open">{text.open}</option>
              <option value="delegated">{text.delegated}</option>
              <option value="done">{text.done}</option>
            </select>
            <select
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value as PriorityFilter)}
              className="filter-input min-w-[160px]"
            >
              <option value="all">{text.all}</option>
              <option value="high">{text.high}</option>
              <option value="medium">{text.medium}</option>
              <option value="low">{text.low}</option>
            </select>
            <Button variant="outline" onClick={() => {
              setQuery("");
              setStatusFilter("all");
              setPriorityFilter("all");
            }}>
              <Filter className="h-4 w-4" />
              {text.clear}
            </Button>
          </div>
        </div>

        <div className="app-panel p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="section-title">{text.add}</h2>
              <p className="section-copy">Keep routine work visible and assignable.</p>
            </div>
            <span className="status-chip status-info">
              <Plus className="h-3.5 w-3.5" />
              {text.add}
            </span>
          </div>
          <div className="mt-4 grid gap-3">
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={text.issue} />
            <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder={text.note} />
            <div className="grid gap-3 md:grid-cols-2">
              <select
                value={assigneeId}
                onChange={(event) => setAssigneeId(event.target.value)}
                className="filter-input"
              >
                {mockEmployees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
              </select>
              <Input type="datetime-local" value={dueTime} onChange={(event) => setDueTime(event.target.value)} />
            </div>
            <Button onClick={createTask}>
              <Plus className="h-4 w-4" />
              {text.create}
            </Button>
          </div>
        </div>
      </section>

      <section className="app-panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="section-title">{text.open}</h3>
            <p className="section-copy">Complete work inline. Reassign or move due time without leaving the list.</p>
          </div>
          <div className="toolbar-row">
            <Button variant="outline" size="sm" onClick={() => {
              const ids = filteredTasks.map((task) => task.id);
              setSelectedIds(ids);
            }}>
              {text.selectAll}
            </Button>
            <Button size="sm" onClick={() => markDone(selectedIds)} disabled={selectedIds.length === 0}>
              <CheckCircle2 className="h-4 w-4" />
              {text.bulkComplete}
            </Button>
          </div>
        </div>

        {filteredTasks.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-600">{text.empty}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="ops-table min-w-[940px]">
              <thead>
                <tr>
                  <th />
                  <th>Task</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>{text.assign}</th>
                  <th>{text.due}</th>
                  <th>{text.station}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map((task) => (
                  <tr key={task.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(task.id)}
                        onChange={(event) => toggleTask(task.id, event.target.checked)}
                        aria-label={`Select ${task.title}`}
                      />
                    </td>
                    <td>
                      <div className="font-semibold text-slate-950">{task.title}</div>
                      <div className="mt-1 text-sm text-slate-600">{task.note}</div>
                    </td>
                    <td>
                      <span className={`status-chip ${statusClass(task.status)}`}>
                        {statusLabel(task.status, lang)}
                      </span>
                    </td>
                    <td>
                      <span className={`status-chip ${priorityClass(task.priority)}`}>
                        {text[task.priority]}
                      </span>
                    </td>
                    <td>
                      <label className="sr-only">{text.assign}</label>
                      <select
                        value={task.assigneeId ?? ""}
                        onChange={(event) => updateAssignee(task.id, event.target.value)}
                        className="filter-input min-w-[180px]"
                      >
                        <option value="">{text.unassigned}</option>
                        {mockEmployees.map((employee) => (
                          <option key={employee.id} value={employee.id}>
                            {employee.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <label className="sr-only">{text.due}</label>
                      <Input
                        type="datetime-local"
                        value={
                          task.dueTime
                            ? new Date(task.dueTime).toISOString().slice(0, 16)
                            : ""
                        }
                        onChange={(event) => updateDueTime(task.id, event.target.value)}
                      />
                    </td>
                    <td>
                      <div className="inline-flex items-center gap-2 text-sm text-slate-700">
                        <UserRound className="h-4 w-4 text-slate-400" />
                        {task.category}
                      </div>
                    </td>
                    <td>
                      {task.status !== "done" ? (
                        <Button size="sm" onClick={() => markDone([task.id])}>
                          <CheckCircle2 className="h-4 w-4" />
                          {text.bulkComplete}
                        </Button>
                      ) : (
                        <div className="inline-flex items-center gap-2 text-sm text-emerald-700">
                          <Clock3 className="h-4 w-4" />
                          {task.completedAt
                            ? new Date(task.completedAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : text.done}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
