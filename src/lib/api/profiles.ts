import { api } from "@/lib/apiClient";
import type { Database } from "@/lib/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export const profilesApi = {
  list: () => api.get<Profile[]>("/api/profiles"),

  updateEmploymentType: (id: string, employmentType: "Employee" | "Contractor") =>
    api.patch<Profile>(`/api/profiles/${id}/employment-type`, { employmentType }),

  // Client SMS 2026-09-09: "able to add, edit, delete techs".
  create: (data: { name: string; email: string; password: string; role: string }) =>
    api.post<Profile>("/api/profiles", data),

  update: (id: string, data: { name: string; role: string }) =>
    api.patch<Profile>(`/api/profiles/${id}`, data),

  remove: (id: string) => api.del(`/api/profiles/${id}`),
};
