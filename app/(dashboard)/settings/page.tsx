"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SettingsPayload } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";

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

export default function SettingsPage() {
  const { hasRole, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !hasRole("admin", "super_admin")) {
      router.replace("/");
    }
  }, [authLoading, hasRole, router]);

  const [settings, setSettings] = useState<SettingsPayload>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch("/api/settings", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error("Failed to load settings");
        setSettings(payload.settings ?? DEFAULT_SETTINGS);
      } catch (error) {
        console.error(error);
        toast.error("Could not load settings");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (authLoading || !hasRole("admin", "super_admin")) return null;

  async function saveSettings() {
    setSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!response.ok) throw new Error("Failed to save settings");
      toast.success("Settings saved");
    } catch (error) {
      console.error(error);
      toast.error("Could not save settings");
    } finally {
      setSaving(false);
    }
  }

  function resetSettings() {
    setSettings(DEFAULT_SETTINGS);
  }

  if (loading) {
    return <div className="app-panel px-5 py-10 text-sm text-slate-600">Loading settings...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="app-panel p-5">
          <h2 className="section-title">General</h2>
          <div className="mt-4 grid gap-4">
            <label className="list-row">
              <div className="list-row-main">
                <div className="list-row-title">Compact mode</div>
                <div className="list-row-copy">Use denser spacing for operational screens.</div>
              </div>
              <input
                type="checkbox"
                checked={settings.userPreferences.compactMode}
                onChange={(event) =>
                  setSettings((prev) => ({
                    ...prev,
                    userPreferences: { ...prev.userPreferences, compactMode: event.target.checked },
                  }))
                }
              />
            </label>
            <label className="list-row">
              <div className="list-row-main">
                <div className="list-row-title">Week starts Monday</div>
                <div className="list-row-copy">Keep planning views aligned with local operations.</div>
              </div>
              <input
                type="checkbox"
                checked={settings.userPreferences.weekStartsOnMonday}
                onChange={(event) =>
                  setSettings((prev) => ({
                    ...prev,
                    userPreferences: { ...prev.userPreferences, weekStartsOnMonday: event.target.checked },
                  }))
                }
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                type="time"
                value={settings.workingHours.start}
                onChange={(event) =>
                  setSettings((prev) => ({
                    ...prev,
                    workingHours: { ...prev.workingHours, start: event.target.value },
                  }))
                }
              />
              <Input
                type="time"
                value={settings.workingHours.end}
                onChange={(event) =>
                  setSettings((prev) => ({
                    ...prev,
                    workingHours: { ...prev.workingHours, end: event.target.value },
                  }))
                }
              />
            </div>
            <Input
              value={settings.timezone}
              onChange={(event) => setSettings((prev) => ({ ...prev, timezone: event.target.value }))}
              placeholder="Timezone"
            />
          </div>
        </div>

        <div className="app-panel p-5">
          <h2 className="section-title">Notifications</h2>
          <div className="mt-4 list-block">
            {[
              ["shiftAssigned", "Shift assigned alerts"],
              ["shiftUpdated", "Shift update alerts"],
              ["shiftConflict", "Conflict alerts"],
              ["aiSuggestion", "AI recommendation alerts"],
            ].map(([key, label]) => (
              <label key={key} className="list-row">
                <div className="list-row-main">
                  <div className="list-row-title">{label}</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.notificationPreferences[key as keyof SettingsPayload["notificationPreferences"]]}
                  onChange={(event) =>
                    setSettings((prev) => ({
                      ...prev,
                      notificationPreferences: {
                        ...prev.notificationPreferences,
                        [key]: event.target.checked,
                      },
                    }))
                  }
                />
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="app-panel p-5">
          <h2 className="section-title">AI settings</h2>
          <div className="mt-4 list-block">
            <label className="list-row">
              <div className="list-row-main">
                <div className="list-row-title">Optimise fairness</div>
                <div className="list-row-copy">Spread hours more evenly unless constraints require otherwise.</div>
              </div>
              <input
                type="checkbox"
                checked={settings.aiPreferences.optimizeForFairness}
                onChange={(event) =>
                  setSettings((prev) => ({
                    ...prev,
                    aiPreferences: { ...prev.aiPreferences, optimizeForFairness: event.target.checked },
                  }))
                }
              />
            </label>
            <label className="list-row">
              <div className="list-row-main">
                <div className="list-row-title">Avoid overtime</div>
                <div className="list-row-copy">Prefer suggestions that stay under max weekly hours.</div>
              </div>
              <input
                type="checkbox"
                checked={settings.aiPreferences.avoidOvertime}
                onChange={(event) =>
                  setSettings((prev) => ({
                    ...prev,
                    aiPreferences: { ...prev.aiPreferences, avoidOvertime: event.target.checked },
                  }))
                }
              />
            </label>
            <select
              value={settings.aiPreferences.assistantTone}
              onChange={(event) =>
                setSettings((prev) => ({
                  ...prev,
                  aiPreferences: {
                    ...prev.aiPreferences,
                    assistantTone: event.target.value as SettingsPayload["aiPreferences"]["assistantTone"],
                  },
                }))
              }
              className="filter-input"
            >
              <option value="concise">Concise</option>
              <option value="balanced">Balanced</option>
              <option value="detailed">Detailed</option>
            </select>
          </div>
        </div>

        <div className="app-panel p-5 surface-danger">
          <h2 className="section-title">Reset and control</h2>
          <p className="section-copy mt-2">
            Keep changes explicit. Reset only when you want to roll back local configuration.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Button variant="outline" onClick={resetSettings}>
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
            <Button onClick={() => void saveSettings()} disabled={saving}>
              <Save className="h-4 w-4" />
              Save changes
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
