import type { RecurringJob } from "@/lib/api/recurringJobs";

// Mirrors backend/src/routes/recurringJobs.ts `nextOccurrenceDate` (all in UTC so a timezone can't shift
// the day). Client SMS 2026-09-21: "we created recurring jobs and they only appear on the first date ...
// it needs to repeat on the calendar view" -- the server only creates the NEXT real job once the current
// one is completed, so the calendar projects the dates after the latest real occurrence itself.
export function nextOccurrence(fromDate: string, rj: Pick<RecurringJob, "frequency" | "day_of_month">): string {
  const d = new Date(`${fromDate}T00:00:00Z`);
  if (rj.frequency === "weekly") d.setUTCDate(d.getUTCDate() + 7);
  else if (rj.frequency === "biweekly") d.setUTCDate(d.getUTCDate() + 14);
  else {
    d.setUTCMonth(d.getUTCMonth() + 1);
    if (rj.day_of_month) d.setUTCDate(rj.day_of_month);
  }
  return d.toISOString().slice(0, 10);
}

const MAX_PROJECTED = 60;

// Dates (YYYY-MM-DD) strictly after `anchor` (the latest real occurrence, or the start date) up to `upTo`.
export function projectOccurrences(rj: RecurringJob, anchor: string, upTo: string): string[] {
  const out: string[] = [];
  let d = anchor;
  for (let i = 0; i < MAX_PROJECTED; i++) {
    d = nextOccurrence(d, rj);
    if (d > upTo) break;
    if (rj.end_date && d > rj.end_date) break;
    out.push(d);
  }
  return out;
}

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Human "repeats on" text for a series (weekly/biweekly = its weekday, monthly = day of month).
export function repeatsOn(rj: Pick<RecurringJob, "frequency" | "start_date" | "day_of_week" | "day_of_month">): string {
  if (rj.frequency === "monthly") {
    const day = rj.day_of_month ?? new Date(`${rj.start_date}T00:00:00Z`).getUTCDate();
    return `Day ${day}`;
  }
  const dow = rj.day_of_week ?? new Date(`${rj.start_date}T00:00:00Z`).getUTCDay();
  return WEEKDAYS[dow] ?? "";
}
