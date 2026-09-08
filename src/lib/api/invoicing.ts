import { api } from "@/lib/apiClient";
import type { Database } from "@/lib/database.types";

type Invoice = Database["public"]["Tables"]["invoices"]["Row"] & { customers: { name: string; address?: string | null } | null };
export type InvoiceLineItem = Database["public"]["Tables"]["invoice_line_items"]["Row"];
type RecurringBilling = Database["public"]["Tables"]["recurring_billing"]["Row"] & { customers: { name: string } | null };
type Payment = Database["public"]["Tables"]["payments"]["Row"] & { invoices: { number: string } | null; customers: { name: string } | null };
export type Estimate = Database["public"]["Tables"]["estimates"]["Row"] & { customers: { name: string; address?: string | null; phone?: string | null } | null };
export type EstimateLineItem = Database["public"]["Tables"]["estimate_line_items"]["Row"];
export type VendorBill = Database["public"]["Tables"]["vendor_bills"]["Row"] & { suppliers: { name: string } | null };

export type EstimateAttachment = { id: string; estimate_id: string; url: string; label: string | null; filename: string | null; type: "document" | "photo"; created_at: string };

export type LineItemInput = {
  description: string;
  sku?: string | null;
  itemType?: "material" | "labor";
  quantity: number;
  cost?: number;
  rate: number;
  notes?: string | null;
};

export type EstimateTemplate = { id: string; name: string; line_items: LineItemInput[] };

export type PublicEstimate = {
  estimate: {
    id: string; number: string; issue_date: string; expiry_date: string | null; job_description: string | null;
    status: string; down_payment: number; approved_at: string | null;
    customers: { name: string; address: string | null; phone: string | null } | null;
  };
  lineItems: { description: string; sku: string | null; item_type: string; quantity: number; rate: number; amount: number; notes: string | null }[];
  business: Business | null;
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

export const invoicingApi = {
  list: () => api.get<Invoice[]>("/api/invoices"),

  detail: (id: string) =>
    api.get<{ invoice: Invoice; lineItems: InvoiceLineItem[]; business: Business | null }>(`/api/invoices/${id}`),

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

  vendorBills: () => api.get<VendorBill[]>("/api/invoices/vendor-bills/list"),

  createVendorBill: (data: { supplierId: string; number: string; issueDate: string; dueDate: string | null; amount: number }) =>
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
};
