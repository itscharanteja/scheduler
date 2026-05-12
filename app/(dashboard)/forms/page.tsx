"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ClipboardEdit, Plus, Pencil, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "@/context/LocationContext";
import { useLanguage } from "@/context/LanguageContext";
import type { CustomForm } from "@/lib/types";

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  return format(new Date(iso), "MMM d, yyyy");
}

export default function FormsPage() {
  const { hasRole } = useAuth();
  const { locationId } = useLocation();
  const { lang } = useLanguage();
  const router = useRouter();

  const [forms, setForms] = useState<CustomForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [creating, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isAdmin = hasRole("admin", "super_admin");

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (locationId) params.set("locationId", locationId);
      const res = await fetch(`/api/forms?${params}`);
      if (!res.ok) throw new Error("Failed to load");
      const { data } = await res.json();
      setForms(data ?? []);
    } catch {
      toast.error(lang === "sv" ? "Kunde inte ladda formulär" : "Could not load forms");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [locationId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate() {
    if (!createName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: createName.trim(), description: createDescription }),
      });
      if (!res.ok) throw new Error("Failed to create");
      const { data } = await res.json();
      toast.success(lang === "sv" ? "Formulär skapat" : "Form created");
      setIsCreateOpen(false);
      setCreateName("");
      setCreateDescription("");
      router.push(`/forms/${data.id}/edit`);
    } catch {
      toast.error(lang === "sv" ? "Kunde inte skapa formulär" : "Could not create form");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(
      lang === "sv"
        ? `Ta bort formuläret "${name}"? Alla inskickade svar raderas permanent.`
        : `Delete form "${name}"? All submissions will be permanently deleted.`
    )) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/forms/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success(lang === "sv" ? "Formulär borttaget" : "Form deleted");
      setForms((prev) => prev.filter((f) => f.id !== id));
    } catch {
      toast.error(lang === "sv" ? "Kunde inte ta bort formulär" : "Could not delete form");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="app-panel flex flex-col gap-4 p-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardEdit className="h-5 w-5 text-slate-500" />
          <h1 className="text-lg font-semibold text-slate-900">
            {lang === "sv" ? "Formulär" : "Forms"}
          </h1>
        </div>
        {isAdmin && (
          <Button size="sm" className="gap-1.5" onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            {lang === "sv" ? "Nytt formulär" : "New form"}
          </Button>
        )}
      </div>

      {/* Form grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 rounded-lg bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : forms.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <FileText className="h-10 w-10 text-slate-300" />
          <p className="text-sm text-slate-400">
            {isAdmin
              ? lang === "sv"
                ? "Inga formulär ännu. Skapa ett för att komma igång."
                : "No forms yet. Create one to get started."
              : lang === "sv"
              ? "Inga formulär tillgängliga."
              : "No forms available."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {forms.map((form) => (
            <div
              key={form.id}
              className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex-1">
                <p className="font-medium text-slate-800 leading-snug">{form.name}</p>
                {form.description && (
                  <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{form.description}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100 text-xs">
                    {form.fieldCount ?? 0} {lang === "sv" ? "fält" : "fields"}
                  </Badge>
                  <Badge className="bg-slate-100 text-slate-500 hover:bg-slate-100 text-xs">
                    {lang === "sv" ? "Senast: " : "Last: "}
                    {formatRelative(form.lastSubmittedAt)}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
                {isAdmin ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 gap-1.5 text-xs"
                      onClick={() => router.push(`/forms/${form.id}/edit`)}
                    >
                      <Pencil className="h-3 w-3" />
                      {lang === "sv" ? "Redigera" : "Edit"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 gap-1.5 text-xs"
                      onClick={() => router.push(`/forms/${form.id}`)}
                    >
                      {lang === "sv" ? "Fyll i" : "Fill out"}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-slate-400 hover:text-red-500"
                      onClick={() => handleDelete(form.id, form.name)}
                      disabled={deletingId === form.id}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => router.push(`/forms/${form.id}`)}
                    >
                      {lang === "sv" ? "Fyll i formulär" : "Fill out"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-xs"
                      onClick={() => router.push(`/forms/${form.id}/submissions`)}
                    >
                      {lang === "sv" ? "Historik" : "History"}
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create form dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{lang === "sv" ? "Nytt formulär" : "New form"}</DialogTitle>
            <DialogDescription>
              {lang === "sv"
                ? "Ge formuläret ett namn. Du kan lägga till fält efteråt."
                : "Give the form a name. You can add fields afterward."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-700">
                {lang === "sv" ? "Namn" : "Name"} *
              </label>
              <Input
                placeholder={lang === "sv" ? "t.ex. Öppningschecklista" : "e.g. Opening checklist"}
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-700">
                {lang === "sv" ? "Beskrivning (valfritt)" : "Description (optional)"}
              </label>
              <Input
                placeholder={lang === "sv" ? "Kort beskrivning..." : "Short description..."}
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)} disabled={creating}>
              {lang === "sv" ? "Avbryt" : "Cancel"}
            </Button>
            <Button onClick={handleCreate} disabled={creating || !createName.trim()}>
              {lang === "sv" ? "Skapa formulär" : "Create form"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
