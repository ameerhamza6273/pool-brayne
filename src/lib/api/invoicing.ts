import { api } from "@/lib/apiClient";
import type { Database } from "@/lib/database.types";

type Invoice = Database["public"]["Tables"]["invoices"]["Row"] & { customers: { name: string; address?: string | null } | null };
type LineItem = Database["public"]["Tables"]["invoice_line_items"]["Row"];
type RecurringBilling = Database["public"]["Tables"]["recurring_billing"]["Row"] & { customers: { name: string } | null };
type Payment = Database["public"]["Tables"]["payments"]["Row"] & { invoices: { number: string } | null; customers: { name: string } | null };

export const invoicingApi = {
  list: () => api.get<Invoice[]>("/api/invoices"),

  detail: (id: string) => api.get<{ invoice: Invoice; lineItems: LineItem[] }>(`/api/invoices/${id}`),

  byJob: (jobId: string) => api.get<{ id: string } | null>(`/api/invoices/by-job?job_id=${jobId}`),

  create: (data: { customerId: string; jobId?: string | null; number: string; issueDate: string; dueDate: string | null; amount: number; status?: string }) =>
    api.post<Invoice>("/api/invoices", data),

  collectPayment: (id: string, method: "Card" | "ACH") =>
    api.patch<Invoice>(`/api/invoices/${id}/collect-payment`, { method }),

  recurringBilling: () => api.get<RecurringBilling[]>("/api/invoices/recurring-billing/list"),

  payments: () => api.get<Payment[]>("/api/invoices/payments/list"),
};
