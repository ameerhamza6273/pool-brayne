import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Search, X, CheckCircle2, Repeat, ListOrdered, FileText, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/lib/language-context";
import { techDotColor, unassignedColor } from "@/lib/tech-colors";
import { projectOccurrences } from "@/lib/recurring";
import type { RecurringJob } from "@/lib/api/recurringJobs";
import RouteOrderDialog, { type RouteOrderItem, type RouteOrderSummary } from "@/components/RouteOrderDialog";

// Client SMS 2026-09-21 (screenshots of their previous system's Schedule): month/week/day views,
// hour-by-hour week grid, an employee panel to show/hide individual people, and quick-filter
// chips along the bottom. The old Schedule tab was a month grid with only a color legend.

export interface ScheduleJob {
  id: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  tech_id: string | null;
  stage: string;
  type: string;
  description: string | null;
  amount: number;
  address: string | null;
  customers: { name: string; address?: string | null } | null;
  recurring_job_id?: string | null;
  // Projected occurrence of a recurring job that hasn't been created yet (shown dashed, read-only).
  virtual?: boolean;
  recurringId?: string;
  // Client video 2026-09-25: tasks and open estimates can be shown on the schedule too (read-only chips,
  // click = quick view). `refId` is the task / estimate id.
  kind?: "task" | "estimate";
  refId?: string;
}

export interface ScheduleTech {
  id: string;
  name: string;
  phone: string | null;
  employment_type: string;
}

type View = "month" | "week" | "day";
type Group = "team" | "tech" | "contractors";

const START_HOUR = 6;
const END_HOUR = 20;
const HOUR_PX = 48;
// Jobs have a start time but no duration yet, so every block is drawn one hour tall.
const DEFAULT_DURATION_MIN = 60;

// Client SMS 2026-09-21: "it's very busy" -- month cells show this many jobs, then "+N more" (opens that day).
const MONTH_CHIP_CAP = 5;

// Client video 2026-09-25: "make that a drag ... so I can expand it and view it as a whole instead of
// scrolling through each one" -- the employee list, the "Other" (no start time) row and the hourly grid
// each get a drag handle on their bottom edge. Sizes are remembered per browser; defaults = the old fixed sizes.
type SizeKey = "panel" | "other" | "grid";
const DEFAULT_SIZES: Record<SizeKey, number> = { panel: 720, other: 150, grid: 560 };
const ESTIMATE_COLOR = "#6366F1";

const STAGE_CHIPS = [
  { id: "lead", label: "Lead" },
  { id: "booked", label: "Booked" },
  { id: "dispatched", label: "Dispatched" },
  { id: "in_progress", label: "In Progress" },
  { id: "completed", label: "Completed" },
];

const pad = (n: number) => String(n).padStart(2, "0");
const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = (k: string) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const startOfWeek = (d: Date) => addDays(d, -d.getDay());
const timeToMin = (t: string | null): number | null => {
  if (!t) return null;
  const [h, m] = t.split(":");
  const hh = Number(h);
  return Number.isNaN(hh) ? null : hh * 60 + Number(m || 0);
};
const fmtTime = (min: number) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h % 12 || 12}${m ? `:${pad(m)}` : ""} ${h >= 12 ? "PM" : "AM"}`;
};
const initials = (name: string) => name.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

interface GridCol { key: string; dateKey: string; date: Date; techId: string | null | undefined; name: string }

interface Placed { job: ScheduleJob; start: number; end: number; lane: number; lanes: number }

// Side-by-side lanes for jobs that overlap in time (greedy, per overlapping cluster).
function layoutDay(jobs: ScheduleJob[]): Placed[] {
  const items: Placed[] = jobs
    .map((job) => {
      const start = timeToMin(job.scheduled_time) ?? START_HOUR * 60;
      return { job, start, end: start + DEFAULT_DURATION_MIN, lane: 0, lanes: 1 };
    })
    .sort((a, b) => a.start - b.start);
  let cluster: Placed[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const laneEnds: number[] = [];
    for (const it of cluster) {
      let lane = laneEnds.findIndex((e) => e <= it.start);
      if (lane === -1) { lane = laneEnds.length; laneEnds.push(it.end); } else laneEnds[lane] = it.end;
      it.lane = lane;
    }
    for (const it of cluster) it.lanes = laneEnds.length;
    cluster = [];
  };
  for (const it of items) {
    if (cluster.length && it.start >= clusterEnd) { flush(); clusterEnd = -1; }
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.end);
  }
  flush();
  return items;
}

export default function ScheduleCalendar({
  jobs, technicians, onOpenJob, onReschedule, onNewJob, onUnschedule,
  allJobs, recurring, typeColors, dateFrom, dateTo, onOpenRecurring, onColorChange, onRouteOrder,
  extras = [], onOpenExtra,
}: {
  // Tasks + open estimates (client video 2026-09-25), already narrowed by the page's top filters.
  extras?: ScheduleJob[];
  onOpenExtra?: (kind: "task" | "estimate", id: string) => void;
  jobs: ScheduleJob[];
  technicians: ScheduleTech[];
  // Every real job (unfiltered) -- used to find where each recurring series currently ends.
  allJobs: ScheduleJob[];
  recurring: RecurringJob[];
  typeColors: Record<string, string>;
  dateFrom: string;
  dateTo: string;
  onOpenRecurring: (recurringId: string) => void;
  onColorChange: (techId: string, color: string) => void;
  onRouteOrder: (items: RouteOrderItem[]) => Promise<RouteOrderSummary>;
  onOpenJob: (jobId: string) => void;
  // techId: undefined = leave the tech alone; null = unassign; string = reassign (day view's employee columns)
  onReschedule: (jobId: string, dateKey: string, time?: string, techId?: string | null) => void;
  onNewJob: (dateKey: string, time?: string, techId?: string | null) => void;
  onUnschedule: (jobId: string) => void;
}) {
  const { t, lang } = useLanguage();
  // Dates follow the chosen language (they used to always print in English).
  const locale = lang === "es" ? "es-US" : "en-US";
  // Remembered per browser so the schedule opens the way it was left (the client opens it every day).
  const prefs = useMemo<{ view?: View; hidden?: string[]; showUnassigned?: boolean; showCompleted?: boolean; showTasks?: boolean; showEstimates?: boolean; busyOnly?: boolean }>(() => {
    try { return JSON.parse(localStorage.getItem("schedule-prefs") ?? "{}"); } catch { return {}; }
  }, []);
  const [view, setView] = useState<View>(prefs.view ?? "week");
  const [anchor, setAnchor] = useState(() => new Date());
  const [hiddenTechIds, setHiddenTechIds] = useState<Set<string>>(new Set(prefs.hidden ?? []));
  const [showUnassigned, setShowUnassigned] = useState(prefs.showUnassigned ?? true);
  const [showCompleted, setShowCompleted] = useState(prefs.showCompleted ?? true);
  // Client video 2026-09-25: 3rd filter box "Tasks" (off by default = the schedule looks as before), and
  // open estimates sit under "Unassigned" (they have no tech) so they can be looked at from the schedule.
  const [showTasks, setShowTasks] = useState(prefs.showTasks ?? false);
  const [showEstimates, setShowEstimates] = useState(prefs.showEstimates ?? true);
  // Client SMS 2026-09-25: "techs with jobs" -- only list employees who have something in the period on screen.
  const [busyOnly, setBusyOnly] = useState(prefs.busyOnly ?? false);
  useEffect(() => {
    try { localStorage.setItem("schedule-prefs", JSON.stringify({ view, hidden: [...hiddenTechIds], showUnassigned, showCompleted, showTasks, showEstimates, busyOnly })); } catch { /* storage unavailable */ }
  }, [view, hiddenTechIds, showUnassigned, showCompleted, showTasks, showEstimates, busyOnly]);
  const [sizes, setSizes] = useState<Record<SizeKey, number>>(() => {
    try { return { ...DEFAULT_SIZES, ...JSON.parse(localStorage.getItem("schedule-sizes") ?? "{}") }; } catch { return DEFAULT_SIZES; }
  });
  useEffect(() => {
    try { localStorage.setItem("schedule-sizes", JSON.stringify(sizes)); } catch { /* storage unavailable */ }
  }, [sizes]);
  const startResize = (e: React.PointerEvent, key: SizeKey) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = sizes[key];
    const move = (ev: PointerEvent) => setSizes((prev) => ({ ...prev, [key]: Math.round(Math.min(2400, Math.max(80, startH + ev.clientY - startY))) }));
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const resizeHandle = (key: SizeKey, className = "") => (
    <div
      role="separator"
      aria-orientation="horizontal"
      title={t("Drag to make this section bigger or smaller (double-click to reset)")}
      onPointerDown={(e) => startResize(e, key)}
      onDoubleClick={() => setSizes((prev) => ({ ...prev, [key]: DEFAULT_SIZES[key] }))}
      className={`h-3 cursor-row-resize touch-none select-none items-center justify-center group ${className || "flex"}`}
    >
      <span className="w-12 h-1 rounded-full bg-[#CBD5E1] group-hover:bg-[#0891B2]" />
    </div>
  );
  const [orderCol, setOrderCol] = useState<{ techId: string | null | undefined; dateKey: string; name: string } | null>(null);
  const [quick, setQuick] = useState<string | null>(null);
  const [group, setGroup] = useState<Group>("tech");
  const [peopleSearch, setPeopleSearch] = useState("");
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  // Client SMS 2026-09-21: "look at the calendar by employee color or task color".
  const [colorMode, setColorModeState] = useState<"employee" | "type">(() => {
    try { return localStorage.getItem("schedule-color-mode") === "type" ? "type" : "employee"; } catch { return "employee"; }
  });
  const setColorMode = (m: "employee" | "type") => {
    setColorModeState(m);
    try { localStorage.setItem("schedule-color-mode", m); } catch { /* storage unavailable */ }
  };
  const [draftColors, setDraftColors] = useState<Record<string, string>>({});
  const colorTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const changeColor = (techId: string, value: string) => {
    setDraftColors((prev) => ({ ...prev, [techId]: value }));
    clearTimeout(colorTimers.current[techId]);
    colorTimers.current[techId] = setTimeout(() => {
      onColorChange(techId, value);
      setDraftColors((prev) => { const next = { ...prev }; delete next[techId]; return next; });
    }, 700);
  };

  const todayKey = toKey(new Date());

  // Visible day columns (week/day) or the month's dates.
  const weekDays = useMemo(() => {
    const start = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [anchor]);
  const columns = view === "day" ? [anchor] : weekDays;
  const monthFirst = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const daysInMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();

  const rangeKeys = useMemo(() => {
    if (view === "month") return new Set(Array.from({ length: daysInMonth }, (_, i) => toKey(new Date(anchor.getFullYear(), anchor.getMonth(), i + 1))));
    return new Set(columns.map(toKey));
  }, [view, anchor, daysInMonth, columns]);

  const shift = (dir: 1 | -1) => {
    if (view === "month") setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1));
    else setAnchor(addDays(anchor, (view === "week" ? 7 : 1) * dir));
  };

  const weekTitle = (() => {
    const a = weekDays[0];
    const b = weekDays[6];
    const mon = (d: Date) => d.toLocaleDateString(locale, { month: "short" });
    return a.getMonth() === b.getMonth()
      ? `${mon(a)} ${a.getDate()} – ${b.getDate()}, ${b.getFullYear()}`
      : `${mon(a)} ${a.getDate()} – ${mon(b)} ${b.getDate()}, ${b.getFullYear()}`;
  })();
  const title = view === "month"
    ? anchor.toLocaleDateString(locale, { month: "long", year: "numeric" })
    : view === "day"
      ? anchor.toLocaleDateString(locale, { weekday: "long", month: "short", day: "numeric", year: "numeric" })
      : weekTitle;

  // Employee panel scope (TEAM = everyone, TECH = employees, CONTRACTORS).
  const people = technicians.filter((p) => {
    if (group === "tech" && p.employment_type === "Contractor") return false;
    if (group === "contractors" && p.employment_type !== "Contractor") return false;
    return !peopleSearch.trim() || `${p.name} ${p.phone ?? ""}`.toLowerCase().includes(peopleSearch.trim().toLowerCase());
  });
  const allShown = hiddenTechIds.size === 0 && showUnassigned;
  const toggleTech = (id: string) => setHiddenTechIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  // One click to look at a single employee.
  const onlyTech = (id: string) => {
    setHiddenTechIds(new Set(technicians.filter((p) => p.id !== id).map((p) => p.id)));
    setShowUnassigned(false);
  };
  const toggleAll = () => {
    if (allShown) { setHiddenTechIds(new Set(technicians.map((p) => p.id))); setShowUnassigned(false); }
    else { setHiddenTechIds(new Set()); setShowUnassigned(true); }
  };

  // Client SMS 2026-09-21: "we created recurring jobs and they only appear on the first date ... it needs to
  // repeat on the calendar view". The server only creates the next real job once the current one is completed,
  // so the dates after the latest real occurrence are projected here (dashed, read-only, click = open the series).
  const rangeEnd = Array.from(rangeKeys).sort().pop() as string;
  const ghosts: ScheduleJob[] = recurring.filter((rj) => rj.active).flatMap((rj) => {
    const anchorDate = allJobs.reduce((m, j) => (j.recurring_job_id === rj.id && j.scheduled_date && j.scheduled_date > m ? j.scheduled_date : m), rj.start_date);
    return projectOccurrences(rj, anchorDate, rangeEnd)
      .filter((d) => rangeKeys.has(d) && (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo))
      .map((d): ScheduleJob => ({
        id: `rec:${rj.id}:${d}`, scheduled_date: d, scheduled_time: rj.start_time, tech_id: rj.tech_id, stage: rj.tech_id ? "booked" : "lead",
        type: rj.job_type, description: rj.description, amount: rj.amount, address: rj.address,
        customers: { name: rj.customers?.name ?? "" }, virtual: true, recurringId: rj.id,
      }));
  });
  const shownExtras = extras.filter((x) => x.scheduled_date && (x.kind === "task" ? showTasks : showEstimates));
  const scheduled = [...jobs.filter((j) => j.scheduled_date), ...ghosts, ...shownExtras];
  // Everything except the quick-filter chip (chip counts are computed from this).
  const shownBase = scheduled.filter((j) => {
    if (j.tech_id ? hiddenTechIds.has(j.tech_id) : !showUnassigned) return false;
    if (!showCompleted && j.stage === "completed" && quick !== "completed") return false;
    return true;
  });
  const inRange = shownBase.filter((j) => rangeKeys.has(j.scheduled_date as string));
  const visible = inRange.filter((j) => {
    if (!quick) return true;
    if (quick === "unassigned") return !j.tech_id;
    if (quick === "task" || quick === "estimate") return j.kind === quick;
    return !j.kind && j.stage === quick;
  });
  const countByTech = new Map<string, number>();
  for (const j of scheduled) {
    if (j.kind || !j.tech_id || !rangeKeys.has(j.scheduled_date as string)) continue;
    if (!showCompleted && j.stage === "completed") continue;
    countByTech.set(j.tech_id, (countByTech.get(j.tech_id) ?? 0) + 1);
  }
  const listed = busyOnly ? people.filter((p) => (countByTech.get(p.id) ?? 0) > 0) : people;
  const jobsOn = (key: string) => visible.filter((j) => j.scheduled_date === key);

  const slotTime = (e: React.MouseEvent | React.DragEvent, el: HTMLElement, snap: "round" | "floor") => {
    const y = e.clientY - el.getBoundingClientRect().top;
    const raw = START_HOUR * 60 + (y / HOUR_PX) * 60;
    const snapped = (snap === "round" ? Math.round(raw / 30) : Math.floor(raw / 30)) * 30;
    const clamped = Math.min(Math.max(snapped, START_HOUR * 60), END_HOUR * 60 - 30);
    return `${pad(Math.floor(clamped / 60))}:${pad(clamped % 60)}`;
  };

  const handleDrop = (e: React.DragEvent, key: string, time?: string, techId?: string | null) => {
    e.preventDefault();
    const jobId = e.dataTransfer.getData("text/job-id");
    if (jobId) onReschedule(jobId, key, time, techId);
    setDragOverKey(null);
  };

  const tipOf = (j: ScheduleJob) => {
    const min = timeToMin(j.scheduled_time);
    const who = j.tech_id ? technicians.find((p) => p.id === j.tech_id)?.name : null;
    const where = j.address ?? j.customers?.address ?? null;
    return [
      j.customers?.name ?? t("Unassigned"),
      `${j.kind ? j.type : t(j.type)}${min !== null ? ` · ${fmtTime(min)}` : ""}`,
      who ? `${t("Who")}: ${who}` : null,
      where ? `${t("Where")}: ${where}` : null,
      j.description ? `${t("Description")}: ${j.description}` : null,
    ].filter(Boolean).join("\n");
  };

  const colorFor = (j: ScheduleJob) =>
    j.kind === "estimate" ? ESTIMATE_COLOR : colorMode === "type" ? (typeColors[j.type] ?? unassignedColor) : (j.tech_id ? techDotColor(j.tech_id) : unassignedColor);

  const jobChip = (j: ScheduleJob, extra?: React.CSSProperties, showTime = true) => {
    const min = timeToMin(j.scheduled_time);
    const chipColor = colorFor(j);
    const label = `${showTime && min !== null ? `${fmtTime(min)} ` : ""}${j.customers?.name || t("Unassigned")}`;
    const fixed = j.virtual || !!j.kind;
    return (
      <div
        key={j.id}
        draggable={!fixed}
        onDragStart={(e) => { if (fixed) { e.preventDefault(); return; } e.stopPropagation(); e.dataTransfer.setData("text/job-id", j.id); e.dataTransfer.effectAllowed = "move"; }}
        onClick={(e) => { e.stopPropagation(); if (j.kind && j.refId) onOpenExtra?.(j.kind, j.refId); else if (j.virtual && j.recurringId) onOpenRecurring(j.recurringId); else onOpenJob(j.id); }}
        title={j.virtual ? `${tipOf(j)}\n${t("Recurring — not created yet. Click to open the series.")}` : j.kind ? `${tipOf(j)}\n${t("Click for a quick view.")}` : tipOf(j)}
        className={`group text-[10px] leading-tight px-1.5 py-0.5 rounded overflow-hidden ${j.virtual ? "border border-dashed cursor-pointer opacity-80" : j.kind ? "border border-dotted cursor-pointer" : "border-l-2 cursor-grab active:cursor-grabbing"}`}
        style={{ backgroundColor: `${chipColor}1A`, color: chipColor, borderColor: chipColor, ...extra }}
      >
        <div className="flex items-center justify-between gap-1">
          <span className="truncate font-medium">
            {j.virtual && <Repeat className="w-2.5 h-2.5 inline mr-0.5 -mt-px" />}
            {j.kind === "estimate" && <FileText className="w-2.5 h-2.5 inline mr-0.5 -mt-px" />}
            {j.kind === "task" && <ClipboardList className="w-2.5 h-2.5 inline mr-0.5 -mt-px" />}
            {label}
          </span>
          {j.kind ? null : j.virtual ? null : j.stage === "completed" ? <CheckCircle2 className="w-3 h-3 shrink-0 text-[#16A34A]" /> : (
            <button className="opacity-0 group-hover:opacity-100 shrink-0" title={t("Remove from schedule")} onClick={(e) => { e.stopPropagation(); onUnschedule(j.id); }}>
              <X className="w-2.5 h-2.5" />
            </button>
          )}
        </div>
        <div className="truncate opacity-80">{j.kind ? j.type : t(j.type)}</div>
      </div>
    );
  };

  // Client video 2026-09-21 (their Day view): one column per employee with that person's job count and
  // day total in the header. Week view stays one column per date.
  const money = (n: number) => "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dayKey = toKey(anchor);
  const gridCols: GridCol[] = view === "day"
    ? [
        ...listed.filter((p) => !hiddenTechIds.has(p.id)).map((p) => ({ key: `${dayKey}:${p.id}`, dateKey: dayKey, date: anchor, techId: p.id as string | null, name: p.name })),
        ...(showUnassigned ? [{ key: `${dayKey}:none`, dateKey: dayKey, date: anchor, techId: null as string | null, name: t("Unassigned") }] : []),
      ]
    : columns.map((d) => ({ key: toKey(d), dateKey: toKey(d), date: d, techId: undefined, name: "" }));
  const jobsInCol = (c: GridCol) =>
    jobsOn(c.dateKey).filter((j) => c.techId === undefined || (c.techId === null ? !j.tech_id : j.tech_id === c.techId));

  const orderRows = orderCol
    ? jobsInCol({ key: "", dateKey: orderCol.dateKey, date: fromKey(orderCol.dateKey), techId: orderCol.techId, name: orderCol.name }).filter((j) => !j.kind).map((j) => ({
        key: j.id,
        jobId: j.virtual ? null : j.id,
        recurringId: j.virtual ? (j.recurringId ?? null) : (j.recurring_job_id ?? null),
        label: j.customers?.name ?? "—",
        sub: j.type,
        time: j.scheduled_time,
        repeats: !!(j.virtual || j.recurring_job_id),
      }))
    : [];

  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
  const gridHeight = (END_HOUR - START_HOUR) * HOUR_PX;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[290px_minmax(0,1fr)] gap-4 items-start">
      {/* Employee panel */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-3 space-y-3 lg:max-h-[var(--panel-h)] flex flex-col" style={{ "--panel-h": `${sizes.panel}px` } as React.CSSProperties}>
        <div className="relative shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
          <Input value={peopleSearch} onChange={(e) => setPeopleSearch(e.target.value)} placeholder={t("Search Professional")} className="pl-8 h-9 text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-xs text-[#0F172A] shrink-0">
          <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={allShown} onChange={toggleAll} /> {t("Select All")}</label>
          <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={showCompleted} onChange={(e) => setShowCompleted(e.target.checked)} /> {t("Show Completed Jobs")}</label>
          <label className="flex items-center gap-1.5 cursor-pointer" title={t("Show tasks (Estimates › Tasks) on their dates")}><input type="checkbox" checked={showTasks} onChange={(e) => setShowTasks(e.target.checked)} /> {t("Tasks")}</label>
          <label className="flex items-center gap-1.5 cursor-pointer" title={t("Show open estimates under Unassigned on their date")}><input type="checkbox" checked={showEstimates} onChange={(e) => setShowEstimates(e.target.checked)} /> {t("Estimates")}</label>
          <label className="flex items-center gap-1.5 cursor-pointer col-span-2" title={t("Only list employees who have a job in the dates on screen")}><input type="checkbox" checked={busyOnly} onChange={(e) => setBusyOnly(e.target.checked)} /> {t("Techs with jobs")}</label>
        </div>
        <div className="grid grid-cols-3 border border-[#E2E8F0] rounded-md overflow-hidden text-[10px] font-semibold shrink-0">
          {([["team", "TEAM"], ["tech", "TECH"], ["contractors", "CONTRACTORS"]] as [Group, string][]).map(([g, label]) => (
            <button key={g} onClick={() => setGroup(g)} className={`py-1.5 ${group === g ? "bg-[#0891B2] text-white" : "bg-white text-[#0F172A] hover:bg-[#F8FAFC]"}`}>{t(label)}</button>
          ))}
        </div>
        <div className="overflow-y-auto -mx-1 px-1 space-y-1 min-h-0 max-h-[420px] lg:max-h-none">
          {listed.map((p) => {
            const on = !hiddenTechIds.has(p.id);
            const color = draftColors[p.id] ?? techDotColor(p.id);
            return (
              <div key={p.id} className="flex items-center gap-1.5">
              <button onClick={() => toggleTech(p.id)} className={`flex-1 min-w-0 flex items-center gap-2.5 p-2 rounded-lg text-left border ${on ? "bg-white border-[#E2E8F0]" : "bg-[#F8FAFC] border-transparent opacity-60"} hover:border-[#0891B2]/40`}>
                <span className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: color }}>{initials(p.name)}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold truncate" style={{ color }}>{p.name}</span>
                  {p.phone && <span className="block text-[11px] text-[#64748B] truncate">{p.phone}</span>}
                </span>
                {(countByTech.get(p.id) ?? 0) > 0 && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#F1F5F9] text-[#64748B] shrink-0" title={t("Jobs in this view")}>{countByTech.get(p.id)}</span>
                )}
                <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${on ? "border-[#16A34A] bg-[#16A34A]" : "border-[#CBD5E1]"}`}>
                  {on && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                </span>
              </button>
              <input
                type="color"
                value={color}
                onChange={(e) => changeColor(p.id, e.target.value)}
                title={t("Change this employee's color")}
                className="w-6 h-6 shrink-0 rounded cursor-pointer border border-[#E2E8F0] p-0 bg-white"
              />
              <button className="text-[10px] font-semibold text-[#0891B2] hover:underline shrink-0" title={t("Show only this employee")} onClick={() => onlyTech(p.id)}>{t("only")}</button>
              </div>
            );
          })}
          {listed.length === 0 && <p className="text-xs text-[#64748B] py-3 text-center">{t("No one matches.")}</p>}
          <button onClick={() => setShowUnassigned((v) => !v)} className={`w-full flex items-center gap-2.5 p-2 rounded-lg text-left border ${showUnassigned ? "bg-white border-[#E2E8F0]" : "bg-[#F8FAFC] border-transparent opacity-60"}`}>
            <span className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: unassignedColor }}>?</span>
            <span className="flex-1 text-sm font-semibold text-[#64748B]">{t("Unassigned")}</span>
            <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${showUnassigned ? "border-[#16A34A] bg-[#16A34A]" : "border-[#CBD5E1]"}`}>
              {showUnassigned && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
            </span>
          </button>
        </div>
        {resizeHandle("panel", "hidden lg:flex shrink-0 -mb-1")}
      </div>

      {/* Calendar */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-4 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="icon" className="h-8 w-8 border-[#E2E8F0]" onClick={() => shift(-1)}><ChevronLeft className="w-4 h-4" /></Button>
            <Button variant="outline" size="icon" className="h-8 w-8 border-[#E2E8F0]" onClick={() => shift(1)}><ChevronRight className="w-4 h-4" /></Button>
            <Button variant="outline" className="h-8 px-3 text-xs border-[#E2E8F0]" onClick={() => setAnchor(new Date())}>{t("today")}</Button>
          </div>
          <h3 className="font-semibold text-lg text-[#0891B2]">{title}</h3>
          <div className="flex border border-[#E2E8F0] rounded-md overflow-hidden text-xs font-medium">
            {(["month", "week", "day"] as View[]).map((v) => (
              <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 ${view === v ? "bg-[#0891B2] text-white" : "bg-white text-[#64748B] hover:bg-[#F8FAFC]"}`}>{t(v)}</button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-2 text-xs text-[#64748B]">
          <span>{t("Color by")}:</span>
          {(["employee", "type"] as const).map((m) => (
            <button key={m} onClick={() => setColorMode(m)} className={`px-2.5 py-1 rounded-md border font-medium ${colorMode === m ? "bg-[#0891B2] text-white border-[#0891B2]" : "bg-white text-[#0F172A] border-[#E2E8F0] hover:bg-[#F8FAFC]"}`}>
              {m === "employee" ? t("Employee") : t("Job type")}
            </button>
          ))}
          {colorMode === "type" && Array.from(new Set(visible.filter((j) => !j.kind).map((j) => j.type))).slice(0, 8).map((ty) => (
            <span key={ty} className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: typeColors[ty] ?? unassignedColor }} />{t(ty)}</span>
          ))}
        </div>
        <p className="text-xs text-[#94A3B8] mb-3">
          {view === "month"
            ? t("Click an empty day to schedule a job. Drag a job onto another day to reschedule it.")
            : view === "day"
              ? t("One column per employee. Click an empty slot to schedule a job for them, or drag a job into another column to reassign it.")
              : t("Click an empty time slot to schedule a job. Drag a job to another day or time to reschedule it.")}
        </p>

        {view === "month" ? (
          <>
            <div className="grid grid-cols-7 gap-2 text-center text-xs text-[#64748B] mb-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="font-semibold py-2">{t(d)}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: monthFirst.getDay() }, (_, i) => <div key={`pad-${i}`} />)}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const key = toKey(new Date(anchor.getFullYear(), anchor.getMonth(), i + 1));
                const isToday = key === todayKey;
                return (
                  <div
                    key={key}
                    onDragOver={(e) => { e.preventDefault(); setDragOverKey(key); }}
                    onDragLeave={() => setDragOverKey((cur) => (cur === key ? null : cur))}
                    onDrop={(e) => handleDrop(e, key)}
                    onClick={() => onNewJob(key)}
                    className={`min-h-[80px] rounded-lg border p-1.5 cursor-pointer transition-colors ${
                      dragOverKey === key ? "bg-[#0891B2]/10 border-[#0891B2] border-dashed" : isToday ? "bg-[#0891B2]/5 border-[#0891B2]" : "bg-white border-[#E2E8F0] hover:bg-[#F8FAFC]"
                    }`}
                  >
                    <span className={`text-xs font-medium ${isToday ? "text-[#0891B2]" : "text-[#0F172A]"}`}>{i + 1}</span>
                    <div className="space-y-1 mt-1">
                      {(() => {
                        const list = [...jobsOn(key)].sort((a, b) => (a.scheduled_time ?? "99").localeCompare(b.scheduled_time ?? "99") || (a.customers?.name ?? "").localeCompare(b.customers?.name ?? ""));
                        return (
                          <>
                            {list.slice(0, MONTH_CHIP_CAP).map((j) => jobChip(j))}
                            {list.length > MONTH_CHIP_CAP && (
                              <button className="text-[10px] font-semibold text-[#0891B2] hover:underline" onClick={(e) => { e.stopPropagation(); setAnchor(fromKey(key)); setView("day"); }}>
                                +{list.length - MONTH_CHIP_CAP} {t("more")}
                              </button>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="overflow-x-auto">
            {gridCols.length === 0 ? (
              <p className="py-10 text-center text-sm text-[#64748B]">{t("No employees selected — tick someone in the panel.")}</p>
            ) : (
            <div style={{ minWidth: view === "day" ? 52 + gridCols.length * 150 : 720 }}>
              {/* Column headers */}
              <div className="grid border-b border-[#E2E8F0]" style={{ gridTemplateColumns: `52px repeat(${gridCols.length}, minmax(0, 1fr))` }}>
                <div />
                {gridCols.map((c) => {
                  const colJobs = jobsInCol(c).filter((j) => !j.kind);
                  if (view === "day") {
                    const total = colJobs.reduce((sum, j) => sum + Number(j.amount ?? 0), 0);
                    return (
                      <div key={c.key} className="px-2 py-1.5 text-white text-xs font-semibold border-l border-white/40 flex items-start justify-between gap-1" style={{ background: c.techId ? techDotColor(c.techId) : unassignedColor }}>
                        <div className="min-w-0">
                          <div className="truncate">{c.name}</div>
                          <div className="text-[10px] font-normal opacity-90">{colJobs.length} {t("jobs")} · {money(total)}</div>
                        </div>
                        {c.techId && (
                          <button title={t("Route order — set each stop's standard time")} className="shrink-0 p-1 rounded bg-white/20 hover:bg-white/30" onClick={() => setOrderCol({ techId: c.techId, dateKey: c.dateKey, name: c.name })}>
                            <ListOrdered className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  }
                  return (
                    <div key={c.key} className={`text-center text-xs font-semibold py-2 ${c.dateKey === todayKey ? "text-[#0891B2] bg-[#0891B2]/5" : "text-[#0F172A]"}`}>
                      {c.date.toLocaleDateString(locale, { weekday: "short" })} {c.date.getMonth() + 1}/{c.date.getDate()}
                      <div className="text-[10px] font-normal text-[#64748B]">{colJobs.length} {t("jobs")}</div>
                    </div>
                  );
                })}
              </div>
              {/* "Other" row: jobs with no start time */}
              <div className="grid border-b border-[#E2E8F0] bg-[#F8FAFC]/60" style={{ gridTemplateColumns: `52px repeat(${gridCols.length}, minmax(0, 1fr))` }}>
                <div className="text-[10px] font-semibold text-[#64748B] px-1 py-1.5">{t("Other")}</div>
                {gridCols.map((c) => {
                  const untimed = jobsInCol(c).filter((j) => timeToMin(j.scheduled_time) === null);
                  return (
                    <div
                      key={c.key}
                      onDragOver={(e) => { e.preventDefault(); setDragOverKey(`other-${c.key}`); }}
                      onDragLeave={() => setDragOverKey((cur) => (cur === `other-${c.key}` ? null : cur))}
                      onDrop={(e) => handleDrop(e, c.dateKey, undefined, c.techId)}
                      onClick={() => onNewJob(c.dateKey, undefined, c.techId)}
                      className={`border-l border-[#E2E8F0] p-1 min-h-[34px] overflow-y-auto space-y-1 cursor-pointer ${dragOverKey === `other-${c.key}` ? "bg-[#0891B2]/10" : ""}`}
                      style={{ maxHeight: sizes.other }}
                    >
                      {untimed.map((j) => jobChip(j, undefined, false))}
                    </div>
                  );
                })}
              </div>
              {resizeHandle("other", "flex border-b border-[#E2E8F0]")}
              {/* Hourly grid */}
              <div className="overflow-y-auto" style={{ maxHeight: sizes.grid }}>
                <div className="grid" style={{ gridTemplateColumns: `52px repeat(${gridCols.length}, minmax(0, 1fr))` }}>
                  <div>
                    {hours.map((h) => (
                      <div key={h} style={{ height: HOUR_PX }} className="text-[10px] font-semibold text-[#64748B] pr-1 text-right -translate-y-1.5">{fmtTime(h * 60)}</div>
                    ))}
                  </div>
                  {gridCols.map((c) => {
                    const placed = layoutDay(jobsInCol(c).filter((j) => timeToMin(j.scheduled_time) !== null));
                    return (
                      <div
                        key={c.key}
                        className={`relative border-l border-[#E2E8F0] ${c.dateKey === todayKey ? "bg-[#0891B2]/[0.03]" : ""} ${dragOverKey === c.key ? "bg-[#0891B2]/10" : ""}`}
                        style={{ height: gridHeight, backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR_PX - 1}px, #E2E8F0 ${HOUR_PX - 1}px, #E2E8F0 ${HOUR_PX}px)` }}
                        onDragOver={(e) => { e.preventDefault(); setDragOverKey(c.key); }}
                        onDragLeave={() => setDragOverKey((cur) => (cur === c.key ? null : cur))}
                        onDrop={(e) => handleDrop(e, c.dateKey, slotTime(e, e.currentTarget, "round"), c.techId)}
                        onClick={(e) => onNewJob(c.dateKey, slotTime(e, e.currentTarget, "floor"), c.techId)}
                      >
                        {placed.map(({ job, start, lane, lanes }) => {
                          const top = ((Math.min(Math.max(start, START_HOUR * 60), END_HOUR * 60 - 30) - START_HOUR * 60) / 60) * HOUR_PX;
                          return jobChip(job, {
                            position: "absolute",
                            top: top + 1,
                            height: Math.max((DEFAULT_DURATION_MIN / 60) * HOUR_PX - 3, 22),
                            left: `calc(${(lane / lanes) * 100}% + 1px)`,
                            width: `calc(${100 / lanes}% - 2px)`,
                          });
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
              {resizeHandle("grid", "flex border-t border-[#E2E8F0]")}
            </div>
            )}
          </div>
        )}

        {/* Quick filters — counts are for what's on screen */}
        <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-[#E2E8F0]">
          {[
            { id: "unassigned", label: "Unassigned Jobs", count: inRange.filter((j) => !j.tech_id && !j.kind).length },
            ...STAGE_CHIPS.map((s) => ({ id: s.id, label: s.label, count: inRange.filter((j) => !j.kind && j.stage === s.id).length })),
            ...(showEstimates ? [{ id: "estimate", label: "Estimates", count: inRange.filter((j) => j.kind === "estimate").length }] : []),
            ...(showTasks ? [{ id: "task", label: "Tasks", count: inRange.filter((j) => j.kind === "task").length }] : []),
          ].map((c) => (
            <button
              key={c.id}
              onClick={() => setQuick((cur) => (cur === c.id ? null : c.id))}
              className={`px-3 py-1 rounded-md text-xs font-semibold border ${quick === c.id ? "bg-[#0891B2] text-white border-[#0891B2]" : "bg-white text-[#0F172A] border-[#E2E8F0] hover:bg-[#F8FAFC]"}`}
            >
              {t(c.label)} ({c.count})
            </button>
          ))}
          {quick && <button onClick={() => setQuick(null)} className="text-xs text-[#64748B] hover:underline">{t("Clear")}</button>}
        </div>
      </div>
      <RouteOrderDialog
        open={orderCol !== null}
        onClose={() => setOrderCol(null)}
        title={orderCol ? `${orderCol.name} · ${fromKey(orderCol.dateKey).toLocaleDateString(locale, { weekday: "long", month: "short", day: "numeric" })}` : ""}
        rows={orderRows}
        onApply={onRouteOrder}
      />
    </div>
  );
}
