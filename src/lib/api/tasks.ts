import { api } from "@/lib/apiClient";

export type FreeformTask = {
  id: string;
  customer_id: string | null;
  tech_id: string | null;
  address: string | null;
  email: string | null;
  type: string;
  notes: string | null;
  photos: string[];
  start_date: string | null;
  end_date: string | null;
  status: string;
  created_at: string;
  customers: { name: string } | null;
  profiles: { name: string } | null;
};

type TaskInput = {
  customerId: string | null;
  techId: string | null;
  address: string | null;
  email: string | null;
  type: string;
  notes: string | null;
  photos: string[];
  startDate: string | null;
  endDate: string | null;
};

export const tasksApi = {
  list: () => api.get<FreeformTask[]>("/api/tasks"),

  create: (data: TaskInput) => api.post<FreeformTask>("/api/tasks", data),

  update: (id: string, data: TaskInput) => api.patch<FreeformTask>(`/api/tasks/${id}`, data),

  updateStatus: (id: string, status: string) => api.patch<FreeformTask>(`/api/tasks/${id}/status`, { status }),
};
