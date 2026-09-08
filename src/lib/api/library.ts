import { api } from "@/lib/apiClient";

export type LibraryDocument = {
  id: string;
  name: string;
  category: string | null;
  url: string;
  filename: string | null;
  uploaded_by_name: string | null;
  created_at: string;
};

export const libraryApi = {
  list: () => api.get<LibraryDocument[]>("/api/library"),

  add: (data: { name: string; category: string | null; url: string; filename: string | null }) =>
    api.post<LibraryDocument>("/api/library", data),

  remove: (id: string) => api.del(`/api/library/${id}`),
};
