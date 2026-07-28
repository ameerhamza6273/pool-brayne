import { api } from "@/lib/apiClient";

export const dashboardApi = {
  all: () =>
    api.get<{
      invoices: { amount: number; status: string; issue_date: string }[];
      jobs: {
        type: string; amount: number; status: string; scheduled_date: string | null; scheduled_time: string | null;
        tech_id: string | null; arrived_at: string | null; completed_at: string | null;
        profiles: { name: string; avatar: string | null } | null;
      }[];
      customers: { customer_since: string | null }[];
      inventoryAlerts: { id: string; name: string; current: number; threshold: number }[];
      variance: { id: string; name: string; expected: number; actual: number; variance_pct: number }[];
      topSellers: { id: string; name: string; sales: number; revenue: number }[];
    }>("/api/dashboard"),
};
