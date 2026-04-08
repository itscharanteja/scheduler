"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Search,
  SendHorizonal,
  Settings,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { LOCATION_ID } from "@/lib/constants";
import type { ChannelMember, ChatChannel, ChatMessage } from "@/lib/types";

type DraftState = Record<string, string>;

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ─── Create Channel Dialog ─────────────────────────────────────────────────────

function CreateChannelDialog({
  onCreated,
  createdBy,
}: {
  onCreated: (channel: ChatChannel) => void;
  createdBy?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isAnnouncement, setIsAnnouncement] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/chat/channels/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          locationId: LOCATION_ID,
          name: name.trim(),
          description: description.trim() || null,
          isAnnouncement,
          createdBy: createdBy ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create channel");
      onCreated(data.channel as ChatChannel);
      setOpen(false);
      setName("");
      setDescription("");
      setIsAnnouncement(false);
      toast.success("Channel created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create channel");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900" title="New channel">
          <Plus className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New channel</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kitchen team" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Description</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={isAnnouncement}
              onChange={(e) => setIsAnnouncement(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Announcement channel
          </label>
        </div>
        <DialogFooter>
          <Button onClick={() => setOpen(false)} variant="outline" disabled={loading}>Cancel</Button>
          <Button onClick={handleCreate} disabled={loading || !name.trim()}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit / Delete Channel Dialog ─────────────────────────────────────────────

function EditChannelDialog({
  channel,
  requesterId,
  isSuperAdmin,
  onUpdated,
  onDeleted,
}: {
  channel: ChatChannel;
  requesterId: string | null;
  isSuperAdmin: boolean;
  onUpdated: (channel: ChatChannel) => void;
  onDeleted: (channelId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(channel.name);
  const [description, setDescription] = useState(channel.description ?? "");
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleSave() {
    if (!name.trim() || !requesterId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/chat/channels/${channel.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim(), requesterId, isSuperAdmin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update channel");
      onUpdated({ ...channel, name: name.trim(), description: description.trim() || undefined });
      setOpen(false);
      toast.success("Channel updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update channel");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!requesterId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/chat/channels/${channel.id}`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requesterId, isSuperAdmin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to delete channel");
      onDeleted(channel.id);
      setOpen(false);
      toast.success("Channel deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete channel");
    } finally {
      setLoading(false);
      setConfirmDelete(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setConfirmDelete(false); }}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="ml-auto shrink-0 rounded-lg p-1 text-slate-400 opacity-0 hover:bg-slate-200 hover:text-slate-700 group-hover:opacity-100"
          title="Edit channel"
        >
          <Settings className="h-3.5 w-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit channel</DialogTitle>
        </DialogHeader>
        {confirmDelete ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-700">
              Are you sure you want to delete <strong>{channel.name}</strong>? All messages will be permanently removed.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={loading}>Cancel</Button>
              <Button onClick={handleDelete} disabled={loading} className="bg-rose-600 hover:bg-rose-700">
                {loading ? "Deleting…" : "Delete"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Description</label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setConfirmDelete(true)}
                disabled={loading}
                className="mr-auto text-rose-600 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>Cancel</Button>
              <Button onClick={handleSave} disabled={loading || !name.trim()}>
                {loading ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Manage Members Dialog ─────────────────────────────────────────────────────

type Employee = { id: string; name: string; role: string };

function ManageMembersDialog({
  channel,
  currentUserEmployeeId,
}: {
  channel: ChatChannel;
  currentUserEmployeeId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<ChannelMember[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  async function loadData() {
    setLoading(true);
    try {
      const [membersRes, empRes] = await Promise.all([
        fetch(`/api/chat/members?channelId=${channel.id}`),
        fetch(`/api/employees?hasAccount=true`),
      ]);
      const membersData = await membersRes.json();
      const empData = await empRes.json();
      setMembers(Array.isArray(membersData.members) ? membersData.members : []);
      setAllEmployees(Array.isArray(empData.employees) ? empData.employees : []);
    } catch (error) {
      toast.error("Failed to load members");
    } finally {
      setLoading(false);
    }
  }

  async function toggleMember(employee: Employee) {
    const isMember = members.some((m) => m.employeeId === employee.id);
    try {
      if (isMember) {
        const res = await fetch("/api/chat/members", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ channelId: channel.id, employeeId: employee.id }),
        });
        if (!res.ok) throw new Error();
        setMembers((prev) => prev.filter((m) => m.employeeId !== employee.id));
        toast.success(`${employee.name} removed`);
      } else {
        const res = await fetch("/api/chat/members", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            channelId: channel.id,
            employeeId: employee.id,
            addedBy: currentUserEmployeeId ?? undefined,
          }),
        });
        if (!res.ok) throw new Error();
        setMembers((prev) => [
          ...prev,
          {
            id: `tmp-${employee.id}`,
            channelId: channel.id,
            employeeId: employee.id,
            employeeName: employee.name,
            employeeRole: employee.role,
            addedAt: new Date().toISOString(),
          },
        ]);
        toast.success(`${employee.name} added`);
      }
    } catch {
      toast.error("Failed to update members");
    }
  }

  const filtered = useMemo(
    () =>
      allEmployees.filter((e) => {
        if (currentUserEmployeeId && e.id === currentUserEmployeeId) return false;
        return search.trim() ? e.name.toLowerCase().includes(search.trim().toLowerCase()) : true;
      }),
    [allEmployees, search, currentUserEmployeeId]
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void loadData();
      }}
    >
      <DialogTrigger asChild>
        <button type="button" className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
          <Users className="h-3.5 w-3.5" />
          Members
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Manage members — {channel.name}</DialogTitle>
        </DialogHeader>
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employees" className="pl-9" />
        </label>
        <div className="max-h-64 overflow-y-auto">
          {loading ? (
            <p className="py-6 text-center text-sm text-slate-500">Loading…</p>
          ) : (
            <div className="space-y-1">
              {filtered.map((emp) => {
                const isMember = members.some((m) => m.employeeId === emp.id);
                return (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => void toggleMember(emp)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-slate-50"
                  >
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${isMember ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300"}`}>
                      {isMember && <Check className="h-3 w-3" />}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-900">{emp.name}</span>
                      <span className="block truncate text-xs text-slate-500">{emp.role}</span>
                    </span>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <p className="py-4 text-center text-sm text-slate-500">No employees found</p>
              )}
            </div>
          )}
        </div>
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}

// ─── Message Bubble ────────────────────────────────────────────────────────────

function MessageBubble({
  message,
  canPin,
  canDeleteAny,
  onPin,
  onDelete,
  onEdit,
}: {
  message: ChatMessage;
  canPin: boolean;
  canDeleteAny: boolean;
  onPin: (id: string, pinned: boolean) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, content: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(message.content);

  const isLocal = message.id.startsWith("local-");
  const canDelete = canDeleteAny || message.mine;
  const showActions = (canPin || canDelete || message.mine) && !editing && !isLocal;

  if (message.isDeleted) {
    return (
      <div className={`flex ${message.mine ? "justify-end" : "justify-start"}`}>
        <div className="max-w-[78%] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs italic text-slate-400">
          Message deleted
        </div>
      </div>
    );
  }

  // flex-col keeps action bar + bubble in one hover zone so moving to the bar never loses hover
  return (
    <div className={`group flex flex-col ${message.mine ? "items-end" : "items-start"}`}>
      {/* Action bar — above bubble, inside the same hover group */}
      {showActions && (
        <div className="mb-1 flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2 py-1 shadow-md opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-150 ease-out translate-y-1 group-hover:translate-y-0">
          {canPin && (
            <button
              type="button"
              onClick={() => onPin(message.id, !message.isPinned)}
              className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-amber-600"
              title={message.isPinned ? "Unpin" : "Pin"}
            >
              {message.isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
            </button>
          )}
          {message.mine && (
            <button
              type="button"
              onClick={() => { setEditDraft(message.content); setEditing(true); }}
              className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-blue-600"
              title="Edit"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => onDelete(message.id)}
              className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-rose-600"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      <div className="max-w-[78%]">
        {/* Pin indicator */}
        {message.isPinned && (
          <div className="mb-1 flex items-center gap-1 text-[10px] font-medium text-amber-600">
            <Pin className="h-3 w-3" /> Pinned
          </div>
        )}

        <div
          className={`rounded-2xl px-4 py-3 ${
            message.mine
              ? "bg-blue-600 text-white"
              : "border border-slate-200 bg-white text-slate-900"
          }`}
        >
          <div className={`text-xs font-semibold ${message.mine ? "text-blue-100" : "text-slate-500"}`}>
            {message.employeeName} · {message.employeeRole}
          </div>

          {editing ? (
            <div className="mt-2 space-y-2">
              <textarea
                className="w-full resize-none rounded-lg border border-white/40 bg-white/20 px-3 py-2 text-sm text-white placeholder-white/60 outline-none"
                value={editDraft}
                onChange={(e) => setEditDraft(e.target.value)}
                rows={3}
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { onEdit(message.id, editDraft); setEditing(false); }}
                  disabled={!editDraft.trim() || editDraft === message.content}
                  className="flex items-center gap-1 rounded-lg bg-white/20 px-2.5 py-1 text-xs font-medium text-white hover:bg-white/30 disabled:opacity-40"
                >
                  <Check className="h-3 w-3" /> Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="flex items-center gap-1 rounded-lg bg-white/20 px-2.5 py-1 text-xs font-medium text-white hover:bg-white/30"
                >
                  <X className="h-3 w-3" /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-1 text-sm leading-6">{message.content}</p>
          )}

          <div className={`mt-2 flex items-center gap-1.5 text-[11px] ${message.mine ? "text-blue-100" : "text-slate-500"}`}>
            {fmtTime(message.timestamp)}
            {message.isEdited && <span className="opacity-70">(edited)</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const { lang } = useLanguage();
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole("admin", "super_admin");

  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [activeChannelId, setActiveChannelId] = useState("");
  const [query, setQuery] = useState("");
  const [drafts, setDrafts] = useState<DraftState>({});
  const bottomRef = useRef<HTMLDivElement>(null);

  const text =
    lang === "sv"
      ? {
          search: "Sök kanal",
          channels: "Kanaler",
          unread: "oläst",
          composer: "Skriv ett kort operativt meddelande",
          sent: "Meddelandet skickades",
        }
      : {
          search: "Search channels",
          channels: "Channels",
          unread: "unread",
          composer: "Write a short operational update",
          sent: "Message sent",
        };

  // Load channels
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setChannelsLoading(true);
        const res = await fetch(`/api/chat/channels?locationId=${LOCATION_ID}`);
        const data = await res.json();
        if (!active) return;
        const chans = Array.isArray(data.channels) ? data.channels : [];
        setChannels(chans);
        setActiveChannelId(chans[0]?.id ?? "");
      } catch (error) {
        console.error(error);
        toast.error("Could not load channels");
      } finally {
        if (active) setChannelsLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  // Load messages when channel changes
  useEffect(() => {
    if (!activeChannelId) return;
    let active = true;
    (async () => {
      try {
        setMessagesLoading(true);
        const res = await fetch(`/api/chat/messages?channelId=${activeChannelId}&limit=100`);
        const data = await res.json();
        if (!active) return;
        const msgs: ChatMessage[] = Array.isArray(data.messages) ? data.messages : [];
        // Mark own messages
        const myEmployeeId = user?.employeeId ?? null;
        setMessages(msgs.map((m) => ({ ...m, mine: myEmployeeId ? m.employeeId === myEmployeeId : false })));
      } catch (error) {
        console.error(error);
        toast.error("Could not load messages");
      } finally {
        if (active) setMessagesLoading(false);
      }
    })();
    return () => { active = false; };
  }, [activeChannelId, user?.employeeId]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const filteredChannels = useMemo(
    () =>
      channels.filter((channel) => {
        const haystack = `${channel.name} ${channel.description ?? ""}`.toLowerCase();
        return query.trim() ? haystack.includes(query.trim().toLowerCase()) : true;
      }),
    [channels, query]
  );

  const activeChannel = useMemo(
    () =>
      filteredChannels.find((channel) => channel.id === activeChannelId) ??
      channels.find((channel) => channel.id === activeChannelId) ??
      channels[0],
    [activeChannelId, channels, filteredChannels]
  );

  const visibleMessages = useMemo(
    () => messages.filter((message) => message.channelId === activeChannel?.id),
    [activeChannel?.id, messages]
  );

  const draft = drafts[activeChannel?.id ?? ""] ?? "";

  function sendMessage() {
    if (!draft.trim() || !activeChannel) return;
    const senderId = user?.employeeId ?? "local-user";
    const optimistic: ChatMessage = {
      id: `local-${Date.now()}`,
      channelId: activeChannel.id,
      employeeId: senderId,
      employeeName: user?.name ?? (lang === "sv" ? "Du" : "You"),
      employeeRole: user?.role ?? (lang === "sv" ? "Chef" : "Manager"),
      content: draft.trim(),
      timestamp: new Date().toISOString(),
      mine: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    setDrafts((prev) => ({ ...prev, [activeChannel.id]: "" }));
    fetch("/api/chat/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ channelId: activeChannel.id, senderId, message: draft.trim() }),
    })
      .then(() => toast.success(text.sent))
      .catch((error) => {
        console.error(error);
        toast.error("Failed to send message");
      });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  async function handlePin(messageId: string, isPinned: boolean) {
    setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, isPinned } : m));
    try {
      const res = await fetch("/api/chat/pin", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messageId, isPinned }),
      });
      if (!res.ok) throw new Error();
      toast.success(isPinned ? "Message pinned" : "Message unpinned");
    } catch {
      setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, isPinned: !isPinned } : m));
      toast.error("Failed to update pin");
    }
  }

  async function handleDelete(messageId: string) {
    const isAdmin = hasRole("admin", "super_admin");
    const senderId = user?.employeeId ?? "local-user";
    setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, isDeleted: true } : m));
    try {
      const res = await fetch("/api/chat/messages", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messageId, senderId, isAdmin }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, isDeleted: false } : m));
      toast.error("Failed to delete message");
    }
  }

  async function handleEdit(messageId: string, content: string) {
    const senderId = user?.employeeId ?? "local-user";
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, content, isEdited: true } : m
      )
    );
    try {
      const res = await fetch("/api/chat/messages", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messageId, content, senderId }),
      });
      if (!res.ok) throw new Error();
    } catch {
      toast.error("Failed to edit message");
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
      {/* ── Sidebar ── */}
      <aside className="app-panel p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="section-title">{text.channels}</h2>
          {isAdmin && (
            <CreateChannelDialog
              createdBy={user?.employeeId ?? null}
              onCreated={(channel) => {
                setChannels((prev) => [...prev, channel]);
                setActiveChannelId(channel.id);
              }}
            />
          )}
        </div>
        <label className="relative mt-4 block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={text.search}
            className="pl-9"
          />
        </label>
        <div className="mt-4 list-block">
          {channelsLoading ? (
            <div className="py-6 text-center text-sm text-slate-400">Loading…</div>
          ) : (
            filteredChannels.map((channel) => {
              const isActive = channel.id === activeChannel?.id;
              const myEmployeeId = user?.employeeId ?? null;
              const isSuperAdmin = user?.role === "super_admin";
              const canEdit =
                isSuperAdmin ||
                (myEmployeeId !== null && channel.createdBy === myEmployeeId);
              return (
                <div key={channel.id} className={`group list-row ${isActive ? "surface-info" : ""}`}>
                  <button
                    type="button"
                    onClick={() => setActiveChannelId(channel.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="list-row-main">
                      <div className="list-row-title">{channel.name}</div>
                      {channel.description && (
                        <div className="list-row-copy">{channel.description}</div>
                      )}
                    </div>
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    {channel.unreadCount && channel.unreadCount > 0 ? (
                      <span className="status-chip status-info">{channel.unreadCount}</span>
                    ) : null}
                    {canEdit && (
                      <EditChannelDialog
                        channel={channel}
                        requesterId={myEmployeeId}
                        isSuperAdmin={isSuperAdmin}
                        onUpdated={(updated) =>
                          setChannels((prev) => prev.map((c) => c.id === updated.id ? updated : c))
                        }
                        onDeleted={(id) => {
                          setChannels((prev) => prev.filter((c) => c.id !== id));
                          if (activeChannelId === id) {
                            setActiveChannelId(channels.find((c) => c.id !== id)?.id ?? "");
                          }
                        }}
                      />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* ── Chat panel ── */}
      <section className="app-panel flex min-h-[720px] flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="section-title">{activeChannel?.name ?? "—"}</h3>
              <p className="section-copy">{activeChannel?.description}</p>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && activeChannel && (
                <ManageMembersDialog
                  channel={activeChannel}
                  currentUserEmployeeId={user?.employeeId ?? null}
                />
              )}
              <span className="status-chip status-neutral">{visibleMessages.filter((m) => !m.isDeleted).length} messages</span>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-5 py-5">
          {messagesLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading messages…</div>
          ) : visibleMessages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">No messages yet. Start the conversation.</div>
          ) : (
            visibleMessages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                canPin={isAdmin}
                canDeleteAny={isAdmin}
                onPin={handlePin}
                onDelete={handleDelete}
                onEdit={handleEdit}
              />
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Composer */}
        <div className="border-t border-slate-200 p-4">
          <div className="flex items-end gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <textarea
              value={draft}
              onChange={(event) =>
                setDrafts((prev) => ({
                  ...prev,
                  [activeChannel?.id ?? ""]: event.target.value,
                }))
              }
              onKeyDown={handleKeyDown}
              rows={3}
              placeholder={text.composer}
              className="min-h-[72px] flex-1 resize-none bg-transparent text-sm text-slate-900 outline-none"
            />
            <Button
              className="h-11 w-11 rounded-xl p-0"
              onClick={sendMessage}
              disabled={!draft.trim()}
            >
              <SendHorizonal className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-400">Enter to send · Shift+Enter for new line</p>
        </div>
      </section>
    </div>
  );
}
