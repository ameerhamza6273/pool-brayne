import { api } from "@/lib/apiClient";
import type { Database } from "@/lib/database.types";

type Job = Database["public"]["Tables"]["jobs"]["Row"] & {
  customers: { name: string; address: string | null; phone?: string | null; email?: string | null; lat?: number | null; lng?: number | null } | null;
  profiles: { name: string; avatar: string | null } | null;
};

export type JobPartUsed = { id: string; item_id: string; quantity: number; item_name: string; item_sku: string };
export type JobAttachment = { id: string; job_id: string; type: "photo" | "signature" | "document"; url: string; label: string | null; filename: string | null; created_at: string };
export type JobCrewMember = { id: string; profile_id: string; name: string; avatar: string | null };
export type JobForm = {
  id: string; job_id: string; type: string; template_id: string | null; template_name: string | null;
  data: Record<string, unknown>; notes: string | null; submitted_at: string; submitted_by_name: string | null;
  public_token: string;
};

export const jobsApi = {
  list: () => api.get<Job[]>("/api/jobs"),

  mine: () => api.get<Job[]>("/api/jobs/mine/active"),

  today: () => api.get<{ id: string; address: string | null; status: string; scheduled_time: string | null; customers: { name: string } | null }[]>("/api/jobs/today"),

  upcoming: () => api.get<{ id: string; type: string; scheduled_date: string; status: string; customers: { name: string } | null }[]>("/api/jobs/upcoming"),

  detail: (id: string) => api.get<Job>(`/api/jobs/${id}`),

  create: (data: {
    customerId: string;
    jobType: string;
    techId: string | null;
    date: string | null;
    time: string | null;
    description: string | null;
    address: string | null;
    amount: number;
    itemSku?: string | null;
    laborSku?: string | null;
    lineItems?: JobLineItemInput[];
    crewIds?: string[];
  }) => api.post<Job>("/api/jobs", data),

  update: (id: string, fields: Record<string, unknown>) => api.patch<Job>(`/api/jobs/${id}`, fields),

  uninvoiced: (customerId: string, start: string, end: string) =>
    api.get<Job[]>(`/api/jobs/uninvoiced?customerId=${customerId}&start=${start}&end=${end}`),

  getParts: (jobId: string) => api.get<JobPartUsed[]>(`/api/jobs/${jobId}/parts`),

  addParts: (jobId: string, items: { itemId: string; quantity: number }[]) =>
    api.post<JobPartUsed[]>(`/api/jobs/${jobId}/parts`, { items }),

  getAttachments: (jobId: string) => api.get<JobAttachment[]>(`/api/jobs/${jobId}/attachments`),

  addAttachment: (jobId: string, data: { type: "photo" | "signature" | "document"; url: string; label?: string | null; filename?: string | null }) =>
    api.post<JobAttachment>(`/api/jobs/${jobId}/attachments`, data),

  getLineItems: (jobId: string) => api.get<JobLineItem[]>(`/api/jobs/${jobId}/line-items`),

  saveLineItems: (jobId: string, lineItems: JobLineItemInput[]) =>
    api.patch<Job>(`/api/jobs/${jobId}/line-items`, { lineItems }),

  convertToEstimate: (jobId: string) => api.post<{ estimateId: string }>(`/api/jobs/${jobId}/convert-to-estimate`, {}),

  // Client PDF 2026-09-06: "Allow us to set up more than one tech on a job (setting up crews)".
  getCrew: (jobId: string) => api.get<JobCrewMember[]>(`/api/jobs/${jobId}/crew`),
  addCrewMember: (jobId: string, profileId: string) => api.post<JobCrewMember>(`/api/jobs/${jobId}/crew`, { profileId }),
  removeCrewMember: (jobId: string, profileId: string) => api.del(`/api/jobs/${jobId}/crew/${profileId}`),

  // Client PDF 2026-09-06: persists WaterTestingForm/MaintenanceChecklist/OneOffJobChecklist,
  // which previously had no save at all.
  getForms: (jobId: string) => api.get<JobForm[]>(`/api/jobs/${jobId}/forms`),
  saveForm: (jobId: string, type: string, data: Record<string, unknown>, notes?: string | null, templateId?: string | null) =>
    api.post<JobForm>(`/api/jobs/${jobId}/forms`, { type, data, notes, templateId }),

  // Sidebar restructure (client PDF 2026-09-06, "Employee section > Forms").
  getAllForms: () => api.get<(JobForm & { job_type: string | null; customer_name: string | null })[]>("/api/jobs/forms/all"),
};

// Client PDF 2026-09-05 (check list forms.pdf / inspection form.pdf): "make sure customers can
// see form" — no-login public form viewer, same pattern as the estimate approval link.
export type PublicForm = {
  id: string;
  data: Record<string, unknown>;
  notes: string | null;
  submitted_at: string;
  type: string;
  customers: { name: string } | null;
  template: { name: string; fields: import("./formTemplates").FormField[]; customer_visible: boolean };
};

export const publicFormsApi = {
  get: (token: string) => api.get<PublicForm>(`/api/public/forms/${token}`),
};

export type JobLineItem = {
  id: string;
  description: string;
  sku: string | null;
  item_type: string;
  quantity: number;
  cost: number;
  rate: number;
  amount: number;
  notes: string | null;
};

export type JobLineItemInput = { description: string; sku: string | null; itemType: string; quantity: number; cost: number; rate: number; notes?: string | null };
