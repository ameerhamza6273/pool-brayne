import { api } from "@/lib/apiClient";

export type GlobalSearchResult = {
  customers: { id: string; name: string; phone: string | null; address: string | null }[];
  jobs: { id: string; type: string; description: string | null; scheduled_date: string | null; customer_name: string | null }[];
  invoices: { id: string; number: string; status: string; customer_name: string | null }[];
  estimates: { id: string; number: string; status: string; customer_name: string | null }[];
};

export const searchApi = {
  search: (q: string) => api.get<GlobalSearchResult>(`/api/search?q=${encodeURIComponent(q)}`),
};
