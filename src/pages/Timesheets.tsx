import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Users, Briefcase, ChevronLeft, ChevronRight, Plus, Pencil, Trash2, UserPlus, CalendarPlus, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { timesheetsApi, type TimeEntry, type TimeRequest } from "@/lib/api/timesheets";
import { settingsApi } from "@/lib/api/settings";
import { profilesApi } from "@/lib/api/profiles";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import ClockCard from "@/components/ClockCard";
import TimeRequestDialog from "@/components/TimeRequestDialog";
import type { Database } from "@/lib/database.types";

type Timesheet = Database["public"]["Tables"]["timesheets"]["Row"] & { profiles: { name: string; role: string; employment_type: string } | null };
type JobCosting = Database["public"]["Tables"]["job_costing"]["Row"] & { profiles: { name: string } | null };
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Client request 2026-09-02: payroll week can start on any day (they run Wed-Tue), not always
// Monday — finds the most recent date on or before today whose weekday matches startDay.
function weekStartOf(date: Date, startDay: number) {
  const d = new Date(date);
  const diff = (d.getDay() - startDay + 7) % 7;
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

const pad = (n: number) => String(n).padStart(2, "0");
const localKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = (k: string) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
// <input type="datetime-local"> value <-> ISO
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${localKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);
const entryHours = (e: TimeEntry, now: number) => Math.max(0, ((e.clock_out ? new Date(e.clock_out).getTime() : now) - new Date(e.clock_in).getTime()) / 3600000);
const round2 = (n: number) => Math.round(n * 100) / 100;
const fmtTime = (iso: string, locale?: string) => new Date(iso).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });

type EntryDraft = { id: string | null; employeeId: string; clockIn: string; clockOut: string; notes: string };

export default function Timesheets() {
  const { user, profileId, role } = useAuth();
  const { t, lang } = useLanguage();
  // Dates follow the chosen language (they used to always print in English).
  const locale = lang === "es" ? "es-US" : "en-US";
  const navigate = useNavigate();
  const isOffice = role !== "technician" && role !== "contractor";
  const [isLoading, setIsLoading] = useState(true);
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [jobCosting, setJobCosting] = useState<JobCosting[]>([]);
  const [employeeCount, setEmployeeCount] = useState(0);
  const [payrollWeekStartDay, setPayrollWeekStartDay] = useState(1);
  const [weekOffset, setWeekOffset] = useState(0);
  const [staff, setStaff] = useState<Profile[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [requests, setRequests] = useState<TimeRequest[]>([]);
  const [requestFilter, setRequestFilter] = useState<"Pending" | "All">("Pending");
  const [onlyWithHours, setOnlyWithHours] = useState(false);
  const [detailFor, setDetailFor] = useState<string | null>(null);
  const [draft, setDraft] = useState<EntryDraft | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [requestDialog, setRequestDialog] = useState(false);
  const [decision, setDecision] = useState<{ request: TimeRequest; status: "Approved" | "Denied"; note: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const weekStart = useMemo(() => {
    const base = new Date();
    base.setDate(base.getDate() + weekOffset * 7);
    return weekStartOf(base, payrollWeekStartDay);
  }, [weekOffset, payrollWeekStartDay]);
  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = fromKey(weekStart); d.setDate(d.getDate() + i); return d; }), [weekStart]);

  useEffect(() => {
    settingsApi.all().then((data) => setPayrollWeekStartDay(data.payrollWeekStartDay));
    profilesApi.list().then((data) => setStaff(data ?? [])).catch(() => { /* table falls back to people with hours */ });
  }, []);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  const loadTimesheets = useCallback(async () => {
    setIsLoading(true);
    const from = fromKey(weekStart);
    const to = new Date(from); to.setDate(to.getDate() + 7);
    const [data, ents, reqs] = await Promise.all([
      timesheetsApi.forWeek(weekStart),
      timesheetsApi.entries(from.toISOString(), to.toISOString()).catch(() => [] as TimeEntry[]),
      timesheetsApi.requests().catch(() => [] as TimeRequest[]),
    ]);
    setTimesheets(data.timesheets);
    setJobCosting(data.jobCosting);
    setEmployeeCount(data.employeeCount);
    setEntries(ents);
    setRequests(reqs);
    setIsLoading(false);
  }, [weekStart]);

  useEffect(() => {
    loadTimesheets();
  }, [loadTimesheets]);

  // One row per staff member (client: "need to be able to add employees" -- everyone on the team is listed,
  // new people are added under Settings > Team). Each day = hours from the old weekly row + clock entries.
  const rows = useMemo(() => {
    const ids = new Set<string>([...staff.map((p) => p.id), ...timesheets.map((ts) => ts.employee_id), ...entries.map((e) => e.employee_id)]);
    return [...ids].map((id) => {
      const p = staff.find((x) => x.id === id);
      const ts = timesheets.find((x) => x.employee_id === id) ?? null;
      const mine = entries.filter((e) => e.employee_id === id);
      const days = weekDates.map((d) => {
        const legacy = ts ? Number(ts[DAY_KEYS[d.getDay()]] ?? 0) : 0;
        const key = localKey(d);
        const clocked = mine.filter((e) => localKey(new Date(e.clock_in)) === key).reduce((s, e) => s + entryHours(e, now), 0);
        return round2(legacy + clocked);
      });
      const total = round2(days.reduce((s, h) => s + h, 0));
      const legacyOT = ts ? Number(ts.overtime_hours ?? 0) : 0;
      return {
        id,
        name: p?.name ?? ts?.profiles?.name ?? mine[0]?.employee_name ?? "—",
        employmentType: p?.employment_type ?? ts?.profiles?.employment_type ?? "Employee",
        ts,
        entries: mine,
        days,
        total,
        ot: legacyOT > 0 ? legacyOT : round2(Math.max(0, total - 40)),
        clockedIn: mine.some((e) => !e.clock_out),
        approved: ts?.status === "Approved",
      };
    })
      .filter((r) => !onlyWithHours || r.total > 0 || r.clockedIn)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [staff, timesheets, entries, weekDates, now, onlyWithHours]);

  const totalHours = rows.reduce((sum, r) => sum + r.total, 0);
  const totalOT = rows.reduce((sum, r) => sum + r.ot, 0);
  const estPayroll = totalHours * 28 + totalOT * 42;
  const detailRow = rows.find((r) => r.id === detailFor) ?? null;
  const shownRequests = requests.filter((r) => requestFilter === "All" || r.status === "Pending");
  const pendingCount = requests.filter((r) => r.status === "Pending").length;

  const handleApprove = async (row: (typeof rows)[number]) => {
    if (row.ts) await timesheetsApi.approve(row.ts.id);
    else await timesheetsApi.approveEmployee(row.id, weekStart);
    loadTimesheets();
  };

  const handleApproveWeek = async () => {
    await timesheetsApi.approveWeek(weekStart);
    // Employees whose hours are only clock entries don't have a weekly row yet.
    await Promise.all(rows.filter((r) => !r.ts && r.total > 0).map((r) => timesheetsApi.approveEmployee(r.id, weekStart)));
    loadTimesheets();
  };

  const openNewEntry = (employeeId: string) => {
    const day = weekOffset === 0 ? localKey(new Date()) : weekStart;
    setDraftError(null);
    setDraft({ id: null, employeeId, clockIn: `${day}T08:00`, clockOut: `${day}T16:00`, notes: "" });
  };
  const openEditEntry = (e: TimeEntry) => {
    setDraftError(null);
    setDraft({ id: e.id, employeeId: e.employee_id, clockIn: toLocalInput(e.clock_in), clockOut: toLocalInput(e.clock_out), notes: e.notes ?? "" });
  };
  const saveDraft = async () => {
    if (!draft) return;
    const clockIn = fromLocalInput(draft.clockIn);
    const clockOut = fromLocalInput(draft.clockOut);
    if (!clockIn) { setDraftError(t("Enter the clock-in time")); return; }
    if (clockOut && clockOut <= clockIn) { setDraftError(t("Clock out must be after clock in")); return; }
    setSaving(true);
    setDraftError(null);
    try {
      const body = { employeeId: draft.employeeId, clockIn, clockOut, notes: draft.notes.trim() || null };
      if (draft.id) await timesheetsApi.updateEntry(draft.id, body);
      else await timesheetsApi.addEntry(body);
      setDraft(null);
      await loadTimesheets();
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : "Couldn't save");
    }
    setSaving(false);
  };
  const deleteEntry = async (e: TimeEntry) => {
    await timesheetsApi.deleteEntry(e.id);
    loadTimesheets();
  };

  const decide = async () => {
    if (!decision) return;
    setSaving(true);
    try {
      await timesheetsApi.decideRequest(decision.request.id, decision.status, decision.note.trim());
      setDecision(null);
      await loadTimesheets();
    } finally {
      setSaving(false);
    }
  };

  const weekLabel = `${weekDates[0].toLocaleDateString(locale, { month: "short", day: "numeric" })} – ${weekDates[6].toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" })}`;
  const statusBadge = (s: string) => s === "Approved" ? "bg-[#16A34A]/10 text-[#16A34A]" : s === "Denied" ? "bg-[#DC2626]/10 text-[#DC2626]" : "bg-[#F59E0B]/10 text-[#F59E0B]";

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">{t("Timesheets")}</h1>
          <div className="flex items-center gap-1.5 mt-1">
            <Button variant="outline" size="icon" className="h-7 w-7 border-[#E2E8F0]" onClick={() => setWeekOffset((w) => w - 1)} title={t("Previous week")}><ChevronLeft className="w-4 h-4" /></Button>
            <span className="text-sm text-[#64748B]">{t("Week of")} {weekLabel}</span>
            <Button variant="outline" size="icon" className="h-7 w-7 border-[#E2E8F0]" onClick={() => setWeekOffset((w) => w + 1)} title={t("Next week")}><ChevronRight className="w-4 h-4" /></Button>
            {weekOffset !== 0 && <Button variant="ghost" className="h-7 px-2 text-xs" onClick={() => setWeekOffset(0)}>{t("This week")}</Button>}
          </div>
        </div>
        {isOffice && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="h-10 gap-2 border-[#E2E8F0]" onClick={() => navigate("/settings?tab=team")}>
              <UserPlus className="w-4 h-4 text-[#0891B2]" /> {t("Add Employee")}
            </Button>
            <Button className="bg-[#16A34A] hover:bg-[#15803D] text-white gap-2 h-10" onClick={handleApproveWeek}>
              <CheckCircle2 className="w-4 h-4" /> {t("Approve Week")}
            </Button>
          </div>
        )}
      </div>

      <ClockCard name={user?.name ?? "—"} onChange={loadTimesheets} />

      {isLoading && <div className="text-center py-8 text-[#64748B]">{t("Loading timesheets...")}</div>}

      {!isLoading && (
      <>
      {/* Timesheet Table */}
      <Card className="border-[#E2E8F0] shadow-sm overflow-hidden">
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-sm font-semibold text-[#0F172A]">{t("Weekly Hours")}</CardTitle>
          <label className="flex items-center gap-1.5 text-xs text-[#64748B] cursor-pointer">
            <input type="checkbox" checked={onlyWithHours} onChange={(e) => setOnlyWithHours(e.target.checked)} /> {t("Only people with hours")}
          </label>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Employee")}</th>
                  {weekDates.map((d) => (
                    <th key={localKey(d)} className="text-center py-3 px-2 text-xs font-semibold text-[#64748B] uppercase">
                      {t(DAY_LABELS[d.getDay()])}<div className="text-[10px] font-normal normal-case">{d.getMonth() + 1}/{d.getDate()}</div>
                    </th>
                  ))}
                  <th className="text-right py-3 px-2 text-xs font-semibold text-[#64748B] uppercase">{t("Total")}</th>
                  <th className="text-right py-3 px-2 text-xs font-semibold text-[#64748B] uppercase">{t("OT")}</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Status")}</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Action")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] cursor-pointer" onClick={() => setDetailFor(r.id)} title={t("Click to see and edit this week's times")}>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[#0F172A]">{r.name}</span>
                        <Badge className={`${r.employmentType === "Contractor" ? "bg-[#F59E0B]/10 text-[#F59E0B]" : "bg-[#0891B2]/10 text-[#0891B2]"} text-[10px] px-1.5 py-0`}>
                          {t(r.employmentType)}
                        </Badge>
                        {r.clockedIn && <Badge className="bg-[#16A34A]/10 text-[#16A34A] text-[10px] px-1.5 py-0">{t("On the clock")}</Badge>}
                      </div>
                    </td>
                    {r.days.map((h, i) => <td key={i} className={`text-center py-3 px-2 ${h ? "text-[#0F172A]" : "text-[#CBD5E1]"}`}>{h || "0"}</td>)}
                    <td className="text-right py-3 px-2 font-semibold text-[#0F172A]">{r.total}</td>
                    <td className="text-right py-3 px-2 font-semibold text-[#F59E0B]">{r.ot > 0 ? r.ot : "—"}</td>
                    <td className="text-center py-3 px-4">
                      <Badge className={`${r.approved ? "bg-[#16A34A]/10 text-[#16A34A]" : "bg-[#F59E0B]/10 text-[#F59E0B]"} text-[10px] px-1.5 py-0`}>
                        {r.approved ? t("Approved") : t("Pending")}
                      </Badge>
                    </td>
                    <td className="text-center py-3 px-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1.5">
                        {isOffice && (
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs border-[#E2E8F0]" onClick={() => openNewEntry(r.id)} title={t("Add time")}>
                            <Plus className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {isOffice && !r.approved && (r.total > 0 || r.ts) && (
                          <Button size="sm" className="h-7 bg-[#0891B2] hover:bg-[#0E7490] text-white text-xs" onClick={() => handleApprove(r)}>
                            {t("Approve")}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={12} className="py-8 text-center text-[#64748B]">{t("No hours this week.")}</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Requests */}
      <Card className="border-[#E2E8F0] shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-sm font-semibold text-[#0F172A]">
            {t("Requests")} {pendingCount > 0 && <Badge className="ml-1 bg-[#F59E0B]/10 text-[#F59E0B] text-[10px] px-1.5 py-0">{pendingCount} {t("pending")}</Badge>}
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex border border-[#E2E8F0] rounded-md overflow-hidden text-xs">
              {(["Pending", "All"] as const).map((f) => (
                <button key={f} onClick={() => setRequestFilter(f)} className={`px-2.5 py-1 ${requestFilter === f ? "bg-[#0891B2] text-white" : "bg-white text-[#64748B]"}`}>{t(f)}</button>
              ))}
            </div>
            <Button size="sm" variant="outline" className="h-8 gap-1.5 border-[#E2E8F0]" onClick={() => setRequestDialog(true)}>
              <CalendarPlus className="w-3.5 h-3.5 text-[#0891B2]" /> {t("New Request")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <th className="text-left py-2 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Employee")}</th>
                  <th className="text-left py-2 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Type")}</th>
                  <th className="text-left py-2 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Dates")}</th>
                  <th className="text-right py-2 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Hours")}</th>
                  <th className="text-left py-2 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Notes")}</th>
                  <th className="text-center py-2 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Status")}</th>
                  <th className="text-center py-2 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Action")}</th>
                </tr>
              </thead>
              <tbody>
                {shownRequests.map((rq) => (
                  <tr key={rq.id} className="border-b border-[#F1F5F9] last:border-0 align-top">
                    <td className="py-2 px-4 font-medium text-[#0F172A]">{rq.employee_name ?? "—"}</td>
                    <td className="py-2 px-4">{t(rq.request_type)}</td>
                    <td className="py-2 px-4 whitespace-nowrap">{rq.start_date}{rq.end_date && rq.end_date !== rq.start_date ? ` → ${rq.end_date}` : ""}</td>
                    <td className="py-2 px-4 text-right">{rq.hours != null ? Number(rq.hours) : "—"}</td>
                    <td className="py-2 px-4 text-[#64748B] max-w-[280px]">
                      <p className="whitespace-pre-wrap">{rq.notes ?? ""}</p>
                      {rq.decision_note && <p className="text-xs mt-1 text-[#0F172A]">{t("Reply")}: {rq.decision_note}</p>}
                    </td>
                    <td className="py-2 px-4 text-center">
                      <Badge className={`${statusBadge(rq.status)} text-[10px] px-1.5 py-0`}>{t(rq.status)}</Badge>
                      {rq.decided_by_name && <p className="text-[10px] text-[#94A3B8] mt-0.5">{rq.decided_by_name}</p>}
                    </td>
                    <td className="py-2 px-4">
                      <div className="flex items-center justify-center gap-1.5">
                        {isOffice && rq.status === "Pending" && (
                          <>
                            <Button size="sm" className="h-7 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs" onClick={() => setDecision({ request: rq, status: "Approved", note: "" })}>{t("Approve")}</Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs border-[#DC2626]/40 text-[#DC2626]" onClick={() => setDecision({ request: rq, status: "Denied", note: "" })}>{t("Deny")}</Button>
                          </>
                        )}
                        {(isOffice || (rq.employee_id === profileId && rq.status === "Pending")) && (
                          <button className="p-1 rounded text-[#94A3B8] hover:text-[#DC2626]" title={t("Delete request")} onClick={async () => { await timesheetsApi.deleteRequest(rq.id); loadTimesheets(); }}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {shownRequests.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-[#64748B]">{requestFilter === "Pending" ? t("No pending requests.") : t("No requests yet.")}</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Job Costing */}
        <Card className="border-[#E2E8F0] shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-[#0F172A]">{t("Job Costing")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="text-left py-2 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Tech")}</th>
                    <th className="text-left py-2 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Job")}</th>
                    <th className="text-right py-2 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Hours")}</th>
                    <th className="text-right py-2 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Labor Cost")}</th>
                  </tr>
                </thead>
                <tbody>
                  {jobCosting.map((jc) => (
                    <tr key={jc.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="py-2 px-4 font-medium text-[#0F172A]">{jc.profiles?.name ?? "—"}</td>
                      <td className="py-2 px-4 text-sm text-[#64748B] truncate max-w-[200px]">{jc.job_label}</td>
                      <td className="text-right py-2 px-4 text-[#0F172A]">{jc.hours}</td>
                      <td className="text-right py-2 px-4 font-semibold text-[#0F172A]">${jc.labor_cost}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Payroll Export */}
        <Card className="border-[#E2E8F0] shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-[#0F172A]">{t("Payroll Export")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <p className="text-sm text-[#64748B]">{t("No double entry, no manual reconciliation.")}</p>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="h-11 border-[#E2E8F0] text-[#0F172A] gap-2">
                <Users className="w-4 h-4 text-[#0891B2]" /> {t("Export to Gusto")}
              </Button>
              <Button variant="outline" className="h-11 border-[#E2E8F0] text-[#0F172A] gap-2">
                <Briefcase className="w-4 h-4 text-[#0891B2]" /> {t("Export to ADP")}
              </Button>
            </div>
            <div className="p-4 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-[#64748B] uppercase">{t("Total Hours")}</p>
                  <p className="text-xl font-bold text-[#0F172A]">{totalHours.toFixed(1)}</p>
                </div>
                <div>
                  <p className="text-xs text-[#64748B] uppercase">{t("Total OT")}</p>
                  <p className="text-xl font-bold text-[#F59E0B]">{totalOT.toFixed(1)}</p>
                </div>
                <div>
                  <p className="text-xs text-[#64748B] uppercase">{t("Employees")}</p>
                  <p className="text-xl font-bold text-[#0F172A]">{employeeCount}</p>
                </div>
                <div>
                  <p className="text-xs text-[#64748B] uppercase">{t("Est. Payroll")}</p>
                  <p className="text-xl font-bold text-[#16A34A]">${estPayroll.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      </>
      )}

      {/* One employee's week: every clock entry, editable */}
      <Dialog open={detailRow !== null} onOpenChange={(o) => { if (!o) setDetailFor(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{detailRow?.name} — {weekLabel}</DialogTitle></DialogHeader>
          {detailRow && (
            <div className="space-y-3">
              {detailRow.ts && detailRow.days.some((_, i) => Number(detailRow.ts?.[DAY_KEYS[weekDates[i].getDay()]] ?? 0) > 0) && (
                <p className="text-xs text-[#64748B]">{t("Includes hours entered on the old weekly sheet (before clock entries).")}</p>
              )}
              <div className="border border-[#E2E8F0] rounded-lg divide-y divide-[#F1F5F9]">
                {detailRow.entries.map((e) => (
                  <div key={e.id} className="flex items-start gap-3 px-3 py-2 text-sm">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[#0F172A]">
                        {new Date(e.clock_in).toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric" })} · {fmtTime(e.clock_in, locale)} – {e.clock_out ? fmtTime(e.clock_out, locale) : <span className="text-[#16A34A]">{t("still clocked in")}</span>}
                        <span className="ml-2 text-[#0891B2]">{round2(entryHours(e, now))} h</span>
                        {e.edited_by && <span className="ml-2 text-[10px] text-[#94A3B8]">({t("edited")})</span>}
                      </p>
                      {e.notes && <p className="text-xs text-[#64748B] whitespace-pre-wrap">{e.notes}</p>}
                    </div>
                    {(isOffice || e.employee_id === profileId) && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button className="p-1.5 rounded text-[#64748B] hover:text-[#0891B2]" title={t("Edit")} onClick={() => openEditEntry(e)}><Pencil className="w-3.5 h-3.5" /></button>
                        <button className="p-1.5 rounded text-[#DC2626] hover:bg-[#DC2626]/10" title={t("Delete")} onClick={() => deleteEntry(e)}><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    )}
                  </div>
                ))}
                {detailRow.entries.length === 0 && <p className="text-sm text-[#64748B] text-center py-4">{t("No clock entries this week.")}</p>}
              </div>
              <div className="flex justify-between gap-2">
                {(isOffice || detailRow.id === profileId) && (
                  <Button variant="outline" className="gap-1.5 border-[#E2E8F0]" onClick={() => openNewEntry(detailRow.id)}><Plus className="w-4 h-4" /> {t("Add time")}</Button>
                )}
                <Button variant="outline" onClick={() => setDetailFor(null)}>{t("Close")}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add / edit one entry */}
      <Dialog open={draft !== null} onOpenChange={(o) => { if (!o) setDraft(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{draft?.id ? t("Edit Time") : t("Add Time")}</DialogTitle></DialogHeader>
          {draft && (
            <div className="space-y-3">
              {isOffice && !draft.id && (
                <div>
                  <Label>{t("Employee")}</Label>
                  <Select value={draft.employeeId} onValueChange={(v) => setDraft({ ...draft, employeeId: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{staff.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label>{t("Clock in")}</Label><Input type="datetime-local" className="mt-1" value={draft.clockIn} onChange={(e) => setDraft({ ...draft, clockIn: e.target.value })} /></div>
                <div>
                  <Label>{t("Clock out")}</Label>
                  <Input type="datetime-local" className="mt-1" value={draft.clockOut} onChange={(e) => setDraft({ ...draft, clockOut: e.target.value })} />
                  {draft.clockOut && <button className="text-[10px] text-[#64748B] hover:underline mt-0.5 inline-flex items-center gap-0.5" onClick={() => setDraft({ ...draft, clockOut: "" })}><X className="w-2.5 h-2.5" /> {t("still clocked in")}</button>}
                </div>
              </div>
              <div><Label>{t("Notes")}</Label><Textarea className="mt-1 min-h-[70px]" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></div>
              {draftError && <p className="text-sm text-[#DC2626]">{t(draftError)}</p>}
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setDraft(null)}>{t("Cancel")}</Button>
                <Button className="bg-[#0891B2] hover:bg-[#0E7490] text-white gap-1.5" disabled={saving} onClick={saveDraft}><Check className="w-4 h-4" /> {saving ? t("Saving...") : t("Save")}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approve / deny a request, with an optional reply */}
      <Dialog open={decision !== null} onOpenChange={(o) => { if (!o) setDecision(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{decision?.status === "Approved" ? t("Approve request") : t("Deny request")}</DialogTitle></DialogHeader>
          {decision && (
            <div className="space-y-3">
              <p className="text-sm text-[#0F172A]">
                <b>{decision.request.employee_name}</b> · {t(decision.request.request_type)} · {decision.request.start_date}{decision.request.end_date && decision.request.end_date !== decision.request.start_date ? ` → ${decision.request.end_date}` : ""}
              </p>
              {decision.request.notes && <p className="text-sm text-[#64748B] whitespace-pre-wrap">{decision.request.notes}</p>}
              <div><Label>{t("Reply (optional)")}</Label><Textarea className="mt-1 min-h-[60px]" value={decision.note} onChange={(e) => setDecision({ ...decision, note: e.target.value })} /></div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setDecision(null)}>{t("Cancel")}</Button>
                <Button
                  className={decision.status === "Approved" ? "bg-[#16A34A] hover:bg-[#15803D] text-white" : "bg-[#DC2626] hover:bg-[#B91C1C] text-white"}
                  disabled={saving}
                  onClick={decide}
                >
                  {decision.status === "Approved" ? t("Approve") : t("Deny")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <TimeRequestDialog
        open={requestDialog}
        onClose={() => setRequestDialog(false)}
        onSaved={loadTimesheets}
        employees={isOffice ? staff.filter((p) => p.id !== profileId).map((p) => ({ id: p.id, name: p.name })) : undefined}
      />
    </div>
  );
}
