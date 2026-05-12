"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { CheckCircle2, ChevronLeft, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "@/context/LocationContext";
import { useLanguage } from "@/context/LanguageContext";
import type {
  CustomFormWithFields,
  CustomFormField,
  SelectFieldConfig,
  TextFieldConfig,
  NumberFieldConfig,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Field renderers
// ---------------------------------------------------------------------------

type FieldProps = {
  field: CustomFormField;
  value: unknown;
  onChange: (value: unknown) => void;
  error: boolean;
  employees: { id: string; name: string }[];
  inventoryItems: { id: string; item_name: string }[];
};

function FieldRenderer({ field, value, onChange, error, employees, inventoryItems }: FieldProps) {
  const baseInputClass = `w-full rounded border px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-1 ${
    error ? "border-red-400 focus:ring-red-300" : "border-slate-200 focus:ring-slate-300"
  }`;

  switch (field.fieldType) {
    case "text": {
      const cfg = field.config as TextFieldConfig;
      if (cfg.multiline) {
        return (
          <textarea
            className={`${baseInputClass} min-h-[80px] resize-y`}
            placeholder={cfg.placeholder ?? ""}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
          />
        );
      }
      return (
        <Input
          placeholder={cfg.placeholder ?? ""}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={error ? "border-red-400 focus:ring-red-300" : ""}
        />
      );
    }

    case "number": {
      const cfg = field.config as NumberFieldConfig;
      return (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={cfg.min}
            max={cfg.max}
            value={(value as number) ?? ""}
            onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
            className={error ? "border-red-400 focus:ring-red-300" : ""}
          />
          {cfg.unit && <span className="text-sm text-slate-500 shrink-0">{cfg.unit}</span>}
        </div>
      );
    }

    case "checkbox":
      return (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id={`field-${field.id}`}
            checked={(value as boolean) ?? false}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-slate-800 focus:ring-slate-400"
          />
          <label htmlFor={`field-${field.id}`} className="text-sm text-slate-600">
            {field.label}
          </label>
        </div>
      );

    case "date":
      return (
        <Input
          type="date"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={error ? "border-red-400 focus:ring-red-300" : ""}
        />
      );

    case "select": {
      const cfg = field.config as SelectFieldConfig;
      let options: { value: string; label: string }[] = [];

      if (cfg.linked_source === "employees") {
        options = employees.map((e) => ({ value: e.id, label: e.name }));
      } else if (cfg.linked_source === "inventory") {
        options = inventoryItems.map((i) => ({ value: i.id, label: i.item_name }));
      } else {
        options = (cfg.options ?? []).map((o) => ({ value: o, label: o }));
      }

      return (
        <select
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={`${baseInputClass} bg-white`}
        >
          <option value="">—</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    }

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function FormFillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: formId } = use(params);
  const { hasRole } = useAuth();
  const { locationId } = useLocation();
  const { lang } = useLanguage();
  const router = useRouter();

  const [form, setForm] = useState<CustomFormWithFields | null>(null);
  const [loading, setLoading] = useState(true);
  const [responses, setResponses] = useState<Record<string, unknown>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [inventoryItems, setInventoryItems] = useState<{ id: string; item_name: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);

  // Guard: user_lead+
  if (!hasRole("user_lead", "admin", "super_admin")) {
    return (
      <div className="app-panel px-5 py-16 text-center">
        <p className="text-sm text-slate-500">{lang === "sv" ? "Åtkomst nekad." : "Access denied."}</p>
      </div>
    );
  }

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/forms/${formId}`);
        if (!res.ok) throw new Error("Not found");
        const { data } = await res.json();
        setForm(data);

        // Initialise responses with defaults per type
        const init: Record<string, unknown> = {};
        for (const f of data.fields) {
          if (f.fieldType === "checkbox") init[f.id] = false;
          else if (f.fieldType === "number") init[f.id] = "";
          else init[f.id] = "";
        }
        setResponses(init);

        // Conditionally fetch linked sources
        const needsEmployees = data.fields.some(
          (f: CustomFormField) =>
            f.fieldType === "select" && (f.config as SelectFieldConfig).linked_source === "employees",
        );
        const needsInventory = data.fields.some(
          (f: CustomFormField) =>
            f.fieldType === "select" &&
            (f.config as SelectFieldConfig).linked_source === "inventory",
        );

        if (needsEmployees) {
          const empRes = await fetch("/api/employees");
          if (empRes.ok) {
            const { employees: emps } = await empRes.json();
            setEmployees(emps ?? []);
          }
        }
        if (needsInventory && locationId) {
          const invRes = await fetch(`/api/inventory?locationId=${locationId}`);
          if (invRes.ok) {
            const { items } = await invRes.json();
            setInventoryItems(items ?? []);
          }
        }
      } catch {
        toast.error(lang === "sv" ? "Formulär hittades inte" : "Form not found");
        router.push("/forms");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [formId, locationId]); // eslint-disable-line react-hooks/exhaustive-deps

  function setFieldValue(fieldId: string, value: unknown) {
    setResponses((prev) => ({ ...prev, [fieldId]: value }));
    if (fieldErrors[fieldId]) {
      setFieldErrors((prev) => ({ ...prev, [fieldId]: false }));
    }
  }

  async function handleSubmit() {
    if (!form) return;

    // Validate required fields
    const errors: Record<string, boolean> = {};
    for (const f of form.fields) {
      if (!f.isRequired) continue;
      const val = responses[f.id];
      const isEmpty =
        val === "" || val === null || val === undefined || (f.fieldType === "checkbox" && !val);
      if (isEmpty) errors[f.id] = true;
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      toast.error(
        lang === "sv"
          ? "Fyll i alla obligatoriska fält."
          : "Please fill in all required fields.",
      );
      return;
    }

    setSubmitting(true);
    try {
      const date = format(new Date(), "yyyy-MM-dd");
      const responsePayload = form.fields.map((f) => ({
        fieldId: f.id,
        value: serializeValue(f, responses[f.id]),
      }));

      const res = await fetch(`/api/forms/${formId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, responses: responsePayload }),
      });
      if (!res.ok) throw new Error("Submit failed");
      const { data } = await res.json();
      setSubmissionId(data.submissionId);
      setSubmitted(true);
    } catch {
      toast.error(lang === "sv" ? "Kunde inte skicka formuläret" : "Could not submit form");
    } finally {
      setSubmitting(false);
    }
  }

  function serializeValue(field: CustomFormField, value: unknown): unknown {
    switch (field.fieldType) {
      case "text": return { text: value ?? "" };
      case "number": return { number: value === "" ? null : Number(value) };
      case "checkbox": return { checked: Boolean(value) };
      case "date": return { date: value ?? null };
      case "select": return { value: value ?? null };
      default: return null;
    }
  }

  if (loading) {
    return (
      <div className="app-panel p-5 space-y-4">
        <div className="h-6 w-48 rounded bg-slate-100 animate-pulse" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 rounded bg-slate-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="app-panel flex flex-col items-center gap-4 px-5 py-20 text-center">
        <CheckCircle2 className="h-14 w-14 text-green-500" />
        <h2 className="text-lg font-semibold text-slate-800">
          {lang === "sv" ? "Formuläret skickat!" : "Form submitted!"}
        </h2>
        <p className="text-sm text-slate-500">
          {lang === "sv" ? "Ditt svar har registrerats." : "Your response has been recorded."}
        </p>
        <div className="flex gap-3 mt-2">
          <Button variant="outline" onClick={() => router.push("/forms")}>
            {lang === "sv" ? "Tillbaka till formulär" : "Back to forms"}
          </Button>
          {submissionId && (
            <Button onClick={() => router.push(`/forms/${formId}/submissions`)}>
              {lang === "sv" ? "Visa historik" : "View submissions"}
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (!form) return null;

  return (
    <div className="app-panel flex flex-col gap-5 p-5 max-w-2xl">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 mt-0.5 shrink-0"
          onClick={() => router.push("/forms")}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-slate-500" />
            <h1 className="text-lg font-semibold text-slate-900">{form.name}</h1>
          </div>
          {form.description && (
            <p className="mt-0.5 text-sm text-slate-500">{form.description}</p>
          )}
        </div>
      </div>

      {/* Fields */}
      <div className="flex flex-col gap-4">
        {form.fields.length === 0 ? (
          <p className="text-sm text-slate-400 italic">
            {lang === "sv" ? "Det här formuläret har inga fält ännu." : "This form has no fields yet."}
          </p>
        ) : (
          form.fields.map((field) => {
            // Checkboxes render their label inline
            const showLabel = field.fieldType !== "checkbox";
            return (
              <div key={field.id} className="flex flex-col gap-1.5">
                {showLabel && (
                  <label className="text-sm font-medium text-slate-700">
                    {field.label}
                    {field.isRequired && (
                      <span className="ml-1 text-red-500">*</span>
                    )}
                  </label>
                )}
                <FieldRenderer
                  field={field}
                  value={responses[field.id]}
                  onChange={(v) => setFieldValue(field.id, v)}
                  error={!!fieldErrors[field.id]}
                  employees={employees}
                  inventoryItems={inventoryItems}
                />
                {fieldErrors[field.id] && (
                  <p className="text-xs text-red-500">
                    {lang === "sv" ? "Detta fält är obligatoriskt." : "This field is required."}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Submit */}
      {form.fields.length > 0 && (
        <div className="pt-2 border-t border-slate-100">
          <Button onClick={handleSubmit} disabled={submitting} className="w-full sm:w-auto">
            {submitting
              ? lang === "sv" ? "Skickar…" : "Submitting…"
              : lang === "sv" ? "Skicka formulär" : "Submit form"}
          </Button>
        </div>
      )}
    </div>
  );
}
