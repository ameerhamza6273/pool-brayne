import { api } from "@/lib/apiClient";
import type { Database } from "@/lib/database.types";

type Invoice = Database["public"]["Tables"]["invoices"]["Row"] & { customers: { name: string; address?: string | null; phone?: string | null } | null };
export type InvoiceLineItem = Database["public"]["Tables"]["invoice_line_items"]["Row"];
type RecurringBilling = Database["public"]["Tables"]["recurring_billing"]["Row"] & { customers: { name: string } | null };
type Payment = Database["public"]["Tables"]["payments"]["Row"] & { invoices: { number: string } | null; customers: { name: string } | null };
// `total` (materials taxed at 8.25%, labor untaxed, added by the backend list endpoint) matches
// what EstimateDetail.tsx itself displays -- the raw `amount` column is pre-tax, see invoicing.ts.
export type Estimate = Database["public"]["Tables"]["estimates"]["Row"] & { customers: { name: string; address?: string | null; phone?: string | null } | null; total?: number };
export type EstimateLineItem = Database["public"]["Tables"]["estimate_line_items"]["Row"];
export type VendorBill = Database["public"]["Tables"]["vendor_bills"]["Row"] & { suppliers: { name: string } | null; po_number: string | null };

export type InvoiceAttachment = { id: string; invoice_id: string; url: string; label: string | null; filename: string | null; created_at: string };
export type EstimateAttachment ={ id: string; estimate_id: string; url: string; label: string | null; filename: string | null; type: "document" | "photo"; created_at: string };

export type LineItemInput = {
  description: string;
  sku?: string | null;
  // Client video 2026-10-06: 3rd category "Maintenance" alongside Material/Labor, for weekly
  // maintenance priority chemical SKUs.
  itemType?: "material" | "labor" | "maintenance";
  quantity: number;
  cost?: number;
  rate: number;
  notes?: string | null;
  // Client video 2026-10-06: per-line tax override (Y/N icon), defaults to the item_type rule
  // (labor untaxed, material taxed) when left unset.
  taxable?: boolean;
};

export type EstimateTemplate = { id: string; name: string; line_items: LineItemInput[] };

export type PublicEstimate = {
  estimate: {
    id: string; number: string; issue_date: string; expiry_date: string | null; job_description: string | null;
    status: string; down_payment: number; approved_at: string | null;
    customers: { name: string; address: string | null; phone: string | null } | null;
  };
  lineItems: { description: string; sku: string | null; item_type: string; quantity: number; rate: number; amount: number; notes: string | null; taxable?: boolean }[];
  business: Business | null;
};

// Client video 2026-10-06: public, no-login invoice view/pay page — same shape as PublicEstimate.
export type PublicInvoice = {
  invoice: {
    id: string; number: string; issue_date: string; due_date: string | null; status: string;
    down_payment: number; paid_date: string | null;
    customers: { name: string; address: string | null; phone: string | null } | null;
  };
  lineItems: { description: string; sku: string | null; item_type: string; quantity: number; rate: number; amount: number; notes: string | null; taxable?: boolean }[];
  business: Business | null;
  total: number;
};

type Business = {
  name: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  invoice_business_name: string | null;
};

// Job-derived extras for the customer-facing invoice document (all null/empty for invoices with no job).
export type InvoiceDetailBundle = {
  invoice: Invoice;
  lineItems: InvoiceLineItem[];
  business: Business | null;
  job: { scheduled_date: string | null; created_at: string; completed_at: string | null; description: string | null; tech_notes: string | null; type: string } | null;
  photos: { id: string; url: string; label: string | null }[];
  serviceNotes: { text: string; author: string | null; created_at: string }[];
  // Client doc 2026-10-05: a combined/bulk invoice has no single job (invoice.job_id is null) --
  // these are the real jobs its line items (grouped by line.job_id) came from, oldest first.
  bulkJobs: { id: string; type: string; description: string | null; scheduled_date: string | null; tech_notes: string | null }[];
};

export const invoicingApi = {
  list: () => api.get<Invoice[]>("/api/invoices"),

  detail: (id: string) =>
    api.get<InvoiceDetailBundle>(`/api/invoices/${id}`),

  byJob: (jobId: string) => api.get<{ id: string } | null>(`/api/invoices/by-job?job_id=${jobId}`),

  create: (data: {
    customerId: string;
    jobId?: string | null;
    number: string;
    issueDate: string;
    dueDate: string | null;
    amount: number;
    status?: string;
    downPayment?: number;
    jobDescription?: string | null;
    lineItems?: LineItemInput[];
  }) => api.post<Invoice>("/api/invoices", data),

  // Client doc 2026-10-05: bulk/"Combine Completed Jobs" invoices now copy each job's real line
  // items server-side (grouped by job_id) instead of one flattened line per job client-side.
  createBulk: (data: { customerId: string; jobIds: string[]; number: string; issueDate: string }) =>
    api.post<Invoice>("/api/invoices/bulk", data),

  collectPayment: (id: string, method: "Card" | "ACH" | "Check", opaqueData?: { dataDescriptor: string; dataValue: string }) =>
    api.patch<Invoice>(`/api/invoices/${id}/collect-payment`, { method, opaqueData }),

  bulkCollect: (invoiceIds: string[], method: "Card" | "ACH" | "Check", opaqueData?: { dataDescriptor: string; dataValue: string }) =>
    api.post<Invoice[]>("/api/invoices/bulk-collect", { invoiceIds, method, opaqueData }),

  recurringBilling: () => api.get<RecurringBilling[]>("/api/invoices/recurring-billing/list"),

  payments: () => api.get<Payment[]>("/api/invoices/payments/list"),

  syncToQuickbooks: (id: string) => api.post<{ qboInvoiceId: string }>(`/api/invoices/${id}/quickbooks-sync`, {}),

  estimates: () => api.get<Estimate[]>("/api/invoices/estimates/list"),

  estimateDetail: (id: string) =>
    api.get<{ estimate: Estimate; lineItems: EstimateLineItem[]; business: Business | null }>(`/api/invoices/estimates/${id}`),

  createEstimate: (data: {
    customerId: string;
    jobId?: string | null;
    number: string;
    issueDate: string;
    expiryDate: string | null;
    amount: number;
    downPayment?: number;
    jobDescription?: string | null;
    lineItems?: LineItemInput[];
  }) => api.post<Estimate>("/api/invoices/estimates", data),

  // Client PDF 2026-09-05: "Need to be able to edit an estimate once created and saves".
  updateEstimate: (id: string, data: {
    customerId: string; issueDate: string; expiryDate: string | null; downPayment?: number;
    jobDescription?: string | null; lineItems?: LineItemInput[];
  }) => api.patch<Estimate>(`/api/invoices/estimates/${id}`, data),

  convertEstimateToInvoice: (id: string) => api.post<{ invoiceId: string }>(`/api/invoices/estimates/${id}/convert-to-invoice`, {}),

  convertEstimateToJob: (id: string) => api.post<{ jobId: string }>(`/api/invoices/estimates/${id}/convert-to-job`, {}),

  getEstimateAttachments: (id: string) => api.get<EstimateAttachment[]>(`/api/invoices/estimates/${id}/attachments`),

  addEstimateAttachment: (id: string, data: { url: string; label?: string | null; filename?: string | null; type?: "document" | "photo" }) =>
    api.post<EstimateAttachment>(`/api/invoices/estimates/${id}/attachments`, data),

  // 2026-09-25: Documents on invoices.
  getInvoiceDocuments: (id: string) => api.get<InvoiceAttachment[]>(`/api/invoices/${id}/attachments`),
  addInvoiceDocument: (id: string, data: { url: string; label?: string | null; filename?: string | null }) =>
    api.post<InvoiceAttachment>(`/api/invoices/${id}/attachments`, data),
  updateInvoiceDocumentLabel: (id: string, attId: string, label: string | null) =>
    api.patch<InvoiceAttachment>(`/api/invoices/${id}/attachments/${attId}`, { label }),
  deleteInvoiceDocument: (id: string, attId: string) => api.del<void>(`/api/invoices/${id}/attachments/${attId}`),

  updateEstimateDocumentLabel: (id: string, attId: string, label: string | null) =>
    api.patch<EstimateAttachment>(`/api/invoices/estimates/${id}/attachments/${attId}`, { label }),

  deleteEstimateDocument: (id: string, attId: string) => api.del<void>(`/api/invoices/estimates/${id}/attachments/${attId}`),

  vendorBills: () => api.get<VendorBill[]>("/api/invoices/vendor-bills/list"),

  createVendorBill: (data: { supplierId: string; number: string; issueDate: string; dueDate: string | null; amount: number; poId?: string | null }) =>
    api.post<VendorBill>("/api/invoices/vendor-bills", data),

  markVendorBillPaid: (id: string) => api.patch<VendorBill>(`/api/invoices/vendor-bills/${id}/mark-paid`, {}),

  // Client PDF 2026-09-06: "A way to Write off a job – (bad debt)".
  writeOffInvoice: (id: string, reason: string) => api.patch<Invoice>(`/api/invoices/${id}/write-off`, { reason }),

  // Client PDF 2026-09-06: "Estimate templates" (Heater replacement, Filter replacement...).
  estimateTemplates: () => api.get<EstimateTemplate[]>("/api/invoices/estimate-templates"),
  createEstimateTemplate: (data: { name: string; lineItems: LineItemInput[] }) =>
    api.post<EstimateTemplate>("/api/invoices/estimate-templates", data),
  deleteEstimateTemplate: (id: string) => api.del(`/api/invoices/estimate-templates/${id}`),

  // Public "Approve Estimation" link (backend/src/routes/public.ts) — no login required, so these
  // hit an unauthenticated route (apiClient just omits the Bearer header when there's no session).
  publicEstimate: (token: string) => api.get<PublicEstimate>(`/api/public/estimates/${token}`),
  respondToEstimate: (token: string, decision: "Accepted" | "Declined") =>
    api.post<{ id: string; status: string; approved_at: string | null }>(`/api/public/estimates/${token}/respond`, { decision }),

  // Public "pay this invoice" link, same no-login pattern as the estimate approval link above.
  publicInvoice: (token: string) => api.get<PublicInvoice>(`/api/public/invoices/${token}`),
  payInvoicePublic: (token: string, opaqueData: { dataDescriptor: string; dataValue: string }) =>
    api.post<Invoice>(`/api/public/invoices/${token}/pay`, { opaqueData }),

  // Client video 2026-10-06: real "Send via Email" — fails with a clear message (not a silent
  // no-op) until the SMTP password is configured on the server.
  sendInvoiceEmail: (id: string) => api.post<{ sent: true }>(`/api/invoices/${id}/send-email`, {}),
  sendEstimateEmail: (id: string) => api.post<{ sent: true }>(`/api/invoices/estimates/${id}/send-email`, {}),
};
