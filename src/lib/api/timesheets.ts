import { api } from "@/lib/apiClient";
import type { Database } from "@/lib/database.types";

type Timesheet = Database["public"]["Tables"]["timesheets"]["Row"] & { profiles: { name: string; role: string; employment_type: string } | null };
type JobCosting = Database["public"]["Tables"]["job_costing"]["Row"] & { profiles: { name: string } | null };

export const timesheetsApi = {
  forWeek: (week: string) => api.get<{ timesheets: Timesheet[]; jobCosting: JobCosting[]; employeeCount: number }>(`/api/timesheets?week=${week}`),

  approve: (id: string) => api.patch<Timesheet>(`/api/timesheets/${id}/approve`),

  approveWeek: (weekStart: string) => api.post<Timesheet[]>("/api/timesheets/approve-week", { weekStart }),

  clockOut: (weekStart: string, elapsedSeconds: number) => api.post<Timesheet>("/api/timesheets/clock-out", { weekStart, elapsedSeconds }),
};
