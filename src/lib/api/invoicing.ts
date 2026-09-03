import { api } from "@/lib/apiClient";
import type { Database } from "@/lib/database.types";

type Invoice = Database["public"]["Tables"]["invoices"]["Row"] & { customers: { name: string; address?: string | null } | null };
export type InvoiceLineItem = Database["public"]["Tables"]["invoice_line_items"]["Row"];
type RecurringBilling = Database["public"]["Tables"]["recurring_billing"]["Row"] & { customers: { name: string } | null };
type Payment = Database["public"]["Tables"]["payments"]["Row"] & { invoices: { number: string } | null; customers: { name: string } | null };
export type Estimate = Database["public"]["Tables"]["estimates"]["Row"] & { customers: { name: string; address?: string | null; phone?: string | null } | null };
export type EstimateLineItem = Database["public"]["Tables"]["estimate_line_items"]["Row"];
export type VendorBill = Database["public"]["Tables"]["vendor_bills"]["Row"] & { suppliers: { name: string } | null };

export type LineItemInput = {
  description: string;
  sku?: string | null;
  itemType?: "material" | "labor";
  quantity: number;
  cost?: number;
  rate: number;
};

type Business = { name: string; phone: string | null; address: string | null; invoice_business_name: string | null };

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

  convertEstimateToInvoice: (id: string) => api.post<{ invoiceId: string }>(`/api/invoices/estimates/${id}/convert-to-invoice`, {}),

  vendorBills: () => api.get<VendorBill[]>("/api/invoices/vendor-bills/list"),

  createVendorBill: (data: { supplierId: string; number: string; issueDate: string; dueDate: string | null; amount: number }) =>
    api.post<VendorBill>("/api/invoices/vendor-bills", data),

  markVendorBillPaid: (id: string) => api.patch<VendorBill>(`/api/invoices/vendor-bills/${id}/mark-paid`, {}),
};
