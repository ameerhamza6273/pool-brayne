import { api } from "@/lib/apiClient";

export const quickbooksApi = {
  getConnectUrl: () => api.get<{ url: string }>("/api/quickbooks/connect-url"),
  disconnect: () => api.post("/api/quickbooks/disconnect"),
};
