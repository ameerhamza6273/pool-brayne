import { api } from "@/lib/apiClient";

export type ConfigListItem = { id: string; label: string; color: string | null };
export type ConfigListKey =
  | "job_types" | "job_statuses" | "estimate_statuses"
  | "call_types" | "call_sources" | "reschedule_types" | "cancellation_reasons" | "reminder_types"
  | "library_categories" | "library_manufacturers" | "inventory_manufacturers";
export type ConfigLists = Record<ConfigListKey, ConfigListItem[]>;

export const configListsApi = {
  all: () => api.get<ConfigLists>("/api/settings/config-lists"),
  add: (key: ConfigListKey, label: string, color?: string) =>
    api.post<ConfigListItem>(`/api/settings/config-lists/${key}`, { label, color }),
  update: (key: ConfigListKey, itemId: string, patch: { label?: string; color?: string | null }) =>
    api.patch<ConfigListItem>(`/api/settings/config-lists/${key}/${itemId}`, patch),
  remove: (key: ConfigListKey, itemId: string) =>
    api.del<void>(`/api/settings/config-lists/${key}/${itemId}`),
};
