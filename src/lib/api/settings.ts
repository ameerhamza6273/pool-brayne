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
  }>("/api/settings"),

  saveCompany: (name: string) => api.patch("/api/settings/company", { name }),

  selectPlan: (planId: string) => api.patch("/api/settings/plan", { planId }),
};
