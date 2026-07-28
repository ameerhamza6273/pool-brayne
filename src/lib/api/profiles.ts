import { api } from "@/lib/apiClient";
import type { Database } from "@/lib/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export const profilesApi = {
  list: () => api.get<Profile[]>("/api/profiles"),

  updateEmploymentType: (id: string, employmentType: "Employee" | "Contractor") =>
    api.patch<Profile>(`/api/profiles/${id}/employment-type`, { employmentType }),
};
