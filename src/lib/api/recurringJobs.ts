import { api } from "@/lib/apiClient";

export type RecurringJob = {
  id: string;
  customer_id: string;
  tech_id: string | null;
  job_type: string;
  description: string | null;
  tech_notes: string | null;
  next_job_notes: string | null;
  selected_form_ids: string[] | null;
  // Standard start time (HH:MM:SS) every generated job inherits -- keeps the weekly route order.
  start_time: string | null;
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
    nextJobNotes?: string | null; selectedFormIds?: string[]; startTime?: string | null;
  }) => api.post<RecurringJob>("/api/recurring-jobs", data),

  update: (id: string, data: Partial<{
    techId: string | null; description: string | null; techNotes: string | null; address: string | null;
    amount: number; frequency: "weekly" | "biweekly" | "monthly"; dayOfWeek: number | null; dayOfMonth: number | null;
    endDate: string | null; active: boolean; nextJobNotes: string | null; selectedFormIds: string[]; startTime: string | null;
  }>) => api.patch<RecurringJob>(`/api/recurring-jobs/${id}`, data),

  // Convert an existing job into the first occurrence of a new recurring series, or dissolve a series
  // back into a one-time job.
  fromJob: (jobId: string, data: { frequency: "weekly" | "biweekly" | "monthly"; dayOfWeek?: number | null; dayOfMonth?: number | null; endDate?: string | null }) =>
    api.post<RecurringJob>(`/api/recurring-jobs/from-job/${jobId}`, data),
  // Give one tech's stops for a day their standard times (and their series', so the order repeats weekly).
  routeOrder: (items: { jobId: string | null; recurringId: string | null; time: string; repeatWeekly?: boolean }[]) =>
    api.post<{ jobsTimed: number; seriesTimed: number; madeRecurring: number }>("/api/recurring-jobs/route-order", { items }),
  makeOneTime: (id: string) => api.post<{ ok: boolean; jobId: string | null }>(`/api/recurring-jobs/${id}/make-one-time`),

  remove: (id: string) => api.del(`/api/recurring-jobs/${id}`),
};
