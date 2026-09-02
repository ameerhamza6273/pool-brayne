import { api } from "@/lib/apiClient";

export type DirectoryContact = {
  id: string;
  name: string;
  role: string | null;
  phone: string | null;
  created_at: string;
};

export const directoryApi = {
  list: () => api.get<DirectoryContact[]>("/api/directory"),

  create: (data: { name: string; role: string | null; phone: string | null }) =>
    api.post<DirectoryContact>("/api/directory", data),

  remove: (id: string) => api.del(`/api/directory/${id}`),
};
