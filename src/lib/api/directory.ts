import { api } from "@/lib/apiClient";

export type DirectoryContact = {
  id: string;
  name: string;
  role: string | null;
  phone: string | null;
  description: string | null;
  email: string | null;
  created_at: string;
};

export const directoryApi = {
  list: () => api.get<DirectoryContact[]>("/api/directory"),

  create: (data: { name: string; role: string | null; phone: string | null; description?: string | null; email?: string | null }) =>
    api.post<DirectoryContact>("/api/directory", data),

  update: (id: string, data: { name: string; role: string | null; phone: string | null; description?: string | null; email?: string | null }) =>
    api.patch<DirectoryContact>(`/api/directory/${id}`, data),

  remove: (id: string) => api.del(`/api/directory/${id}`),
};
