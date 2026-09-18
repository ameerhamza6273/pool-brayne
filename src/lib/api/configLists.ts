import { api } from "@/lib/apiClient";

export type ConfigListItem = { id: string; label: string; color: string | null };
export type ConfigListKey =
  | "job_types" | "job_statuses" | "estimate_statuses"
  | "call_types" | "call_sources" | "reschedule_types" | "cancellation_reasons";
export type ConfigLists = Record<ConfigListKey, ConfigListItem[]>;

export const configListsApi = {
  all: () => api.get<ConfigLists>("/api/settings/config-lists"),
  add: (key: ConfigListKey, label: string, color?: string) =>
    api.post<ConfigListItem>(`/api/settings/config-lists/${key}`, { label, color }),
  remove: (key: ConfigListKey, itemId: string) =>
    api.del<void>(`/api/settings/config-lists/${key}/${itemId}`),
};
