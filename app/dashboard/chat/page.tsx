"use client";

import { useMemo, useState } from "react";
import { Pin, Search, SendHorizonal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/context/LanguageContext";
import { mockChatChannels, mockChatMessages } from "@/lib/mock-data";

type DraftState = Record<string, string>;

export default function ChatPage() {
  const { lang } = useLanguage();
  const [activeChannelId, setActiveChannelId] = useState(mockChatChannels[0]?.id ?? "");
  const [messages, setMessages] = useState(mockChatMessages);
  const [query, setQuery] = useState("");
  const [drafts, setDrafts] = useState<DraftState>({});

  const text =
    lang === "sv"
      ? {
          search: "Sök kanal eller innehåll",
          pinned: "Fästa uppdateringar",
          channels: "Kanaler",
          unread: "oläst",
          composer: "Skriv ett kort operativt meddelande",
          sent: "Meddelandet skickades",
        }
      : {
          search: "Search channels or content",
          pinned: "Pinned updates",
          channels: "Channels",
          unread: "unread",
          composer: "Write a short operational update",
          sent: "Message sent",
        };

  const filteredChannels = useMemo(() => {
    return mockChatChannels.filter((channel) => {
      const haystack = `${channel.name} ${channel.description}`.toLowerCase();
      return query.trim() ? haystack.includes(query.trim().toLowerCase()) : true;
    });
  }, [query]);

  const activeChannel =
    filteredChannels.find((channel) => channel.id === activeChannelId) ??
    mockChatChannels.find((channel) => channel.id === activeChannelId) ??
    mockChatChannels[0];

  const visibleMessages = useMemo(
    () => messages.filter((message) => message.channelId === activeChannel?.id),
    [activeChannel?.id, messages]
  );

  const draft = drafts[activeChannel?.id ?? ""] ?? "";

  function sendMessage() {
    if (!draft.trim() || !activeChannel) return;
    setMessages((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        channelId: activeChannel.id,
        employeeId: "local-user",
        employeeName: lang === "sv" ? "Du" : "You",
        employeeRole: lang === "sv" ? "Chef" : "Manager",
        content: draft.trim(),
        timestamp: new Date().toISOString(),
        mine: true,
      },
    ]);
    setDrafts((prev) => ({ ...prev, [activeChannel.id]: "" }));
    toast.success(text.sent);
  }

  const pinnedItems = [
    lang === "sv"
      ? "18:00-20:00 kräver extra koll på leveransflödet."
      : "18:00-20:00 needs extra watch on delivery flow.",
    lang === "sv"
      ? "Skiftledare bekräftar personaltäckning senast 15:30."
      : "Shift leader confirms staffing coverage by 15:30.",
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-[280px_340px_minmax(0,1fr)]">
      <aside className="app-panel p-4">
        <div className="flex items-center gap-2">
          <h2 className="section-title">{text.channels}</h2>
        </div>
        <label className="relative mt-4 block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={text.search} className="pl-9" />
        </label>
        <div className="mt-4 list-block">
          {filteredChannels.map((channel) => {
            const isActive = channel.id === activeChannel?.id;
            return (
              <button
                key={channel.id}
                type="button"
                onClick={() => setActiveChannelId(channel.id)}
                className={`list-row text-left ${isActive ? "surface-info" : ""}`}
              >
                <div className="list-row-main">
                  <div className="list-row-title">{channel.name}</div>
                  <div className="list-row-copy">{channel.description}</div>
                </div>
                {channel.unreadCount > 0 ? (
                  <span className="status-chip status-info">{channel.unreadCount}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </aside>

      <section className="space-y-4">
        <div className="app-panel p-4">
          <div className="flex items-center gap-2">
            <Pin className="h-4 w-4 text-slate-500" />
            <h3 className="section-title">{text.pinned}</h3>
          </div>
          <div className="mt-4 list-block">
            {pinnedItems.map((item) => (
              <div key={item} className="list-row surface-warning">
                <div className="list-row-main">
                  <div className="list-row-title">{item}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="app-panel p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="section-title">{activeChannel?.name}</h3>
              <p className="section-copy">{activeChannel?.description}</p>
            </div>
            <span className="status-chip status-neutral">
              {activeChannel?.unreadCount ?? 0} {text.unread}
            </span>
          </div>
          <div className="mt-4 list-block">
            {visibleMessages.slice(-4).map((message) => (
              <div key={message.id} className="list-row">
                <div className="list-row-main">
                  <div className="flex items-center gap-2">
                    <div className="list-row-title">{message.employeeName}</div>
                    <span className="text-xs text-slate-500">{message.employeeRole}</span>
                  </div>
                  <div className="list-row-copy">{message.content}</div>
                </div>
                <div className="text-xs text-slate-500">
                  {new Date(message.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="app-panel flex min-h-[720px] flex-col overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="section-title">{activeChannel?.name}</h3>
              <p className="section-copy">{activeChannel?.participantCount} participants</p>
            </div>
            <span className="status-chip status-neutral">{visibleMessages.length} messages</span>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-5 py-5">
          {visibleMessages.map((message) => (
            <div key={message.id} className={`flex ${message.mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[78%] rounded-2xl px-4 py-3 ${message.mine ? "bg-blue-600 text-white" : "border border-slate-200 bg-white text-slate-900"}`}>
                <div className={`text-xs font-semibold ${message.mine ? "text-blue-100" : "text-slate-500"}`}>
                  {message.employeeName} • {message.employeeRole}
                </div>
                <p className="mt-1 text-sm leading-6">{message.content}</p>
                <div className={`mt-2 text-[11px] ${message.mine ? "text-blue-100" : "text-slate-500"}`}>
                  {new Date(message.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>

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
              rows={3}
              placeholder={text.composer}
              className="min-h-[72px] flex-1 resize-none bg-transparent text-sm text-slate-900 outline-none"
            />
            <Button className="h-11 w-11 rounded-xl p-0" onClick={sendMessage} disabled={!draft.trim()}>
              <SendHorizonal className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
