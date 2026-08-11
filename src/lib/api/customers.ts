import { api } from "@/lib/apiClient";
import type { Database } from "@/lib/database.types";

type Customer = Database["public"]["Tables"]["customers"]["Row"];
type ServiceHistory = Database["public"]["Tables"]["job_service_history"]["Row"];
type CustomerNote = Database["public"]["Tables"]["customer_notes"]["Row"];
type Invoice = Database["public"]["Tables"]["invoices"]["Row"];

export type CustomerAttachment = { id: string; customer_id: string; url: string; created_at: string };

export type CustomerDetailBundle = {
  customer: Customer;
  history: ServiceHistory[];
  notes: CustomerNote[];
  invoices: Invoice[];
};

export const customersApi = {
  list: () => api.get<Customer[]>("/api/customers"),

  detail: (id: string) => api.get<CustomerDetailBundle>(`/api/customers/${id}`),

  create: (data: { name: string; type: string; tags: string[]; email: string | null; phone: string | null; address: string | null }) =>
    api.post<Customer>("/api/customers", data),

  addNote: (customerId: string, data: { text: string; author: string }) =>
    api.post<CustomerNote>(`/api/customers/${customerId}/notes`, data),

  getAttachments: (customerId: string) => api.get<CustomerAttachment[]>(`/api/customers/${customerId}/attachments`),

  addAttachment: (customerId: string, url: string) =>
    api.post<CustomerAttachment>(`/api/customers/${customerId}/attachments`, { url }),

  syncToQuickbooks: (customerId: string) => api.post<{ qboCustomerId: string }>(`/api/customers/${customerId}/quickbooks-sync`, {}),
};
