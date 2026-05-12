"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  Save,
  ChevronLeft,
  Type,
  Hash,
  CheckSquare,
  Calendar,
  List,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import type {
  CustomFormWithFields,
  FieldType,
  FieldConfig,
  TextFieldConfig,
  NumberFieldConfig,
  SelectFieldConfig,
  DraftFieldInput,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Draft field (local state — no id needed)
// ---------------------------------------------------------------------------

type DraftField = DraftFieldInput & { _key: string };

function defaultConfig(type: FieldType): FieldConfig {
  switch (type) {
    case "text":     return { type: "text", placeholder: "", multiline: false };
    case "number":   return { type: "number", min: undefined, max: undefined, unit: "" };
    case "checkbox": return { type: "checkbox" };
    case "date":     return { type: "date" };
    case "select":   return { type: "select", options: [], linked_source: undefined };
  }
}

function newDraftField(type: FieldType): DraftField {
  return {
    _key: `${Date.now()}-${Math.random()}`,
    label: "",
    fieldType: type,
    config: defaultConfig(type),
    orderIndex: 0,
    isRequired: false,
  };
}

// ---------------------------------------------------------------------------
// Field type icons + labels
// ---------------------------------------------------------------------------

const FIELD_TYPES: { type: FieldType; icon: React.ReactNode; label: string; labelSv: string }[] = [
  { type: "text",     icon: <Type className="h-3.5 w-3.5" />,       label: "Text",     labelSv: "Text" },
  { type: "number",   icon: <Hash className="h-3.5 w-3.5" />,       label: "Number",   labelSv: "Nummer" },
  { type: "checkbox", icon: <CheckSquare className="h-3.5 w-3.5" />, label: "Checkbox", labelSv: "Kryssruta" },
  { type: "date",     icon: <Calendar className="h-3.5 w-3.5" />,   label: "Date",     labelSv: "Datum" },
  { type: "select",   icon: <List className="h-3.5 w-3.5" />,       label: "Select",   labelSv: "Val" },
];

// ---------------------------------------------------------------------------
// Per-field config editors
// ---------------------------------------------------------------------------

function TextConfig({
  config,
  onChange,
  lang,
}: {
  config: TextFieldConfig;
  onChange: (c: TextFieldConfig) => void;
  lang: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-500 w-24 shrink-0">
          {lang === "sv" ? "Platshållare" : "Placeholder"}
        </label>
        <Input
          placeholder={lang === "sv" ? "Text..." : "Text..."}
          value={config.placeholder ?? ""}
          onChange={(e) => onChange({ ...config, placeholder: e.target.value })}
          className="h-7 text-xs"
        />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-500 w-24 shrink-0">
          {lang === "sv" ? "Flerrad" : "Multiline"}
        </label>
        <input
          type="checkbox"
          checked={config.multiline ?? false}
          onChange={(e) => onChange({ ...config, multiline: e.target.checked })}
          className="h-4 w-4"
        />
      </div>
    </div>
  );
}

function NumberConfig({
  config,
  onChange,
  lang,
}: {
  config: NumberFieldConfig;
  onChange: (c: NumberFieldConfig) => void;
  lang: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-500 w-24 shrink-0">Min</label>
        <Input
          type="number"
          value={config.min ?? ""}
          onChange={(e) =>
            onChange({ ...config, min: e.target.value === "" ? undefined : Number(e.target.value) })
          }
          className="h-7 text-xs"
        />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-500 w-24 shrink-0">Max</label>
        <Input
          type="number"
          value={config.max ?? ""}
          onChange={(e) =>
            onChange({ ...config, max: e.target.value === "" ? undefined : Number(e.target.value) })
          }
          className="h-7 text-xs"
        />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-500 w-24 shrink-0">
          {lang === "sv" ? "Enhet" : "Unit"}
        </label>
        <Input
          placeholder="°C, kg..."
          value={config.unit ?? ""}
          onChange={(e) => onChange({ ...config, unit: e.target.value })}
          className="h-7 text-xs"
        />
      </div>
    </div>
  );
}

function SelectConfig({
  config,
  onChange,
  lang,
}: {
  config: SelectFieldConfig;
  onChange: (c: SelectFieldConfig) => void;
  lang: string;
}) {
  const [newOption, setNewOption] = useState("");
  const isLinked = !!config.linked_source;

  return (
    <div className="flex flex-col gap-2">
      {/* Static / Linked toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange({ type: "select", options: config.options ?? [], linked_source: undefined })}
          className={`rounded px-2.5 py-1 text-xs font-medium border transition-colors ${
            !isLinked
              ? "bg-slate-800 text-white border-slate-800"
              : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
          }`}
        >
          {lang === "sv" ? "Statiska alternativ" : "Static options"}
        </button>
        <button
          type="button"
          onClick={() => onChange({ type: "select", options: undefined, linked_source: "employees" })}
          className={`rounded px-2.5 py-1 text-xs font-medium border transition-colors ${
            isLinked
              ? "bg-slate-800 text-white border-slate-800"
              : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
          }`}
        >
          {lang === "sv" ? "Länkad till data" : "Linked to app data"}
        </button>
      </div>

      {isLinked ? (
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 shrink-0">
            {lang === "sv" ? "Datakälla" : "Data source"}
          </label>
          <select
            value={config.linked_source ?? "employees"}
            onChange={(e) =>
              onChange({ ...config, linked_source: e.target.value as "employees" | "inventory" })
            }
            className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-300"
          >
            <option value="employees">{lang === "sv" ? "Anställda" : "Employees"}</option>
            <option value="inventory">{lang === "sv" ? "Lager" : "Inventory"}</option>
          </select>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-slate-500">
            {lang === "sv" ? "Alternativ" : "Options"}
          </label>
          {(config.options ?? []).map((opt, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="flex-1 rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700">
                {opt}
              </span>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...config,
                    options: (config.options ?? []).filter((_, j) => j !== i),
                  })
                }
                className="text-slate-400 hover:text-red-500"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <Input
              placeholder={lang === "sv" ? "Nytt alternativ..." : "New option..."}
              value={newOption}
              onChange={(e) => setNewOption(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newOption.trim()) {
                  onChange({ ...config, options: [...(config.options ?? []), newOption.trim()] });
                  setNewOption("");
                }
              }}
              className="h-7 text-xs"
            />
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs px-2"
              disabled={!newOption.trim()}
              onClick={() => {
                if (!newOption.trim()) return;
                onChange({ ...config, options: [...(config.options ?? []), newOption.trim()] });
                setNewOption("");
              }}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Draft field row
// ---------------------------------------------------------------------------

function DraftFieldRow({
  field,
  index,
  total,
  lang,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  field: DraftField;
  index: number;
  total: number;
  lang: string;
  onUpdate: (f: DraftField) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const typeInfo = FIELD_TYPES.find((t) => t.type === field.fieldType);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 flex flex-col gap-3">
      {/* Row header */}
      <div className="flex items-center gap-2">
        {/* Reorder */}
        <div className="flex flex-col">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            className="text-slate-400 hover:text-slate-600 disabled:opacity-30"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="text-slate-400 hover:text-slate-600 disabled:opacity-30"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Type badge */}
        <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100 text-xs gap-1 shrink-0">
          {typeInfo?.icon}
          {lang === "sv" ? typeInfo?.labelSv : typeInfo?.label}
        </Badge>

        {/* Label */}
        <Input
          placeholder={lang === "sv" ? "Fältets namn..." : "Field label..."}
          value={field.label}
          onChange={(e) => onUpdate({ ...field, label: e.target.value })}
          className="h-7 text-xs flex-1"
        />

        {/* Required */}
        <label className="flex items-center gap-1 text-xs text-slate-500 shrink-0 cursor-pointer">
          <input
            type="checkbox"
            checked={field.isRequired}
            onChange={(e) => onUpdate({ ...field, isRequired: e.target.checked })}
            className="h-3.5 w-3.5"
          />
          {lang === "sv" ? "Krävs" : "Req."}
        </label>

        {/* Delete */}
        <button
          type="button"
          onClick={onDelete}
          className="text-slate-400 hover:text-red-500 shrink-0"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Type-specific config */}
      {field.fieldType === "text" && (
        <TextConfig
          config={field.config as TextFieldConfig}
          onChange={(c) => onUpdate({ ...field, config: c })}
          lang={lang}
        />
      )}
      {field.fieldType === "number" && (
        <NumberConfig
          config={field.config as NumberFieldConfig}
          onChange={(c) => onUpdate({ ...field, config: c })}
          lang={lang}
        />
      )}
      {field.fieldType === "select" && (
        <SelectConfig
          config={field.config as SelectFieldConfig}
          onChange={(c) => onUpdate({ ...field, config: c })}
          lang={lang}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function FormEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: formId } = use(params);
  const { hasRole } = useAuth();
  const { lang } = useLanguage();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [fields, setFields] = useState<DraftField[]>([]);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!hasRole("admin", "super_admin")) {
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
        const { data }: { data: CustomFormWithFields } = await res.json();
        setFormName(data.name);
        setFormDesc(data.description);
        setIsActive(data.isActive);
        setFields(
          data.fields.map((f) => ({
            _key: f.id,
            label: f.label,
            fieldType: f.fieldType,
            config: f.config,
            orderIndex: f.orderIndex,
            isRequired: f.isRequired,
          })),
        );
      } catch {
        toast.error(lang === "sv" ? "Formulär hittades inte" : "Form not found");
        router.push("/forms");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [formId]); // eslint-disable-line react-hooks/exhaustive-deps

  function addField(type: FieldType) {
    setFields((prev) => [...prev, newDraftField(type)]);
    setShowTypePicker(false);
  }

  function updateField(key: string, updated: DraftField) {
    setFields((prev) => prev.map((f) => (f._key === key ? updated : f)));
  }

  function deleteField(key: string) {
    setFields((prev) => prev.filter((f) => f._key !== key));
  }

  function moveField(index: number, direction: -1 | 1) {
    const newFields = [...fields];
    const target = index + direction;
    if (target < 0 || target >= newFields.length) return;
    [newFields[index], newFields[target]] = [newFields[target], newFields[index]];
    setFields(newFields);
  }

  async function handleSave() {
    if (!formName.trim()) {
      toast.error(lang === "sv" ? "Formuläret behöver ett namn." : "Form needs a name.");
      return;
    }

    // Validate all fields have labels
    const missingLabel = fields.some((f) => !f.label.trim());
    if (missingLabel) {
      toast.error(
        lang === "sv" ? "Alla fält behöver ett namn." : "All fields must have a label.",
      );
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/forms/${formId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          description: formDesc,
          isActive,
          fields: fields.map((f, i) => ({
            label: f.label,
            fieldType: f.fieldType,
            config: f.config,
            orderIndex: i,
            isRequired: f.isRequired,
          })),
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      toast.success(lang === "sv" ? "Formuläret sparat" : "Form saved");
      router.push("/forms");
    } catch {
      toast.error(lang === "sv" ? "Kunde inte spara formuläret" : "Could not save form");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="app-panel p-5 space-y-4">
        <div className="h-6 w-48 rounded bg-slate-100 animate-pulse" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 rounded bg-slate-100 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="app-panel flex flex-col gap-5 p-5 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => router.push("/forms")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-semibold text-slate-900">
            {lang === "sv" ? "Redigera formulär" : "Edit form"}
          </h1>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-1.5">
          <Save className="h-3.5 w-3.5" />
          {saving
            ? lang === "sv" ? "Sparar…" : "Saving…"
            : lang === "sv" ? "Spara" : "Save"}
        </Button>
      </div>

      {/* Form metadata */}
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-700">
            {lang === "sv" ? "Namn" : "Name"} *
          </label>
          <Input
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder={lang === "sv" ? "Formulärnamn" : "Form name"}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-700">
            {lang === "sv" ? "Beskrivning" : "Description"}
          </label>
          <Input
            value={formDesc}
            onChange={(e) => setFormDesc(e.target.value)}
            placeholder={lang === "sv" ? "Valfri beskrivning…" : "Optional description…"}
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4"
          />
          <span className="text-sm text-slate-700">
            {lang === "sv" ? "Aktivt (synligt för shift leaders)" : "Active (visible to shift leaders)"}
          </span>
        </label>
      </div>

      {/* Fields section */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-700">
            {lang === "sv" ? "Fält" : "Fields"}
            <span className="ml-2 text-slate-400 font-normal">({fields.length})</span>
          </h2>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs"
            onClick={() => setShowTypePicker(!showTypePicker)}
          >
            <Plus className="h-3.5 w-3.5" />
            {lang === "sv" ? "Lägg till fält" : "Add field"}
          </Button>
        </div>

        {/* Type picker */}
        {showTypePicker && (
          <div className="flex flex-wrap gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
            {FIELD_TYPES.map((t) => (
              <button
                key={t.type}
                type="button"
                onClick={() => addField(t.type)}
                className="flex items-center gap-1.5 rounded border border-blue-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-blue-100 transition-colors"
              >
                {t.icon}
                {lang === "sv" ? t.labelSv : t.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowTypePicker(false)}
              className="ml-auto text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Field list */}
        {fields.length === 0 ? (
          <p className="text-sm text-slate-400 italic text-center py-6">
            {lang === "sv"
              ? `Inga fält ännu. Klicka "Lägg till fält" för att börja.`
              : `No fields yet. Click "Add field" to start.`}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {fields.map((field, index) => (
              <DraftFieldRow
                key={field._key}
                field={field}
                index={index}
                total={fields.length}
                lang={lang}
                onUpdate={(updated) => updateField(field._key, updated)}
                onDelete={() => deleteField(field._key)}
                onMoveUp={() => moveField(index, -1)}
                onMoveDown={() => moveField(index, 1)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bottom save */}
      <div className="border-t border-slate-100 pt-3">
        <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto gap-1.5">
          <Save className="h-3.5 w-3.5" />
          {saving
            ? lang === "sv" ? "Sparar…" : "Saving…"
            : lang === "sv" ? "Spara formulär" : "Save form"}
        </Button>
      </div>
    </div>
  );
}
