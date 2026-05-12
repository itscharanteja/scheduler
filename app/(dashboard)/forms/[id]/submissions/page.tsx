"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Filter, ChevronLeft, ChevronDown, ChevronUp, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import type { CustomFormSubmission, CustomFormSubmissionWithResponses, FormResponse } from "@/lib/types";

// ---------------------------------------------------------------------------
// Response value display
// ---------------------------------------------------------------------------

function displayValue(response: FormResponse): string {
  if (response.value === null || response.value === undefined) return "—";
  const v = response.value as Record<string, unknown>;
  if ("text" in v) return String(v.text ?? "") || "—";
  if ("number" in v) return v.number === null ? "—" : String(v.number);
  if ("checked" in v) return v.checked ? "✓" : "✗";
  if ("date" in v) return v.date ? String(v.date) : "—";
  if ("value" in v) return v.value ? String(v.value) : "—";
  return "—";
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SubmissionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: formId } = use(params);
  const { hasRole } = useAuth();
  const { lang } = useLanguage();
  const router = useRouter();

  const [formName, setFormName] = useState<string>("");
  const [submissions, setSubmissions] = useState<CustomFormSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CustomFormSubmissionWithResponses | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  if (!hasRole("user_lead", "admin", "super_admin")) {
    return (
      <div className="app-panel px-5 py-16 text-center">
        <p className="text-sm text-slate-500">{lang === "sv" ? "Åtkomst nekad." : "Access denied."}</p>
      </div>
    );
  }

  async function loadSubmissions(from?: string, to?: string) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set("dateFrom", from);
      if (to) params.set("dateTo", to);
      const res = await fetch(`/api/forms/${formId}/submissions?${params}`);
      if (!res.ok) throw new Error("Failed to load");
      const { data } = await res.json();
      setSubmissions(data ?? []);
    } catch {
      toast.error(lang === "sv" ? "Kunde inte ladda svar" : "Could not load submissions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function init() {
      const [formRes] = await Promise.allSettled([
        fetch(`/api/forms/${formId}`),
      ]);
      if (formRes.status === "fulfilled" && formRes.value.ok) {
        const { data } = await formRes.value.json();
        setFormName(data.name);
      }
      await loadSubmissions();
    }
    init();
  }, [formId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleExpand(submissionId: string) {
    if (expandedId === submissionId) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(submissionId);
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await fetch(`/api/forms/${formId}/submissions/${submissionId}`);
      if (!res.ok) throw new Error("Failed");
      const { data } = await res.json();
      setDetail(data);
    } catch {
      toast.error(lang === "sv" ? "Kunde inte ladda detaljer" : "Could not load details");
    } finally {
      setDetailLoading(false);
    }
  }

  function handleFilter() {
    loadSubmissions(dateFrom || undefined, dateTo || undefined);
  }

  return (
    <div className="app-panel flex flex-col gap-4 p-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => router.push("/forms")}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <ClipboardList className="h-5 w-5 text-slate-500" />
        <div>
          <h1 className="text-lg font-semibold text-slate-900">
            {lang === "sv" ? "Svar" : "Submissions"}
          </h1>
          {formName && (
            <p className="text-xs text-slate-500">{formName}</p>
          )}
        </div>
      </div>

      {/* Date filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-xs text-slate-500">{lang === "sv" ? "Från" : "From"}</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-300"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500">{lang === "sv" ? "Till" : "To"}</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-300"
          />
        </div>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleFilter}>
          {lang === "sv" ? "Filtrera" : "Filter"}
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 rounded bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : submissions.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">
          {lang === "sv" ? "Inga svar hittades." : "No submissions found."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-xs text-slate-500">
                <th className="px-4 py-2.5 text-left font-medium">
                  {lang === "sv" ? "Datum" : "Date"}
                </th>
                <th className="px-4 py-2.5 text-left font-medium">
                  {lang === "sv" ? "Skickad av" : "Submitted by"}
                </th>
                <th className="px-4 py-2.5 text-left font-medium">
                  {lang === "sv" ? "Tidpunkt" : "Time"}
                </th>
                <th className="px-4 py-2.5 text-left font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {submissions.map((s) => (
                <>
                  <tr
                    key={s.id}
                    className="bg-white hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => toggleExpand(s.id)}
                  >
                    <td className="px-4 py-2.5 text-slate-700">{s.date}</td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {s.submittedByName ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 text-xs">
                      {format(new Date(s.createdAt), "HH:mm")}
                    </td>
                    <td className="px-4 py-2.5 text-slate-400">
                      {expandedId === s.id
                        ? <ChevronUp className="h-4 w-4" />
                        : <ChevronDown className="h-4 w-4" />}
                    </td>
                  </tr>
                  {expandedId === s.id && (
                    <tr key={`${s.id}-detail`}>
                      <td colSpan={4} className="px-4 py-3 bg-slate-50 border-t border-slate-100">
                        {detailLoading ? (
                          <div className="space-y-1.5">
                            {Array.from({ length: 3 }).map((_, i) => (
                              <div key={i} className="h-5 rounded bg-slate-200 animate-pulse" />
                            ))}
                          </div>
                        ) : detail ? (
                          <div className="flex flex-col gap-1.5">
                            {detail.responses.map((r) => (
                              <div key={r.id} className="flex gap-3 text-sm">
                                <span className="text-slate-500 w-48 shrink-0 font-medium">
                                  {r.fieldLabel ?? r.fieldId}
                                </span>
                                <span className="text-slate-700">{displayValue(r)}</span>
                              </div>
                            ))}
                            {detail.responses.length === 0 && (
                              <p className="text-xs text-slate-400">
                                {lang === "sv" ? "Inga svar registrerade." : "No responses recorded."}
                              </p>
                            )}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
