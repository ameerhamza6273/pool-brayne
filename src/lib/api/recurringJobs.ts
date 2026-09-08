import { api } from "@/lib/apiClient";

export type RecurringJob = {
  id: string;
  customer_id: string;
  tech_id: string | null;
  job_type: string;
  description: string | null;
  tech_notes: string | null;
  address: string | null;
  amount: number;
  frequency: "weekly" | "biweekly" | "monthly";
  day_of_week: number | null;
  day_of_month: number | null;
  start_date: string;
  end_date: string | null;
  active: boolean;
  created_at: string;
  customers: { name: string } | null;
  profiles: { name: string } | null;
};

export const recurringJobsApi = {
  list: () => api.get<RecurringJob[]>("/api/recurring-jobs"),

  create: (data: {
    customerId: string; techId: string | null; jobType: string; description: string | null; techNotes: string | null;
    address: string | null; amount: number; frequency: "weekly" | "biweekly" | "monthly";
    dayOfWeek: number | null; dayOfMonth: number | null; startDate: string; endDate: string | null;
  }) => api.post<RecurringJob>("/api/recurring-jobs", data),

  update: (id: string, data: Partial<{
    techId: string | null; description: string | null; techNotes: string | null; address: string | null;
    amount: number; frequency: "weekly" | "biweekly" | "monthly"; dayOfWeek: number | null; dayOfMonth: number | null;
    endDate: string | null; active: boolean;
  }>) => api.patch<RecurringJob>(`/api/recurring-jobs/${id}`, data),

  remove: (id: string) => api.del(`/api/recurring-jobs/${id}`),
};
