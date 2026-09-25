import { api } from "@/lib/apiClient";
import type { Database } from "@/lib/database.types";

type Timesheet = Database["public"]["Tables"]["timesheets"]["Row"] & { profiles: { name: string; role: string; employment_type: string } | null };
type JobCosting = Database["public"]["Tables"]["job_costing"]["Row"] & { profiles: { name: string } | null };

// Client SMS 2026-09-25: real clock punches, editable entries with notes, time-off / correction requests.
export type TimeEntry = { id: string; employee_id: string; employee_name: string | null; clock_in: string; clock_out: string | null; notes: string | null; created_by: string | null; edited_by: string | null; created_at: string };
export type TimeRequest = {
  id: string; employee_id: string; employee_name: string | null; request_type: string; start_date: string; end_date: string | null;
  hours: number | null; notes: string | null; status: "Pending" | "Approved" | "Denied"; decided_by_name: string | null; decided_at: string | null; decision_note: string | null; created_at: string;
};
export type TimeEntryInput = { employeeId?: string; clockIn: string; clockOut: string | null; notes?: string | null };
export type TimeRequestInput = { employeeId?: string; requestType: string; startDate: string; endDate?: string | null; hours?: number | null; notes?: string | null };

export const timesheetsApi = {
  forWeek: (week: string) => api.get<{ timesheets: Timesheet[]; jobCosting: JobCosting[]; employeeCount: number }>(`/api/timesheets?week=${week}`),

  approve: (id: string) => api.patch<Timesheet>(`/api/timesheets/${id}/approve`),

  approveWeek: (weekStart: string) => api.post<Timesheet[]>("/api/timesheets/approve-week", { weekStart }),

  clockOut: (weekStart: string, elapsedSeconds: number) => api.post<Timesheet>("/api/timesheets/clock-out", { weekStart, elapsedSeconds }),

  entries: (fromIso: string, toIso: string) => api.get<TimeEntry[]>(`/api/timesheets/entries?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`),
  clockStatus: () => api.get<{ open: TimeEntry | null }>("/api/timesheets/clock"),
  clockIn: (notes?: string) => api.post<TimeEntry>("/api/timesheets/clock-in", { notes: notes || null }),
  clockOutEntry: (notes?: string) => api.post<TimeEntry>("/api/timesheets/clock-out-entry", { notes: notes || null }),
  addEntry: (data: TimeEntryInput) => api.post<TimeEntry>("/api/timesheets/entries", data),
  updateEntry: (id: string, data: TimeEntryInput) => api.patch<TimeEntry>(`/api/timesheets/entries/${id}`, data),
  deleteEntry: (id: string) => api.del<void>(`/api/timesheets/entries/${id}`),
  approveEmployee: (employeeId: string, weekStart: string) => api.post("/api/timesheets/approve-employee", { employeeId, weekStart }),
  requests: () => api.get<TimeRequest[]>("/api/timesheets/requests"),
  addRequest: (data: TimeRequestInput) => api.post<TimeRequest>("/api/timesheets/requests", data),
  decideRequest: (id: string, status: "Approved" | "Denied" | "Pending", note?: string) => api.patch<TimeRequest>(`/api/timesheets/requests/${id}/decision`, { status, note: note || null }),
  deleteRequest: (id: string) => api.del<void>(`/api/timesheets/requests/${id}`),
};
