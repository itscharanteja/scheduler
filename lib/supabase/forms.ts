import { supabaseClient, requireClient } from "./client";
import type {
  CustomForm,
  CustomFormWithFields,
  CustomFormField,
  CustomFormSubmission,
  CustomFormSubmissionWithResponses,
  FormResponse,
  FieldConfig,
  FieldType,
  UpdateFormPayload,
  DraftFieldInput,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// DB row types
// ---------------------------------------------------------------------------

type DbFormRow = {
  id: string;
  location_id: string;
  name: string;
  description: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type DbFieldRow = {
  id: string;
  form_id: string;
  label: string;
  field_type: string;
  config: unknown;
  order_index: number;
  is_required: boolean;
  created_at: string;
};

type DbSubmissionRow = {
  id: string;
  form_id: string;
  location_id: string;
  submitted_by: string | null;
  date: string;
  created_at: string;
};

type DbResponseRow = {
  id: string;
  submission_id: string;
  field_id: string;
  value: unknown;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function mapForm(row: DbFormRow): CustomForm {
  return {
    id: row.id,
    locationId: row.location_id,
    name: row.name,
    description: row.description,
    isActive: row.is_active,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapField(row: DbFieldRow): CustomFormField {
  const rawConfig = (row.config ?? {}) as Record<string, unknown>;
  const config: FieldConfig = { type: row.field_type as FieldType, ...rawConfig } as FieldConfig;
  return {
    id: row.id,
    formId: row.form_id,
    label: row.label,
    fieldType: row.field_type as FieldType,
    config,
    orderIndex: row.order_index,
    isRequired: row.is_required,
    createdAt: row.created_at,
  };
}

function mapSubmission(
  row: DbSubmissionRow & { employees?: { name: string } | null }
): CustomFormSubmission {
  return {
    id: row.id,
    formId: row.form_id,
    locationId: row.location_id,
    submittedBy: row.submitted_by,
    submittedByName: row.employees?.name ?? null,
    date: row.date,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * List all active forms for a location, augmented with field count and last
 * submission date. Returns [] when Supabase is not configured.
 */
export async function getForms(locationId: string): Promise<CustomForm[]> {
  try {
    if (!supabaseClient) return [];
    const { data: formsData, error: formsError } = await supabaseClient
      .from("custom_forms")
      .select("*")
      .eq("location_id", locationId)
      .eq("is_active", true)
      .order("created_at", { ascending: true });
    if (formsError) throw formsError;
    if (!formsData || formsData.length === 0) return [];

    const forms = (formsData as DbFormRow[]).map(mapForm);
    const formIds = forms.map((f) => f.id);

    // Field counts per form
    const { data: fieldData } = await supabaseClient
      .from("custom_form_fields")
      .select("form_id")
      .in("form_id", formIds);

    const fieldCountMap: Record<string, number> = {};
    (fieldData ?? []).forEach((r: { form_id: string }) => {
      fieldCountMap[r.form_id] = (fieldCountMap[r.form_id] ?? 0) + 1;
    });

    // Last submission per form
    const { data: subData } = await supabaseClient
      .from("custom_form_submissions")
      .select("form_id, created_at")
      .in("form_id", formIds)
      .order("created_at", { ascending: false });

    const lastSubMap: Record<string, string> = {};
    (subData ?? []).forEach((r: { form_id: string; created_at: string }) => {
      if (!lastSubMap[r.form_id]) lastSubMap[r.form_id] = r.created_at;
    });

    return forms.map((f) => ({
      ...f,
      fieldCount: fieldCountMap[f.id] ?? 0,
      lastSubmittedAt: lastSubMap[f.id] ?? null,
    }));
  } catch (error) {
    console.error("[supabase:getForms]", error);
    return [];
  }
}

/**
 * Get a single form with all its fields ordered by order_index.
 * Returns null if not found.
 */
export async function getForm(formId: string): Promise<CustomFormWithFields | null> {
  try {
    if (!supabaseClient) return null;
    const { data: formData, error: formError } = await supabaseClient
      .from("custom_forms")
      .select("*")
      .eq("id", formId)
      .single();
    if (formError) {
      if (formError.code === "PGRST116") return null;
      throw formError;
    }

    const { data: fieldsData, error: fieldsError } = await supabaseClient
      .from("custom_form_fields")
      .select("*")
      .eq("form_id", formId)
      .order("order_index", { ascending: true });
    if (fieldsError) throw fieldsError;

    const form = mapForm(formData as DbFormRow);
    const fields = (fieldsData as DbFieldRow[]).map(mapField);
    return { ...form, fields };
  } catch (error) {
    console.error("[supabase:getForm]", error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Create a new form. Returns the new form's id.
 */
export async function createForm(
  locationId: string,
  name: string,
  description: string,
  createdBy: string | null,
): Promise<string> {
  const client = requireClient();
  const { data, error } = await client
    .from("custom_forms")
    .insert({ location_id: locationId, name, description, created_by: createdBy })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

/**
 * Update form metadata and/or replace its fields.
 * When `payload.fields` is provided, all existing fields are deleted and the
 * new set is inserted in order — same replace-all pattern as upsertChecklistTemplate.
 */
export async function updateForm(formId: string, payload: UpdateFormPayload): Promise<void> {
  const client = requireClient();

  // Update metadata
  const meta: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (payload.name !== undefined) meta.name = payload.name;
  if (payload.description !== undefined) meta.description = payload.description;
  if (payload.isActive !== undefined) meta.is_active = payload.isActive;

  const { error: metaError } = await client
    .from("custom_forms")
    .update(meta)
    .eq("id", formId);
  if (metaError) throw metaError;

  // Replace fields
  if (payload.fields !== undefined) {
    const { error: deleteError } = await client
      .from("custom_form_fields")
      .delete()
      .eq("form_id", formId);
    if (deleteError) throw deleteError;

    if (payload.fields.length > 0) {
      const rows = payload.fields.map((f: DraftFieldInput, i: number) => ({
        form_id: formId,
        label: f.label,
        field_type: f.fieldType,
        config: f.config,
        order_index: i,
        is_required: f.isRequired,
      }));
      const { error: insertError } = await client.from("custom_form_fields").insert(rows);
      if (insertError) throw insertError;
    }
  }
}

/**
 * Delete a form and cascade to fields, submissions, and responses.
 */
export async function deleteForm(formId: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.from("custom_forms").delete().eq("id", formId);
  if (error) throw error;
}

/**
 * Submit a filled-out form. Inserts a submission row and all response rows.
 * Returns the new submission id.
 */
export async function submitForm(
  formId: string,
  locationId: string,
  submittedBy: string | null,
  date: string,
  responses: Array<{ fieldId: string; value: unknown }>,
): Promise<string> {
  const client = requireClient();

  const { data: subData, error: subError } = await client
    .from("custom_form_submissions")
    .insert({ form_id: formId, location_id: locationId, submitted_by: submittedBy, date })
    .select("id")
    .single();
  if (subError) throw subError;

  const submissionId = (subData as { id: string }).id;

  if (responses.length > 0) {
    const rows = responses.map(({ fieldId, value }) => ({
      submission_id: submissionId,
      field_id: fieldId,
      value: value ?? null,
    }));
    const { error: respError } = await client.from("custom_form_responses").insert(rows);
    if (respError) throw respError;
  }

  return submissionId;
}

// ---------------------------------------------------------------------------
// Submission queries
// ---------------------------------------------------------------------------

/**
 * Paginated list of submissions for a form, newest first. Joins employee name.
 */
export async function getFormSubmissions(
  formId: string,
  opts?: { limit?: number; offset?: number; dateFrom?: string; dateTo?: string },
): Promise<CustomFormSubmission[]> {
  try {
    if (!supabaseClient) return [];
    let query = supabaseClient
      .from("custom_form_submissions")
      .select("*, employees(name)")
      .eq("form_id", formId)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (opts?.dateFrom) query = query.gte("date", opts.dateFrom);
    if (opts?.dateTo) query = query.lte("date", opts.dateTo);
    if (opts?.limit) query = query.limit(opts.limit);
    if (opts?.offset) query = query.range(opts.offset, opts.offset + (opts.limit ?? 50) - 1);

    const { data, error } = await query;
    if (error) throw error;
    return (data as (DbSubmissionRow & { employees: { name: string } | null })[]).map(mapSubmission);
  } catch (error) {
    console.error("[supabase:getFormSubmissions]", error);
    return [];
  }
}

/**
 * Get a single submission with all responses joined with field labels.
 */
export async function getFormSubmission(
  submissionId: string,
): Promise<CustomFormSubmissionWithResponses | null> {
  try {
    if (!supabaseClient) return null;

    const { data: subData, error: subError } = await supabaseClient
      .from("custom_form_submissions")
      .select("*, employees(name)")
      .eq("id", submissionId)
      .single();
    if (subError) {
      if (subError.code === "PGRST116") return null;
      throw subError;
    }

    const { data: respData, error: respError } = await supabaseClient
      .from("custom_form_responses")
      .select("*, custom_form_fields(label)")
      .eq("submission_id", submissionId);
    if (respError) throw respError;

    const submission = mapSubmission(
      subData as DbSubmissionRow & { employees: { name: string } | null },
    );

    const responses: FormResponse[] = (
      respData as (DbResponseRow & { custom_form_fields: { label: string } | null })[]
    ).map((r) => ({
      id: r.id,
      submissionId: r.submission_id,
      fieldId: r.field_id,
      fieldLabel: r.custom_form_fields?.label,
      value: r.value,
      createdAt: r.created_at,
    }));

    return { ...submission, responses };
  } catch (error) {
    console.error("[supabase:getFormSubmission]", error);
    return null;
  }
}
