import { api } from "@/lib/apiClient";

export type ItemMovementRow = { name: string; sku: string; qty: number; movement_type: string };
export type DepositRow = { number: string; issue_date: string; down_payment: number; customers: { name: string } | null };
export type InvoiceDueRow = { customer_id: string; customer_name: string; total_due: number; invoice_count: number };
export type CustomerReminder = {
  id: string;
  customer_id: string;
  label: string;
  frequency_months: number;
  next_due: string;
  customers: { name: string; phone: string | null } | null;
};
export type ValuationRow = { name: string; sku: string; unit_cost: number; quantity: number; value: number };
export type VendorBillDueRow = { supplier_id: string; supplier_name: string; total_due: number; bill_count: number };

export const reportsApi = {
  itemMovement: (start: string, end: string) => api.get<ItemMovementRow[]>(`/api/reports/item-movement?start=${start}&end=${end}`),

  deposits: (start?: string, end?: string) =>
    api.get<DepositRow[]>(`/api/reports/deposits${start && end ? `?start=${start}&end=${end}` : ""}`),

  invoicesDue: () => api.get<InvoiceDueRow[]>("/api/reports/invoices-due"),

  reminders: () => api.get<CustomerReminder[]>("/api/reports/reminders"),

  addReminder: (data: { customerId: string; label: string; frequencyMonths: number; nextDue: string }) =>
    api.post<CustomerReminder>("/api/reports/reminders", data),

  markReminderDone: (id: string) => api.patch<CustomerReminder>(`/api/reports/reminders/${id}/mark-done`, {}),

  deleteReminder: (id: string) => api.del(`/api/reports/reminders/${id}`),

  inventoryValuation: () => api.get<ValuationRow[]>("/api/reports/inventory-valuation"),

  vendorBillsDue: () => api.get<VendorBillDueRow[]>("/api/reports/vendor-bills-due"),
};
