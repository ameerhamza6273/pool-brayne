import { api } from "@/lib/apiClient";
import type { Database } from "@/lib/database.types";

type Customer = Database["public"]["Tables"]["customers"]["Row"];
type ServiceHistory = Database["public"]["Tables"]["job_service_history"]["Row"];
type CustomerNote = Database["public"]["Tables"]["customer_notes"]["Row"];
type Invoice = Database["public"]["Tables"]["invoices"]["Row"];

export type CustomerAttachment = { id: string; customer_id: string; url: string; created_at: string };

export type HouseholdMember = { id: string; name: string; phone: string | null; email: string | null };

export type PosOrderItem = { id: string; description: string; quantity: number; unit_price: number; amount: number };
export type PreviousSale = { id: string; created_at: string; total: number; payment_method: string | null; items: PosOrderItem[] };

export type CustomerDetailBundle = {
  customer: Customer;
  history: ServiceHistory[];
  notes: CustomerNote[];
  invoices: Invoice[];
  household: HouseholdMember[];
  previousSales: PreviousSale[];
};

export const customersApi = {
  list: () => api.get<Customer[]>("/api/customers"),

  detail: (id: string) => api.get<CustomerDetailBundle>(`/api/customers/${id}`),

  create: (data: {
    contacts: { name: string; email: string | null; phone: string | null }[];
    type: string;
    tags: string[];
    address: string | null;
  }) => api.post<Customer[]>("/api/customers", data),

  addNote: (customerId: string, data: { text: string; author: string }) =>
    api.post<CustomerNote>(`/api/customers/${customerId}/notes`, data),

  getAttachments: (customerId: string) => api.get<CustomerAttachment[]>(`/api/customers/${customerId}/attachments`),

  addAttachment: (customerId: string, url: string) =>
    api.post<CustomerAttachment>(`/api/customers/${customerId}/attachments`, { url }),

  syncToQuickbooks: (customerId: string) => api.post<{ qboCustomerId: string }>(`/api/customers/${customerId}/quickbooks-sync`, {}),

  updateCoordinates: (customerId: string, lat: number, lng: number) =>
    api.patch<{ id: string; lat: number; lng: number }>(`/api/customers/${customerId}/coordinates`, { lat, lng }),

  updateReminder: (customerId: string, nextReminderDate: string | null, reminderFrequencyMonths: number | null) =>
    api.patch<Customer>(`/api/customers/${customerId}/reminder`, { nextReminderDate, reminderFrequencyMonths }),
};
