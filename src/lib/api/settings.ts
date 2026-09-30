import { api } from "@/lib/apiClient";
import type { Database } from "@/lib/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Integration = Database["public"]["Tables"]["integrations"]["Row"];
type SubscriptionPlan = Database["public"]["Tables"]["subscription_plans"]["Row"];
type BillingHistoryRow = Database["public"]["Tables"]["billing_history"]["Row"];

export const settingsApi = {
  all: () => api.get<{
    teamMembers: Profile[];
    integrations: Integration[];
    subscriptionPlans: SubscriptionPlan[];
    billingHistory: BillingHistoryRow[];
    tenantName: string;
    planId: string | null;
    phone: string;
    address: string;
    city: string | null;
    state: string | null;
    zip: string | null;
    invoiceBusinessName: string;
    payrollWeekStartDay: number;
  }>("/api/settings"),

  saveCompany: (data: { name: string; phone: string; address: string; city: string; state: string; zip: string; invoiceBusinessName: string }) =>
    api.patch("/api/settings/company", data),

  savePayrollWeekStart: (payrollWeekStartDay: number) => api.patch("/api/settings/payroll", { payrollWeekStartDay }),

  // Client video 2026-09-25: POS receipt header + editable return/refund disclaimer.
  // Client SMS 2026-09-30: + which identifier (SKU or Item #) prints under each line.
  receipt: () => api.get<{ businessName: string; phone: string; address: string; disclaimer: string; lineId: "sku" | "item_number" }>("/api/settings/receipt"),

  saveReceiptDisclaimer: (disclaimer: string) => api.patch<{ disclaimer: string }>("/api/settings/receipt", { disclaimer }),

  saveReceiptLineId: (lineId: "sku" | "item_number") => api.patch<{ lineId: "sku" | "item_number" }>("/api/settings/receipt-line-id", { lineId }),

  selectPlan: (planId: string) => api.patch("/api/settings/plan", { planId }),
};
