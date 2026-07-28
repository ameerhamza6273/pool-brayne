import { api } from "@/lib/apiClient";
import type { Database } from "@/lib/database.types";

type RecurringRoute = Database["public"]["Tables"]["recurring_routes"]["Row"] & { profiles: { name: string } | null };

export const recurringRoutesApi = {
  list: () => api.get<RecurringRoute[]>("/api/recurring-routes"),
};
