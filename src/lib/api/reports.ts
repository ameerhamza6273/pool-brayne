import { api } from "@/lib/apiClient";

export type ItemMovementRow = {
  item: string; description: string | null; sku: string; category: string; location: string | null;
  movement_date: string; ref_id: string | null; ref_type: "pos" | "job" | "writeoff";
  cost: number; price: number | null; qty: number; total_cost: number; total_price: number | null;
  movement_type: string;
};
export type DepositRow = { number: string; issue_date: string; down_payment: number; customers: { name: string } | null };
export type InvoiceDueRow = {
  customer_id: string; customer_name: string; account_number: string | null;
  bucket_0_30: number; bucket_31_60: number; bucket_61_90: number; bucket_90_plus: number;
  total_due: number; invoice_count: number;
};
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

export type SalesTaxBasis = "accrual" | "cash";
export type SalesTaxLine = {
  description: string; brand: string | null; itemNumber: string | null; quantity: number;
  category: "Taxable Sale" | "Nontax Sale" | "Labor" | "Taxable Labor"; taxable: boolean; price: number; tax: number;
};
export type SalesTaxGroup = {
  kind: "invoice" | "pos"; id: string; number: string | null; status: string; date: string | null;
  customerName: string | null; jobId: string | null; jobType: string | null;
  // Cash basis only: % of the invoice collected inside the date range (lines are scaled by it).
  paidShare: number | null;
  lines: SalesTaxLine[];
};
export type SalesTaxDetail = {
  basis: SalesTaxBasis; taxRate: number; groups: SalesTaxGroup[];
  totals: { orders: number; sales: number; taxableSales: number; nontaxableSales: number; tax: number };
};

export type SalesAnalysisRow = {
  key: string; kind: "invoice" | "pos"; refId: string; number: string | null; paidDate: string;
  jobType: string | null; status: "Delivered" | "Not Delivered"; accountNumber: string | null; customerName: string | null;
  paymentType: "Cash" | "Check" | "Credit Card" | "Other" | "Refund"; paymentMode: string;
  amount: number; delivered: number; salesCheck: number; diffAr: number; labor: number; itemCost: number; laborCost: number;
  customerDeposit: number; merch: number; inStoreLabor: number; jobLabor: number; discount: number; tax: number;
  combinedInvoice: string | null; payoutId: string | null;
};

export const reportsApi = {
  // Client xlsx 2026-10-15: sales analysis -- every payment in a date range, their old system's columns.
  salesAnalysis: (start: string, end: string) =>
    api.get<{ rows: SalesAnalysisRow[] }>(`/api/reports/sales-analysis?start=${start}&end=${end}&tz=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`),

  // Client PDF 2026-10-15: sales tax detail by order/job then item, accrual or cash basis.
  salesTaxDetail: (start: string, end: string, basis: SalesTaxBasis) =>
    api.get<SalesTaxDetail>(`/api/reports/sales-tax-detail?start=${start}&end=${end}&basis=${basis}&tz=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`),

  itemMovement: (start: string, end: string) => api.get<ItemMovementRow[]>(`/api/reports/item-movement?start=${start}&end=${end}`),

  deposits: (start?: string, end?: string) =>
    api.get<DepositRow[]>(`/api/reports/deposits${start && end ? `?start=${start}&end=${end}` : ""}`),

  invoicesDue: () => api.get<InvoiceDueRow[]>("/api/reports/invoices-due"),

  reminders: () => api.get<CustomerReminder[]>("/api/reports/reminders"),

  addReminder: (data: { customerId: string; label: string; frequencyMonths: number; nextDue: string }) =>
    api.post<CustomerReminder>("/api/reports/reminders", data),

  markReminderDone: (id: string) => api.patch<CustomerReminder>(`/api/reports/reminders/${id}/mark-done`, {}),

  updateReminder: (id: string, data: { label?: string; frequencyMonths?: number; nextDue?: string }) =>
    api.patch<CustomerReminder>(`/api/reports/reminders/${id}`, data),

  deleteReminder: (id: string) => api.del(`/api/reports/reminders/${id}`),

  inventoryValuation: (asOf?: string) =>
    api.get<ValuationRow[]>(`/api/reports/inventory-valuation${asOf ? `?asOf=${asOf}` : ""}`),

  vendorBillsDue: () => api.get<VendorBillDueRow[]>("/api/reports/vendor-bills-due"),
};
