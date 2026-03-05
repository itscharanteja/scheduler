"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LanguageProvider, useLanguage } from "@/context/LanguageContext";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type React from "react";
import {
  Bell,
  Calendar,
  LayoutDashboard,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import type { AppNotification, SettingsPayload } from "@/lib/types";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const DEFAULT_SETTINGS: SettingsPayload = {
  userPreferences: {
    compactMode: false,
    weekStartsOnMonday: true,
  },
  notificationPreferences: {
    shiftAssigned: true,
    shiftUpdated: true,
    shiftConflict: true,
    aiSuggestion: true,
  },
  workingHours: {
    start: "09:00",
    end: "17:00",
  },
  timezone: "Europe/Stockholm",
  aiPreferences: {
    optimizeForFairness: true,
    avoidOvertime: true,
    assistantTone: "balanced",
  },
};

function ShellLayout({ children }: { children: React.ReactNode }) {
  const { t, lang, setLang } = useLanguage();
  const pathname = usePathname();
  const notificationPanelRef = useRef<HTMLDivElement | null>(null);
  const bellButtonRef = useRef<HTMLButtonElement | null>(null);

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationPosition, setNotificationPosition] = useState({
    top: 64,
    right: 16,
  });

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settings, setSettings] = useState<SettingsPayload>(DEFAULT_SETTINGS);

  const navItems = [
    {
      href: "/dashboard",
      label: t("nav.dashboard"),
      icon: LayoutDashboard,
    },
    {
      href: "/dashboard/schedule",
      label: t("nav.schedule"),
      icon: Calendar,
    },
    {
      href: "/dashboard/employees",
      label: t("nav.employees"),
      icon: Users,
    },
    {
      href: "/dashboard/ai-agent",
      label: t("nav.aiAgent"),
      icon: Sparkles,
    },
  ];

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications]
  );

  const updateNotificationPosition = useCallback(() => {
    const bell = bellButtonRef.current;
    if (!bell) return;
    const rect = bell.getBoundingClientRect();
    const panelWidth = 360;
    const minRight = 12;
    const computedRight = Math.max(window.innerWidth - rect.right, minRight);
    const maxRight = Math.max(window.innerWidth - panelWidth - minRight, minRight);
    const right = Math.min(computedRight, maxRight);
    const top = Math.max(rect.bottom + 10, 64);
    setNotificationPosition({ top, right });
  }, []);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!notificationsOpen) return;
      const target = event.target as Node;
      if (
        notificationPanelRef.current?.contains(target) ||
        bellButtonRef.current?.contains(target)
      ) {
        return;
      }
      setNotificationsOpen(false);
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [notificationsOpen]);

  useEffect(() => {
    if (!notificationsOpen) return;
    updateNotificationPosition();
    const onViewportChange = () => updateNotificationPosition();
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);
    return () => {
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
    };
  }, [notificationsOpen, updateNotificationPosition]);

  async function fetchSettings() {
    setSettingsLoading(true);
    try {
      const response = await fetch("/api/settings", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error("Failed to fetch settings.");
      }
      setSettings(payload.settings ?? DEFAULT_SETTINGS);
    } catch (error) {
      console.error(error);
      toast.error("Failed to save — try again");
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setSettingsLoading(false);
    }
  }

  async function saveSettings() {
    setSettingsSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(settings),
      });
      if (!response.ok) {
        throw new Error("Failed to save settings.");
      }
      toast.success("Settings saved");
      setSettingsOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to save — try again");
    } finally {
      setSettingsSaving(false);
    }
  }

  async function fetchNotifications() {
    setNotificationsLoading(true);
    try {
      const response = await fetch("/api/notifications?limit=12", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error("Failed to fetch notifications.");
      }
      setNotifications(Array.isArray(payload.notifications) ? payload.notifications : []);
    } catch (error) {
      console.error(error);
      toast.error("Failed to save — try again");
    } finally {
      setNotificationsLoading(false);
    }
  }

  async function handleMarkAsRead(id: string) {
    setNotifications((prev) =>
      prev.map((item) => (item.id === id ? { ...item, read: true } : item))
    );
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch (error) {
      console.error(error);
    }
  }

  async function handleClearNotifications() {
    try {
      await fetch("/api/notifications", { method: "DELETE" });
      setNotifications([]);
    } catch (error) {
      console.error(error);
      toast.error("Failed to save — try again");
    }
  }

  return (
    <div className="glass-scene">
      <header className="sticky top-4 z-40 flex justify-center px-4">
        <div className="glass-header flex h-[68px] w-full max-w-[1200px] items-center justify-between px-7">
          <div className="flex items-center">
            <span className="text-[22px] font-semibold tracking-[-0.02em] text-[#1D1D1F]">
              {t("app.title")}
            </span>
          </div>

          <nav className="flex flex-1 items-center justify-center">
            <div className="flex items-center gap-3">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`glass-nav-button inline-flex h-10 items-center gap-2 px-4 text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-white/82 text-slate-900"
                        : "text-slate-700/90 hover:text-slate-900"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>

          <div className="flex items-center gap-2">
            <button
              ref={bellButtonRef}
              type="button"
              className="glass-nav-button flex h-10 w-10 items-center justify-center rounded-full text-slate-700 hover:text-slate-900"
              onClick={() => {
                const nextOpen = !notificationsOpen;
                if (nextOpen) {
                  updateNotificationPosition();
                }
                setNotificationsOpen(nextOpen);
                if (nextOpen) {
                  void fetchNotifications();
                }
              }}
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-sky-500" />
              )}
            </button>
            <button
              type="button"
              className="glass-nav-button flex h-10 w-10 items-center justify-center rounded-full text-slate-700 hover:text-slate-900"
              onClick={() => {
                setSettingsOpen(true);
                void fetchSettings();
              }}
              aria-label="Settings"
            >
              <Settings className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="glass-nav-button flex h-10 w-10 items-center justify-center rounded-full text-slate-700 hover:text-slate-900"
              onClick={() => setLang(lang === "en" ? "sv" : "en")}
              aria-label="Language"
              title={lang === "en" ? "Switch to Swedish" : "Switch to English"}
            >
              <span className="text-xs font-semibold">{lang === "en" ? "SV" : "EN"}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="pointer-events-none fixed inset-0 z-[1000]">
        <div
          ref={notificationPanelRef}
          className={`glass-card pointer-events-auto fixed !left-auto !right-4 top-16 w-[360px] max-w-[calc(100vw-1rem)] origin-top-right p-3 transition-all duration-[220ms] ease-[cubic-bezier(0.4,0,0.2,1)] will-change-transform ${
            notificationsOpen
              ? "translate-y-0 scale-100 opacity-100"
              : "pointer-events-none -translate-y-[5px] scale-[0.97] opacity-0"
          }`}
          style={{
            top: `${notificationPosition.top}px`,
            right: `${notificationPosition.right}px`,
          }}
        >
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
            <button
              type="button"
              className="text-xs text-slate-600 transition-colors hover:text-slate-900"
              onClick={() => void handleClearNotifications()}
            >
              Clear
            </button>
          </div>
          <div className="max-h-[360px] space-y-2 overflow-auto pr-1">
            {notificationsLoading ? (
              <div className="h-20 animate-pulse rounded-2xl bg-white/50" />
            ) : notifications.length === 0 ? (
              <div className="rounded-2xl border border-white/70 bg-white/60 px-3 py-6 text-center text-sm text-slate-600">
                No notifications
              </div>
            ) : (
              notifications.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void handleMarkAsRead(item.id)}
                  className="glass-muted w-full rounded-2xl border border-white/70 p-3 text-left transition hover:brightness-105"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold text-slate-900">
                        {item.title}
                      </div>
                      <div className="mt-1 text-xs text-slate-700">{item.message}</div>
                      <div className="mt-1 text-[11px] text-slate-500">
                        {new Date(item.timestamp).toLocaleString()}
                      </div>
                    </div>
                    {!item.read && (
                      <span className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-sky-500" />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      <main className="px-6 pb-10 pt-8">
        <div className="mx-auto w-full max-w-[1200px] px-6">{children}</div>
      </main>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="glass-shift-modal max-w-xl border-none bg-transparent">
          <DialogHeader>
            <DialogTitle className="font-mono text-slate-900">Settings</DialogTitle>
            <DialogDescription className="text-slate-600">
              User preferences, notifications, working hours, timezone and AI behavior.
            </DialogDescription>
          </DialogHeader>
          {settingsLoading ? (
            <div className="h-36 animate-pulse rounded-2xl bg-white/50" />
          ) : (
            <div className="space-y-4 text-sm text-slate-800">
              <div className="grid grid-cols-2 gap-3">
                <label className="glass-muted flex items-center justify-between rounded-xl border border-white/70 px-3 py-2">
                  <span>Compact mode</span>
                  <input
                    type="checkbox"
                    checked={settings.userPreferences.compactMode}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        userPreferences: {
                          ...prev.userPreferences,
                          compactMode: e.target.checked,
                        },
                      }))
                    }
                  />
                </label>
                <label className="glass-muted flex items-center justify-between rounded-xl border border-white/70 px-3 py-2">
                  <span>Week starts Monday</span>
                  <input
                    type="checkbox"
                    checked={settings.userPreferences.weekStartsOnMonday}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        userPreferences: {
                          ...prev.userPreferences,
                          weekStartsOnMonday: e.target.checked,
                        },
                      }))
                    }
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-slate-600">Working hours start</label>
                  <Input
                    type="time"
                    value={settings.workingHours.start}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        workingHours: { ...prev.workingHours, start: e.target.value },
                      }))
                    }
                    className="border-white/80 bg-white/70"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-600">Working hours end</label>
                  <Input
                    type="time"
                    value={settings.workingHours.end}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        workingHours: { ...prev.workingHours, end: e.target.value },
                      }))
                    }
                    className="border-white/80 bg-white/70"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs text-slate-600">Timezone</label>
                <Input
                  value={settings.timezone}
                  onChange={(e) => setSettings((prev) => ({ ...prev, timezone: e.target.value }))}
                  className="border-white/80 bg-white/70"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="glass-muted flex items-center justify-between rounded-xl border border-white/70 px-3 py-2">
                  <span>Shift assigned alerts</span>
                  <input
                    type="checkbox"
                    checked={settings.notificationPreferences.shiftAssigned}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        notificationPreferences: {
                          ...prev.notificationPreferences,
                          shiftAssigned: e.target.checked,
                        },
                      }))
                    }
                  />
                </label>
                <label className="glass-muted flex items-center justify-between rounded-xl border border-white/70 px-3 py-2">
                  <span>Shift update alerts</span>
                  <input
                    type="checkbox"
                    checked={settings.notificationPreferences.shiftUpdated}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        notificationPreferences: {
                          ...prev.notificationPreferences,
                          shiftUpdated: e.target.checked,
                        },
                      }))
                    }
                  />
                </label>
                <label className="glass-muted flex items-center justify-between rounded-xl border border-white/70 px-3 py-2">
                  <span>Conflict alerts</span>
                  <input
                    type="checkbox"
                    checked={settings.notificationPreferences.shiftConflict}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        notificationPreferences: {
                          ...prev.notificationPreferences,
                          shiftConflict: e.target.checked,
                        },
                      }))
                    }
                  />
                </label>
                <label className="glass-muted flex items-center justify-between rounded-xl border border-white/70 px-3 py-2">
                  <span>AI suggestions</span>
                  <input
                    type="checkbox"
                    checked={settings.notificationPreferences.aiSuggestion}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        notificationPreferences: {
                          ...prev.notificationPreferences,
                          aiSuggestion: e.target.checked,
                        },
                      }))
                    }
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="glass-muted flex items-center justify-between rounded-xl border border-white/70 px-3 py-2">
                  <span>Optimize for fairness</span>
                  <input
                    type="checkbox"
                    checked={settings.aiPreferences.optimizeForFairness}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        aiPreferences: {
                          ...prev.aiPreferences,
                          optimizeForFairness: e.target.checked,
                        },
                      }))
                    }
                  />
                </label>
                <label className="glass-muted flex items-center justify-between rounded-xl border border-white/70 px-3 py-2">
                  <span>Avoid overtime</span>
                  <input
                    type="checkbox"
                    checked={settings.aiPreferences.avoidOvertime}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        aiPreferences: {
                          ...prev.aiPreferences,
                          avoidOvertime: e.target.checked,
                        },
                      }))
                    }
                  />
                </label>
              </div>
            </div>
          )}
          <DialogFooter className="mt-2 gap-2">
            <Button
              type="button"
              variant="outline"
              className="glass-popup-button text-slate-900"
              onClick={() => setSettingsOpen(false)}
              disabled={settingsSaving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="glass-popup-button border-white/90 bg-white/80 text-slate-900"
              onClick={() => void saveSettings()}
              disabled={settingsSaving}
            >
              {settingsSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function LanguageAppShell({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <ShellLayout>{children}</ShellLayout>
    </LanguageProvider>
  );
}
