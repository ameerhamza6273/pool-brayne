import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Plus, Calendar, LayoutDashboard, Truck, User, Clock, Search, ChevronLeft, ChevronRight, Map as MapIcon, Navigation,
  Pencil, Trash2, Pause, Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConfigLists } from "@/hooks/use-config-lists";
import type { ConfigListItem } from "@/lib/api/configLists";
import { SearchableSelect } from "@/components/SearchableSelect";
import LineItemsEditor, { type DraftLineItem } from "@/components/LineItemsEditor";
import { inventoryApi, type ItemWithStock } from "@/lib/api/inventory";
import { jobsApi } from "@/lib/api/jobs";
import { profilesApi } from "@/lib/api/profiles";
import { customersApi } from "@/lib/api/customers";
import { recurringJobsApi, type RecurringJob } from "@/lib/api/recurringJobs";
import { formTemplatesApi, type FormTemplate } from "@/lib/api/formTemplates";
import { geocodeAddress, geocodeApproximate } from "@/lib/geocode";
import { fetchRoadRoute } from "@/lib/routing";
import { useLanguage } from "@/lib/language-context";
import { useAuth } from "@/lib/auth-context";
import { customerOption } from "@/lib/customer-options";
import { techDotColor, techStyle, unassignedColor, registerTechColors } from "@/lib/tech-colors";
import { matchesQuery } from "@/lib/search";
import { repeatsOn } from "@/lib/recurring";
import ViewToggle, { useViewMode } from "@/components/ViewToggle";
import ScheduleCalendar, { type ScheduleJob } from "@/components/ScheduleCalendar";
import { invoicingApi, type Estimate, type EstimateLineItem } from "@/lib/api/invoicing";
import { tasksApi, type FreeformTask } from "@/lib/api/tasks";
import type { Database } from "@/lib/database.types";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Customer = Database["public"]["Tables"]["customers"]["Row"];
type Job = Database["public"]["Tables"]["jobs"]["Row"] & {
  customers: { name: string; address: string | null; lat?: number | null; lng?: number | null } | null;
  profiles: { name: string; avatar: string | null } | null;
};

const stages = [
  { id: "lead", label: "Lead", color: "bg-[#F59E0B]/10 border-t-[#F59E0B]" },
  { id: "booked", label: "Booked", color: "bg-[#0891B2]/10 border-t-[#0891B2]" },
  { id: "dispatched", label: "Dispatched", color: "bg-[#8B5CF6]/10 border-t-[#8B5CF6]" },
  { id: "in_progress", label: "In Progress", color: "bg-[#3B82F6]/10 border-t-[#3B82F6]" },
  { id: "completed", label: "Completed", color: "bg-[#16A34A]/10 border-t-[#16A34A]" },
];

const typeStyle = (label: string, jobTypes: ConfigListItem[]): React.CSSProperties => {
  const t = jobTypes.find((j) => j.label === label);
  const color = t?.color || "#0891B2";
  return { backgroundColor: `${color}1A`, color };
};

// Client SMS 2026-09-21: "make the center of the map 2900 Holcomb Bridge Rd, Alpharetta GA 30022" (it was
// starting in Austin, TX). Street-level point on Holcomb Bridge Rd from OpenStreetMap; the view then
// re-fits to the day's pins once they load.
const DEFAULT_MAP_CENTER: [number, number] = [33.988, -84.2754];

// Stop order on the map / route list: timed jobs by time, then untimed ones by customer name.
const orderStops = (list: Job[]) =>
  [...list].sort((a, b) => {
    const at = a.scheduled_time;
    const bt = b.scheduled_time;
    if (at && bt) return at.localeCompare(bt);
    if (at) return -1;
    if (bt) return 1;
    return (a.customers?.name ?? "").localeCompare(b.customers?.name ?? "");
  });

const escapeHtml = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Numbered round pin in the tech's color (client wants numbered stops like their old software).
// Unassigned jobs get a plain gray dot; approximate locations are dashed + slightly faded.
const stopIcon = (label: string, color: string, approx: boolean) =>
  L.divIcon({
    className: "",
    html: `<div style="width:26px;height:26px;border-radius:50%;background:${color};color:#fff;font:700 12px/22px Arial,sans-serif;text-align:center;border:2px ${approx ? "dashed" : "solid"} #fff;box-shadow:0 1px 4px rgba(0,0,0,.45);${approx ? "opacity:.8;" : ""}">${label}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -12],
  });

export default function Jobs() {
  const { t } = useLanguage();
  const { lists: configLists } = useConfigLists();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<"pipeline" | "dispatch" | "schedule" | "map">(
    () => (searchParams.get("tab") as "pipeline" | "dispatch" | "schedule" | "map") || "pipeline",
  );

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "pipeline" || tab === "dispatch" || tab === "schedule" || tab === "map") setActiveTab(tab);
  }, [searchParams]);
  const [search, setSearch] = useState("");
  const [techFilter, setTechFilterState] = useState("all");
  // Client SMS 2026-09-25: Technician defaults to whoever signs in, and the date range to today (with quick
  // Today / Week / Month buttons). These automatic defaults are only used where they make sense -- the
  // Schedule keeps its own employee panel + calendar navigation, the Dispatch board still shows every tech's
  // column, and the Map has its own date -- until someone changes the filter by hand, which then applies everywhere
  // like before. The default "today" range never hides unscheduled jobs (leads have no date yet).
  const { profileId } = useAuth();
  const [techTouched, setTechTouched] = useState(false);
  const [dateTouched, setDateTouched] = useState(false);
  const setTechFilter = (v: string) => { setTechTouched(true); setTechFilterState(v); };
  const [typeFilter, setTypeFilter] = useState("all");
  const [newJobOpen, setNewJobOpen] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [technicians, setTechnicians] = useState<Profile[]>([]);
  // Client video 2026-09-25: tasks + open estimates on the Schedule (loaded the first time the tab opens).
  const [scheduleTasks, setScheduleTasks] = useState<FreeformTask[]>([]);
  const [scheduleEstimates, setScheduleEstimates] = useState<Estimate[]>([]);
  const extrasLoadedRef = useRef(false);
  const [quickView, setQuickView] = useState<{ kind: "task" | "estimate"; id: string } | null>(null);
  const [quickLines, setQuickLines] = useState<EstimateLineItem[] | null>(null);
  // Client PDF 2026-09-05: "+New Recurring" next to "+New Job" -- real recurring-job schedule
  // replacing the old read-only, never-linked-to-real-jobs recurring_routes display.
  const [recurringJobs, setRecurringJobs] = useState<RecurringJob[]>([]);
  const [newRecurringOpen, setNewRecurringOpen] = useState(false);
  const [newRecurring, setNewRecurring] = useState({
    customerId: "", techId: "", jobType: "", description: "", techNotes: "", amount: "",
    frequency: "weekly" as "weekly" | "biweekly" | "monthly", dayOfWeek: "1", dayOfMonth: "1",
    startDate: new Date().toISOString().slice(0, 10), endDate: "",
    nextJobNotes: "", selectedFormIds: [] as string[], startTime: "",
  });
  // Client SMS 2026-09-21: Recurring Jobs list gets a grid (table) view by default + a search field
  // (customer, technician, day of the week, job type); Search row gets a date range.
  const [recSearch, setRecSearch] = useState("");
  const [recView, setRecView] = useViewMode("recurring-jobs");
  const localKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const [dateFrom, setDateFromState] = useState(() => localKey(new Date()));
  const [dateTo, setDateToState] = useState(() => localKey(new Date()));
  const setDateFrom = (v: string) => { setDateTouched(true); setDateFromState(v); };
  const setDateTo = (v: string) => { setDateTouched(true); setDateToState(v); };
  const setQuickRange = (range: "today" | "week" | "month") => {
    const now = new Date();
    const from = range === "today" ? now : range === "week" ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()) : new Date(now.getFullYear(), now.getMonth(), 1);
    const to = range === "today" ? now : range === "week" ? new Date(from.getFullYear(), from.getMonth(), from.getDate() + 6) : new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setDateFrom(localKey(from));
    setDateTo(localKey(to));
  };
  const [oneTimeTarget, setOneTimeTarget] = useState<RecurringJob | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [newJob, setNewJob] = useState({ customerId: "", jobType: "", date: "", time: "", techId: "", description: "", amount: "", selectedFormIds: [] as string[] });
  // Client PDF 2026-09-18: "allow us to select the forms needed for the job. Not automatically
  // [applied] to each job" -- staff pick per-job now instead of the set being purely derived from
  // job type; templates whose Applies-To/Required setting (Form Builder) matches are pre-checked
  // as a starting point, but every checkbox is togglable.
  const [formTemplates, setFormTemplates] = useState<FormTemplate[]>([]);
  // Client bug report 2026-09-04: "dynamic search or autofill for SKUs... ability to add
  // multiple line items" — New Job's old Item SKU/Labor SKU text fields weren't wired to
  // inventory at all. Same LineItemsEditor + inventory search as Estimates/Invoices now.
  const [newJobLineItems, setNewJobLineItems] = useState<DraftLineItem[]>([]);
  const [inventoryItems, setInventoryItems] = useState<ItemWithStock[]>([]);
  const [mapDate, setMapDate] = useState(() => new Date().toISOString().slice(0, 10));
  // Map: coordinates resolved per job (filled in progressively as addresses are looked up).
  type StopCoord = { lat: number; lng: number; approx: boolean };
  const [stopCoords, setStopCoords] = useState<Record<string, StopCoord>>({});
  const stopCoordsRef = useRef<Record<string, StopCoord>>({});
  const [mapProgress, setMapProgress] = useState<{ done: number; total: number } | null>(null);
  const drawTokenRef = useRef(0);
  const fitStateRef = useRef({ key: "", started: false, done: false });
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const navigate = useNavigate();

  const loadJobs = useCallback(async () => {
    const data = await jobsApi.list();
    setJobs(data ?? []);
  }, []);

  useEffect(() => {
    loadJobs();
    profilesApi.list().then((data) => { registerTechColors(data ?? []); setTechnicians(data ?? []); });
    customersApi.list().then((data) => setCustomers(data ?? []));
    recurringJobsApi.list().then((data) => setRecurringJobs(data ?? []));
    inventoryApi.summary().then((data) => setInventoryItems(data.items));
    formTemplatesApi.list().then((data) => setFormTemplates(data ?? []));
  }, [loadJobs]);

  useEffect(() => {
    if (techTouched || !profileId) return;
    if (technicians.some((p) => p.id === profileId)) setTechFilterState(profileId);
  }, [technicians, profileId, techTouched]);

  const toggleNewJobForm = (templateId: string) => {
    setNewJob((p) => ({
      ...p,
      selectedFormIds: p.selectedFormIds.includes(templateId)
        ? p.selectedFormIds.filter((id) => id !== templateId)
        : [...p.selectedFormIds, templateId],
    }));
  };

  // Pre-check templates Form Builder already marks as applying to this job type (or "any") and
  // required -- staff can still uncheck them, this just saves re-picking the obvious ones.
  const handleNewJobTypeChange = (jobType: string) => {
    const suggested = formTemplates.filter((tpl) => tpl.required && (tpl.applies_to === jobType || tpl.applies_to === null)).map((tpl) => tpl.id);
    setNewJob((p) => ({ ...p, jobType, selectedFormIds: Array.from(new Set([...suggested, ...p.selectedFormIds])) }));
  };

  const handleCreateJob = async () => {
    if (!newJob.customerId || !newJob.jobType) return;
    const lineItems = newJobLineItems.filter((li) => li.description.trim());
    await jobsApi.create({
      customerId: newJob.customerId,
      jobType: newJob.jobType,
      techId: newJob.techId || null,
      date: newJob.date || null,
      time: newJob.time || null,
      description: newJob.description || null,
      address: customers.find((c) => c.id === newJob.customerId)?.address ?? null,
      amount: parseFloat(newJob.amount) || 0,
      lineItems: lineItems.length > 0
        ? lineItems.map((li) => ({ description: li.description, sku: li.sku ?? null, itemType: li.itemType ?? "material", quantity: li.quantity, cost: li.cost ?? 0, rate: li.rate }))
        : undefined,
      selectedFormIds: newJob.selectedFormIds,
    });
    setNewJob({ customerId: "", jobType: "", date: "", time: "", techId: "", description: "", amount: "", selectedFormIds: [] });
    setNewJobLineItems([]);
    setNewJobOpen(false);
    loadJobs();
  };

  const handleCreateRecurring = async () => {
    if (!newRecurring.customerId || !newRecurring.jobType) return;
    await recurringJobsApi.create({
      customerId: newRecurring.customerId,
      techId: newRecurring.techId || null,
      jobType: newRecurring.jobType,
      description: newRecurring.description || null,
      techNotes: newRecurring.techNotes || null,
      address: customers.find((c) => c.id === newRecurring.customerId)?.address ?? null,
      amount: parseFloat(newRecurring.amount) || 0,
      frequency: newRecurring.frequency,
      dayOfWeek: newRecurring.frequency !== "monthly" ? parseInt(newRecurring.dayOfWeek, 10) : null,
      dayOfMonth: newRecurring.frequency === "monthly" ? parseInt(newRecurring.dayOfMonth, 10) : null,
      startDate: newRecurring.startDate,
      endDate: newRecurring.endDate || null,
      nextJobNotes: newRecurring.nextJobNotes || null,
      selectedFormIds: newRecurring.selectedFormIds,
      startTime: newRecurring.startTime || null,
    });
    setNewRecurring({
      customerId: "", techId: "", jobType: "", description: "", techNotes: "", amount: "",
      frequency: "weekly", dayOfWeek: "1", dayOfMonth: "1", startDate: new Date().toISOString().slice(0, 10), endDate: "",
      nextJobNotes: "", selectedFormIds: [], startTime: "",
    });
    setNewRecurringOpen(false);
    loadJobs();
    recurringJobsApi.list().then((data) => setRecurringJobs(data ?? []));
  };

  // Client SMS 2026-09-08: "Jobs and dispatch... should be able to drag and drop. It should
  // work. But it's not active" -- native HTML5 drag/drop, no library needed.
  const [dragOverTechId, setDragOverTechId] = useState<string | null>(null);

  const assignTech = async (jobId: string, techId: string) => {
    await jobsApi.update(jobId, { tech_id: techId, status: "Dispatched", stage: "dispatched" });
    loadJobs();
  };

  // Client meeting 2026-09-14: "you need to make that drag and drop like we have on the full
  // schedule" -- the Pipeline board's stage columns, same native drag/drop pattern as the
  // Dispatch Board (assignTech, above) and Schedule tab.
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const stageStatusLabels: Record<string, string> = {
    lead: "Lead", booked: "Booked", dispatched: "Dispatched", in_progress: "In Progress", completed: "Completed",
  };
  const moveToStage = async (jobId: string, stageId: string) => {
    await jobsApi.update(jobId, { stage: stageId, status: stageStatusLabels[stageId] ?? stageId });
    loadJobs();
  };

  const shiftMapDate = (days: number) => {
    const d = new Date(mapDate + "T00:00:00");
    d.setDate(d.getDate() + days);
    setMapDate(d.toISOString().slice(0, 10));
  };

  // Schedule view state (month/week/day, employee filters) lives in ScheduleCalendar; these are
  // just the job-mutating callbacks it needs.
  // time is only passed when dropped onto a specific hour slot (week/day view); a month-view drop
  // moves the day and keeps the job's existing time.
  // techId (day view's employee columns): undefined leaves the tech alone, null unassigns, a string reassigns.
  const handleRescheduleDrop = async (jobId: string, dateKey: string, time?: string, techId?: string | null) => {
    await jobsApi.update(jobId, {
      scheduled_date: dateKey,
      ...(time ? { scheduled_time: time } : {}),
      ...(techId !== undefined ? { tech_id: techId } : {}),
    });
    loadJobs();
  };

  const handleUnschedule = async (jobId: string) => {
    await jobsApi.update(jobId, { scheduled_date: null, scheduled_time: null });
    loadJobs();
  };

  const openNewJobForDate = (dateKey: string, time?: string, techId?: string | null) => {
    setNewJob((p) => ({ ...p, date: dateKey, ...(time ? { time } : {}), ...(techId ? { techId } : {}) }));
    setNewJobOpen(true);
  };

  // Recurring Jobs card actions -- backend already supported update/delete, only the UI to
  // reach them was missing.
  const [editRecurring, setEditRecurring] = useState<RecurringJob | null>(null);
  const [editRecurringDraft, setEditRecurringDraft] = useState({ techId: "", amount: "", endDate: "", techNotes: "", nextJobNotes: "", selectedFormIds: [] as string[], startTime: "" });

  const openEditRecurring = (rj: RecurringJob) => {
    setEditRecurring(rj);
    setEditRecurringDraft({
      techId: rj.tech_id ?? "", amount: String(rj.amount), endDate: rj.end_date ?? "",
      techNotes: rj.tech_notes ?? "", nextJobNotes: rj.next_job_notes ?? "", selectedFormIds: rj.selected_form_ids ?? [],
      startTime: rj.start_time ? rj.start_time.slice(0, 5) : "",
    });
  };

  const handleSaveRecurring = async () => {
    if (!editRecurring) return;
    await recurringJobsApi.update(editRecurring.id, {
      techId: editRecurringDraft.techId || null,
      amount: parseFloat(editRecurringDraft.amount) || 0,
      endDate: editRecurringDraft.endDate || null,
      techNotes: editRecurringDraft.techNotes || null,
      nextJobNotes: editRecurringDraft.nextJobNotes || null,
      selectedFormIds: editRecurringDraft.selectedFormIds,
      startTime: editRecurringDraft.startTime || null,
    });
    setEditRecurring(null);
    recurringJobsApi.list().then((data) => setRecurringJobs(data ?? []));
  };

  const handleToggleRecurringActive = async (rj: RecurringJob) => {
    await recurringJobsApi.update(rj.id, { active: !rj.active });
    recurringJobsApi.list().then((data) => setRecurringJobs(data ?? []));
  };

  // Client SMS 2026-09-21: "a way to convert a job to a recurring job or vice versa" (this is the vice versa).
  const handleMakeOneTime = async () => {
    if (!oneTimeTarget) return;
    await recurringJobsApi.makeOneTime(oneTimeTarget.id);
    setOneTimeTarget(null);
    loadJobs();
    recurringJobsApi.list().then((data) => setRecurringJobs(data ?? []));
  };

  // Client SMS 2026-09-21: route order -- standard times for one tech's stops on a day (and their series).
  const handleRouteOrder = async (items: { jobId: string | null; recurringId: string | null; time: string; repeatWeekly?: boolean }[]) => {
    const summary = await recurringJobsApi.routeOrder(items);
    loadJobs();
    recurringJobsApi.list().then((data) => setRecurringJobs(data ?? []));
    return summary;
  };

  // Client SMS 2026-09-21: employee color editable from the calendar's employee list.
  const handleColorChange = async (techId: string, color: string) => {
    await profilesApi.setColor(techId, color);
    const data = (await profilesApi.list()) ?? [];
    registerTechColors(data);
    setTechnicians(data);
  };

  const handleDeleteRecurring = async (rj: RecurringJob) => {
    await recurringJobsApi.remove(rj.id);
    recurringJobsApi.list().then((data) => setRecurringJobs(data ?? []));
  };

  useEffect(() => {
    if (activeTab !== "schedule" || extrasLoadedRef.current) return;
    extrasLoadedRef.current = true;
    tasksApi.list().then((d) => setScheduleTasks(d ?? [])).catch(() => { /* schedule still works without tasks */ });
    invoicingApi.estimates().then((d) => setScheduleEstimates(d ?? [])).catch(() => { /* ...or estimates */ });
  }, [activeTab]);

  useEffect(() => {
    setQuickLines(null);
    if (quickView?.kind !== "estimate") return;
    invoicingApi.estimateDetail(quickView.id).then((d) => setQuickLines(d.lineItems ?? [])).catch(() => setQuickLines([]));
  }, [quickView]);

  // Client SMS 2026-09-21: the Search / Technician / Job Type row above the tabs narrows every tab.
  const effTech = !techTouched && (activeTab === "schedule" || activeTab === "dispatch") ? "all" : techFilter;
  const useDates = dateTouched || activeTab === "pipeline" || activeTab === "dispatch";
  const effFrom = useDates ? dateFrom : "";
  const effTo = useDates ? dateTo : "";
  const passesTopFilters = (j: Job) =>
    ((j.customers?.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (j.address ?? "").toLowerCase().includes(search.toLowerCase()) ||
      j.type.toLowerCase().includes(search.toLowerCase())) &&
    (effTech === "all" || (effTech === "unassigned" ? !j.tech_id : j.tech_id === effTech)) &&
    (typeFilter === "all" || j.type === typeFilter) &&
    (!effFrom || (j.scheduled_date ? j.scheduled_date >= effFrom : !dateTouched)) &&
    (!effTo || (j.scheduled_date ? j.scheduled_date <= effTo : !dateTouched));

  // The same Search / Technician / Job Type filters applied to a recurring series (used for its projected dates).
  const passesRecurringFilters = (rj: RecurringJob) =>
    ((rj.customers?.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (rj.address ?? "").toLowerCase().includes(search.toLowerCase()) ||
      rj.job_type.toLowerCase().includes(search.toLowerCase())) &&
    (effTech === "all" || (effTech === "unassigned" ? !rj.tech_id : rj.tech_id === effTech)) &&
    (typeFilter === "all" || rj.job_type === typeFilter);
  const recurringFiltered = recurringJobs.filter((rj) => matchesQuery(recSearch, [rj.customers?.name, rj.profiles?.name, repeatsOn(rj), rj.job_type, rj.frequency]));
  const typeColors = Object.fromEntries(configLists.job_types.map((jt) => [jt.label, jt.color ?? unassignedColor]));

  const mapJobs = jobs.filter((j) => j.scheduled_date === mapDate && passesTopFilters(j));

  // Jobs map view (client request 2026-08-27): plot the selected day's jobs on a free
  // OpenStreetMap/Leaflet map (no Google Maps billing account available), color-coded by tech —
  // also doubles as the "daily route view" request via the per-tech stop list beside it.
  useEffect(() => {
    if (activeTab !== "map" || !mapContainerRef.current) return;
    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current).setView(DEFAULT_MAP_CENTER, 11);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(mapRef.current);
      markersLayerRef.current = L.layerGroup().addTo(mapRef.current);
    }
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [activeTab]);

  // Ids of the day's (filtered) jobs -- the effects below re-run when the set changes, including when the
  // Search / Technician / Job Type filters do.
  const mapJobsKey = mapJobs.map((j) => j.id).join(",");
  const mapIdle = mapProgress === null;

  // 1) Locate every job. Client SMS 2026-09-21: "not all addresses are shown on the map" -- the old code only
  // tried job.address (often empty) and dropped a job silently if that one lookup failed. Now: the customer's
  // saved coordinates -> the job's address, else the customer's address -> if the street address can't be
  // found, an approximate city/zip location (flagged) -> only then "location not found" in the list.
  useEffect(() => {
    if (activeTab !== "map") return;
    let cancelled = false;
    (async () => {
      const todo = mapJobs.filter((j) => !stopCoordsRef.current[j.id]);
      if (todo.length === 0) { setMapProgress(null); return; }
      setMapProgress({ done: 0, total: todo.length });
      let done = 0;
      for (const job of todo) {
        if (cancelled) return;
        let lat = job.customers?.lat ?? null;
        let lng = job.customers?.lng ?? null;
        let approx = false;
        const address = job.address || job.customers?.address || null;
        if ((lat === null || lng === null) && address) {
          const exact = await geocodeAddress(address);
          if (cancelled) return;
          if (exact) {
            lat = exact.lat;
            lng = exact.lng;
            if (job.customer_id) customersApi.updateCoordinates(job.customer_id, lat, lng).catch(() => {});
          } else {
            const near = await geocodeApproximate(address);
            if (cancelled) return;
            if (near) { lat = near.lat; lng = near.lng; approx = true; }
          }
        }
        done++;
        if (lat !== null && lng !== null) {
          stopCoordsRef.current = { ...stopCoordsRef.current, [job.id]: { lat, lng, approx } };
          setStopCoords(stopCoordsRef.current);
        }
        setMapProgress({ done, total: todo.length });
      }
      if (!cancelled) setMapProgress(null);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, mapJobsKey]);

  // 2) Draw: one numbered pin per located job, and per technician a line joining their stops in order
  // (straight first, swapped for the real road route when the routing service answers).
  useEffect(() => {
    if (activeTab !== "map" || !mapRef.current || !markersLayerRef.current) return;
    const layer = markersLayerRef.current;
    layer.clearLayers();
    const token = ++drawTokenRef.current;
    const bounds: [number, number][] = [];
    const groups = new Map<string, Job[]>();
    for (const j of mapJobs) groups.set(j.tech_id ?? "", [...(groups.get(j.tech_id ?? "") ?? []), j]);

    groups.forEach((group, techId) => {
      const color = techId ? techDotColor(techId) : unassignedColor;
      const line: [number, number][] = [];
      orderStops(group).forEach((job, idx) => {
        const c = stopCoords[job.id];
        if (!c) return;
        bounds.push([c.lat, c.lng]);
        if (techId) line.push([c.lat, c.lng]);
        const num = idx + 1;
        const time = job.scheduled_time ? job.scheduled_time.slice(0, 5) : "";
        L.marker([c.lat, c.lng], { icon: stopIcon(techId ? String(num) : "", color, c.approx), zIndexOffset: 100 + num })
          .bindPopup(
            `<strong>${techId ? `${num}. ` : ""}${time ? `${time} &middot; ` : ""}${escapeHtml(job.customers?.name ?? "Unknown")}</strong><br/>${escapeHtml(job.type)}<br/>Tech: ${escapeHtml(job.profiles?.name ?? "Unassigned")}${job.address || job.customers?.address ? `<br/>${escapeHtml((job.address || job.customers?.address) as string)}` : ""}${c.approx ? "<br/><em>Approximate location</em>" : ""}`,
          )
          .addTo(layer);
      });
      if (techId && line.length >= 2) {
        const straight = L.polyline(line, { color, weight: 3, opacity: 0.75, dashArray: "6 6" }).addTo(layer);
        fetchRoadRoute(line).then((road) => {
          if (road && drawTokenRef.current === token) {
            straight.setLatLngs(road);
            straight.setStyle({ dashArray: undefined, opacity: 0.85 });
          }
        });
      }
    });

    // Fit the view once when the first pin lands and again when every address has been looked up
    // (not on every progressive update, which would fight the user panning).
    const fit = fitStateRef.current;
    const key = `${mapDate}|${mapJobsKey}`;
    if (fit.key !== key) { fit.key = key; fit.started = false; fit.done = false; }
    if (bounds.length > 0 && (!fit.started || (mapIdle && !fit.done))) {
      fit.started = true;
      if (mapIdle) fit.done = true;
      mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, stopCoords, mapJobsKey, mapIdle, mapDate]);

  const routeByTech = technicians
    .map((t) => ({
      tech: t,
      stops: orderStops(mapJobs.filter((j) => j.tech_id === t.id)),
    }))
    .filter((r) => r.stops.length > 0);
  const unassignedStops = mapJobs.filter((j) => !j.tech_id);
  const locatedCount = mapJobs.filter((j) => stopCoords[j.id]).length;
  const approxCount = mapJobs.filter((j) => stopCoords[j.id]?.approx).length;
  const unlocatedTag = (id: string) =>
    mapIdle && !stopCoords[id] ? <span className="ml-1 text-[10px] text-[#DC2626]">({t("location not found")})</span> : null;

  // Client SMS 2026-09-21: tech + job-type dropdowns to the right of "Search jobs".
  const jobTypeFilterOptions = Array.from(new Set([...configLists.job_types.map((jt) => jt.label), ...jobs.map((j) => j.type)])).filter(Boolean);
  const filteredJobs = jobs.filter(passesTopFilters);

  // Tasks + open estimates for the Schedule, narrowed by the same top Search / Technician / date filters
  // (a Job Type filter hides them -- they aren't jobs).
  const inDateRange = (d: string) => (!effFrom || d >= effFrom) && (!effTo || d <= effTo);
  const scheduleExtras: ScheduleJob[] = typeFilter !== "all" ? [] : [
    ...scheduleEstimates
      .filter((e) => e.status !== "Converted" && e.status !== "Declined" && !e.converted_job_id && !e.converted_invoice_id)
      .filter(() => effTech === "all" || effTech === "unassigned")
      .filter((e) => matchesQuery(search, [e.customers?.name, e.number, e.job_description, e.customers?.address]))
      .filter((e) => inDateRange(e.issue_date))
      .map((e): ScheduleJob => ({
        id: `est:${e.id}`, kind: "estimate", refId: e.id, scheduled_date: e.issue_date, scheduled_time: null, tech_id: null,
        stage: "estimate", type: `${t("Estimate")} ${e.number}`, description: e.job_description, amount: Number(e.amount ?? 0),
        address: e.customers?.address ?? null, customers: { name: e.customers?.name ?? "" },
      })),
    ...scheduleTasks
      .filter((k) => k.start_date || k.end_date)
      .filter((k) => effTech === "all" || (effTech === "unassigned" ? !k.tech_id : k.tech_id === effTech))
      .filter((k) => matchesQuery(search, [k.customers?.name, k.type, k.notes, k.address, k.profiles?.name]))
      .flatMap((k) => {
        // A task with a date range shows on every day of it (capped so a typo'd end date can't flood the calendar).
        const start = (k.start_date ?? k.end_date) as string;
        const end = k.end_date && k.end_date >= start ? k.end_date : start;
        const days: string[] = [];
        for (let d = new Date(start + "T00:00:00Z"); days.length < 62; d.setUTCDate(d.getUTCDate() + 1)) {
          const key = d.toISOString().slice(0, 10);
          if (key > end) break;
          days.push(key);
        }
        return days.filter(inDateRange).map((day): ScheduleJob => ({
          id: `task:${k.id}:${day}`, kind: "task", refId: k.id, scheduled_date: day, scheduled_time: null, tech_id: k.tech_id,
          stage: k.status === "Done" ? "completed" : "task", type: `${t("Task")}: ${k.type}`, description: k.notes, amount: 0,
          address: k.address, customers: { name: k.customers?.name ?? "" },
        }));
      }),
  ];
  const quickEstimate = quickView?.kind === "estimate" ? scheduleEstimates.find((e) => e.id === quickView.id) ?? null : null;
  const quickTask = quickView?.kind === "task" ? scheduleTasks.find((k) => k.id === quickView.id) ?? null : null;

  const jobsByStage = (stage: string) => filteredJobs.filter((j) => j.stage === stage);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-[#0F172A]">{t("Jobs & Dispatch")}</h1>
        <div className="flex items-center gap-2">
          <Dialog open={newJobOpen} onOpenChange={setNewJobOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#0891B2] hover:bg-[#0E7490] text-white gap-2 h-10">
                <Plus className="w-4 h-4" /> {t("New Job")}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{t("Create New Job")}</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label>{t("Customer")}</Label>
                  <div className="mt-1">
                    <SearchableSelect
                      value={newJob.customerId}
                      onChange={(v) => setNewJob((p) => ({ ...p, customerId: v }))}
                      placeholder={t("Select customer")}
                      searchPlaceholder={t("Search customers...")}
                      options={customers.map(customerOption)}
                      showSublabelWhenSelected
                    />
                  </div>
                </div>
                <div>
                  <Label>{t("Job Type")}</Label>
                  <Select value={newJob.jobType} onValueChange={handleNewJobTypeChange}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder={t("Select job type")} /></SelectTrigger>
                    <SelectContent>
                      {configLists.job_types.map((jt) => (
                        <SelectItem key={jt.id} value={jt.label}>
                          <span className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ background: jt.color ?? "#64748B" }} />
                            {jt.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {formTemplates.length > 0 && (
                  <div>
                    <Label>{t("Forms for this Job")}</Label>
                    <div className="mt-1 border border-[#E2E8F0] rounded-lg p-2 space-y-1 max-h-40 overflow-y-auto">
                      {formTemplates.map((tpl) => (
                        <label key={tpl.id} className="flex items-center gap-2 text-sm py-1 px-1.5 rounded hover:bg-[#F8FAFC] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newJob.selectedFormIds.includes(tpl.id)}
                            onChange={() => toggleNewJobForm(tpl.id)}
                          />
                          <span className="flex-1">{t(tpl.name)}</span>
                          {tpl.required && <Badge className="bg-[#DC2626]/10 text-[#DC2626] text-[10px] px-1.5 py-0">{t("Required")}</Badge>}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t("Call Type")}</Label>
                    <Select>
                      <SelectTrigger className="mt-1"><SelectValue placeholder={t("Select call type")} /></SelectTrigger>
                      <SelectContent>
                        {configLists.call_types.map((c) => (
                          <SelectItem key={c.id} value={c.label}>{t(c.label)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t("Call Source")}</Label>
                    <Select>
                      <SelectTrigger className="mt-1"><SelectValue placeholder={t("Select source")} /></SelectTrigger>
                      <SelectContent>
                        {configLists.call_sources.map((c) => (
                          <SelectItem key={c.id} value={c.label}>{t(c.label)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t("Date")}</Label>
                    <Input type="date" className="mt-1" value={newJob.date} onChange={(e) => setNewJob((p) => ({ ...p, date: e.target.value }))} />
                  </div>
                  <div>
                    <Label>{t("Time")}</Label>
                    <Input type="time" className="mt-1" value={newJob.time} onChange={(e) => setNewJob((p) => ({ ...p, time: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label>{t("Assign Technician")}</Label>
                  <Select value={newJob.techId} onValueChange={(v) => setNewJob((p) => ({ ...p, techId: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder={t("Select tech")} /></SelectTrigger>
                    <SelectContent>
                      {technicians.map((tech) => (
                        <SelectItem key={tech.id} value={tech.id}>{tech.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("Notes")}</Label>
                  <Input placeholder={t("Job description...")} className="mt-1" value={newJob.description} onChange={(e) => setNewJob((p) => ({ ...p, description: e.target.value }))} />
                </div>
                <div>
                  <Label>{t("Line Items")}</Label>
                  <div className="mt-1">
                    <LineItemsEditor items={newJobLineItems} onChange={setNewJobLineItems} inventoryItems={inventoryItems} />
                  </div>
                </div>
                <div>
                  <Label>{t("Amount")} {newJobLineItems.length > 0 && <span className="text-xs text-[#64748B]">({t("from line items")})</span>}</Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    className="mt-1"
                    value={newJobLineItems.length > 0 ? newJobLineItems.reduce((s, li) => s + li.quantity * li.rate, 0).toFixed(2) : newJob.amount}
                    onChange={(e) => setNewJob((p) => ({ ...p, amount: e.target.value }))}
                    disabled={newJobLineItems.length > 0}
                  />
                  <p className="text-xs text-[#64748B] mt-1">{t("Used for the invoice generated when this job is marked complete.")}</p>
                </div>
                <Button className="w-full bg-[#0891B2] hover:bg-[#0E7490] text-white" onClick={handleCreateJob}>
                  {t("Create Job")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={newRecurringOpen} onOpenChange={setNewRecurringOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="h-10 gap-2 border-[#E2E8F0] text-[#0F172A] bg-white">
                <Calendar className="w-4 h-4" /> {t("New Recurring")}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{t("Create Recurring Job")}</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label>{t("Customer")}</Label>
                  <div className="mt-1">
                    <SearchableSelect
                      value={newRecurring.customerId}
                      onChange={(v) => setNewRecurring((p) => ({ ...p, customerId: v }))}
                      placeholder={t("Select customer")}
                      searchPlaceholder={t("Search customers...")}
                      options={customers.map(customerOption)}
                      showSublabelWhenSelected
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t("Job Type")}</Label>
                    <Select value={newRecurring.jobType} onValueChange={(v) => setNewRecurring((p) => ({ ...p, jobType: v }))}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder={t("Select type")} /></SelectTrigger>
                      <SelectContent>{configLists.job_types.map((jt) => <SelectItem key={jt.id} value={jt.label}>{jt.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t("Tech")}</Label>
                    <Select value={newRecurring.techId} onValueChange={(v) => setNewRecurring((p) => ({ ...p, techId: v }))}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder={t("Select tech")} /></SelectTrigger>
                      <SelectContent>{technicians.map((tech) => <SelectItem key={tech.id} value={tech.id}>{tech.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>{t("Description (customer-facing)")}</Label>
                  <Input className="mt-1" value={newRecurring.description} onChange={(e) => setNewRecurring((p) => ({ ...p, description: e.target.value }))} />
                </div>
                <div>
                  {/* Client PDF 2026-09-05: "Able to show notes for all recurring jobs moving
                      forward" -- carried onto every generated occurrence, tech-only. */}
                  <Label>{t("Tech-Only Notes (carries to every occurrence)")}</Label>
                  <Input className="mt-1" value={newRecurring.techNotes} onChange={(e) => setNewRecurring((p) => ({ ...p, techNotes: e.target.value }))} />
                </div>
                <div>
                  {/* Client SMS 2026-09-21: standard start time so the weekly route keeps the same stop order. */}
                  <Label>{t("Standard start time")}</Label>
                  <Input type="time" className="mt-1" value={newRecurring.startTime} onChange={(e) => setNewRecurring((p) => ({ ...p, startTime: e.target.value }))} />
                </div>
                <div>
                  {/* Client SMS 2026-09-21: "notes for this job only" -- goes onto the next job created, then clears. */}
                  <Label>{t("Notes for this job only")}</Label>
                  <Input className="mt-1" value={newRecurring.nextJobNotes} onChange={(e) => setNewRecurring((p) => ({ ...p, nextJobNotes: e.target.value }))} />
                </div>
                {formTemplates.length > 0 && (
                  <div>
                    {/* Client SMS 2026-09-21: "forms for all jobs" -- every job created from this series gets these forms. */}
                    <Label>{t("Forms for all jobs")}</Label>
                    <div className="mt-1 border border-[#E2E8F0] rounded-lg p-2 space-y-1 max-h-32 overflow-y-auto">
                      {formTemplates.map((tpl) => (
                        <label key={tpl.id} className="flex items-center gap-2 text-sm py-1 px-1.5 rounded hover:bg-[#F8FAFC] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newRecurring.selectedFormIds.includes(tpl.id)}
                            onChange={() => setNewRecurring((p) => ({ ...p, selectedFormIds: p.selectedFormIds.includes(tpl.id) ? p.selectedFormIds.filter((x) => x !== tpl.id) : [...p.selectedFormIds, tpl.id] }))}
                          />
                          <span className="flex-1">{t(tpl.name)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t("Amount")}</Label>
                    <Input type="number" className="mt-1" value={newRecurring.amount} onChange={(e) => setNewRecurring((p) => ({ ...p, amount: e.target.value }))} />
                  </div>
                  <div>
                    <Label>{t("Frequency")}</Label>
                    <Select value={newRecurring.frequency} onValueChange={(v) => setNewRecurring((p) => ({ ...p, frequency: v as "weekly" | "biweekly" | "monthly" }))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">{t("Weekly")}</SelectItem>
                        <SelectItem value="biweekly">{t("Bi-weekly")}</SelectItem>
                        <SelectItem value="monthly">{t("Monthly")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {newRecurring.frequency !== "monthly" ? (
                  <div>
                    <Label>{t("Day of Week")}</Label>
                    <Select value={newRecurring.dayOfWeek} onValueChange={(v) => setNewRecurring((p) => ({ ...p, dayOfWeek: v }))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => <SelectItem key={i} value={String(i)}>{t(d)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div>
                    <Label>{t("Day of Month")}</Label>
                    <Input type="number" min={1} max={31} className="mt-1" value={newRecurring.dayOfMonth} onChange={(e) => setNewRecurring((p) => ({ ...p, dayOfMonth: e.target.value }))} />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t("Start Date")}</Label>
                    <Input type="date" className="mt-1" value={newRecurring.startDate} onChange={(e) => setNewRecurring((p) => ({ ...p, startDate: e.target.value }))} />
                  </div>
                  <div>
                    {/* Client PDF 2026-09-05: "Have an option for an end date or no end date". */}
                    <Label>{t("End Date (optional)")}</Label>
                    <Input type="date" className="mt-1" value={newRecurring.endDate} onChange={(e) => setNewRecurring((p) => ({ ...p, endDate: e.target.value }))} />
                  </div>
                </div>
                <Button className="w-full bg-[#0891B2] hover:bg-[#0E7490] text-white" onClick={handleCreateRecurring}>
                  {t("Create Recurring Job")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-[#E2E8F0] w-fit">
        {[
          { id: "pipeline" as const, label: "Pipeline", icon: LayoutDashboard },
          { id: "dispatch" as const, label: "Dispatch Board", icon: Truck },
          { id: "schedule" as const, label: "Schedule", icon: Calendar },
          { id: "map" as const, label: "Map", icon: MapIcon },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id ? "bg-[#0891B2] text-white" : "text-[#64748B] hover:bg-[#F8FAFC]"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{t(tab.label)}</span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="relative w-full sm:max-w-md sm:flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
          <Input
            placeholder={t("Search jobs...")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 bg-white border-[#E2E8F0]"
          />
        </div>
        <Select value={techFilter} onValueChange={setTechFilter}>
          <SelectTrigger className="h-10 w-full sm:w-48 bg-white border-[#E2E8F0]"><SelectValue placeholder={t("Technician")} /></SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="all">{t("All Technicians")}</SelectItem>
            <SelectItem value="unassigned">{t("Unassigned")}</SelectItem>
            {technicians.map((tech) => <SelectItem key={tech.id} value={tech.id}>{tech.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-10 w-full sm:w-52 bg-white border-[#E2E8F0]"><SelectValue placeholder={t("Job Type")} /></SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="all">{t("All Job Types")}</SelectItem>
            {jobTypeFilterOptions.map((jt) => <SelectItem key={jt} value={jt}>{jt}</SelectItem>)}
          </SelectContent>
        </Select>
        {/* Client SMS 2026-09-21: date range to the right of "Search jobs". */}
        <div className="flex items-center gap-1.5">
          <Input type="date" aria-label={t("From")} title={t("From")} className="h-10 w-full sm:w-40 bg-white border-[#E2E8F0]" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <span className="text-xs text-[#64748B]">{t("to")}</span>
          <Input type="date" aria-label={t("To")} title={t("To")} className="h-10 w-full sm:w-40 bg-white border-[#E2E8F0]" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          {(["today", "week", "month"] as const).map((r) => (
            <Button key={r} variant="outline" className="h-10 px-2.5 text-xs border-[#E2E8F0] bg-white" onClick={() => setQuickRange(r)}>
              {r === "today" ? t("Today") : r === "week" ? t("Week") : t("Month")}
            </Button>
          ))}
          {(dateFrom || dateTo) && <Button variant="ghost" className="h-10 px-2 text-xs" onClick={() => { setDateFrom(""); setDateTo(""); }}>{t("Clear")}</Button>}
        </div>
      </div>

      {/* Pipeline View */}
      {activeTab === "pipeline" && (
        <div className="overflow-x-auto">
          <div className="flex gap-4 min-w-[1000px] pb-2">
            {stages.map((stage) => {
              const stageJobs = jobsByStage(stage.id);
              return (
                <div key={stage.id} className="flex-1 min-w-[200px]">
                  <div className={`flex items-center justify-between px-3 py-2 rounded-t-lg bg-white border border-[#E2E8F0] border-b-0 ${stage.color} border-t-2`}>
                    <span className="font-semibold text-sm text-[#0F172A]">{t(stage.label)}</span>
                    <Badge className="bg-[#F1F5F9] text-[#64748B] text-[10px]">{stageJobs.length}</Badge>
                  </div>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOverStage(stage.id); }}
                    onDragLeave={() => setDragOverStage((cur) => (cur === stage.id ? null : cur))}
                    onDrop={(e) => {
                      e.preventDefault();
                      const jobId = e.dataTransfer.getData("text/job-id");
                      if (jobId) moveToStage(jobId, stage.id);
                      setDragOverStage(null);
                    }}
                    className={`rounded-b-lg border border-t-0 p-2 space-y-2 min-h-[300px] transition-colors ${dragOverStage === stage.id ? "bg-[#0891B2]/10 border-[#0891B2] border-dashed" : "bg-[#F8FAFC] border-[#E2E8F0]"}`}
                  >
                    {stageJobs.map((job) => (
                      <div
                        key={job.id}
                        draggable
                        onDragStart={(e) => { e.dataTransfer.setData("text/job-id", job.id); e.dataTransfer.effectAllowed = "move"; }}
                        className="bg-white rounded-lg p-3 border border-[#E2E8F0] shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => navigate(`/jobs/${job.id}`)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Badge className="text-[10px] px-1.5 py-0" style={techStyle(job.tech_id)}>{job.type}</Badge>
                          <div className="flex items-center gap-1.5">
                            {job.en_route_at && !job.arrived_at && !job.completed_at && (
                              <Navigation className="w-3.5 h-3.5 text-[#F59E0B]" aria-label={t("En route")} />
                            )}
                            <span className="text-xs text-[#64748B]">{job.scheduled_time}</span>
                          </div>
                        </div>
                        <p className="font-medium text-sm text-[#0F172A] mb-1">{job.customers?.name}</p>
                        <p className="text-xs text-[#64748B] mb-2 truncate">{job.address}</p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Avatar className="w-6 h-6">
                              <AvatarFallback className="bg-[#0891B2] text-white text-[10px]">{job.profiles?.avatar}</AvatarFallback>
                            </Avatar>
                            <span className="text-xs text-[#64748B]">{job.profiles?.name}</span>
                          </div>
                          <span className="text-xs font-semibold text-[#0F172A]">${job.amount}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Dispatch Board */}
      {activeTab === "dispatch" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Unassigned Jobs */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-4">
            <h3 className="font-semibold text-[#0F172A] mb-3">{t("Unassigned & Today's Jobs")}</h3>
            <p className="text-xs text-[#94A3B8] -mt-2 mb-3">{t("Drag a job onto a technician to assign it.")}</p>
            <div className="space-y-2">
              {filteredJobs.filter((j) => j.stage === "booked" || j.stage === "lead").map((job) => (
                <div
                  key={job.id}
                  draggable
                  onDragStart={(e) => { e.dataTransfer.setData("text/job-id", job.id); e.dataTransfer.effectAllowed = "move"; }}
                  className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex items-center gap-3 cursor-grab active:cursor-grabbing"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge className="text-[10px] px-1.5 py-0" style={typeStyle(job.type, configLists.job_types)}>{job.type}</Badge>
                      <span className="text-xs text-[#64748B]">{job.scheduled_date} {job.scheduled_time}</span>
                    </div>
                    <p className="font-medium text-sm text-[#0F172A] mt-0.5">{job.customers?.name}</p>
                    <p className="text-xs text-[#64748B] truncate">{job.address}</p>
                  </div>
                  <div className="shrink-0">
                    <Select onValueChange={(v) => assignTech(job.id, v)}>
                      <SelectTrigger className="h-8 w-32 text-xs">
                        <SelectValue placeholder={t("Assign")} />
                      </SelectTrigger>
                      <SelectContent>
                        {technicians.map((tech) => (
                          <SelectItem key={tech.id} value={tech.id} className="text-xs">{tech.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
              {filteredJobs.filter((j) => j.stage === "booked" || j.stage === "lead").length === 0 && (
                <p className="text-center text-[#64748B] py-4 text-sm">{t("All jobs assigned")}</p>
              )}
            </div>
          </div>

          {/* Technicians */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-[#0F172A]">{t("Technicians")}</h3>
              <p className="text-xs text-[#64748B] italic">{t("Assigns nearest available based on live vehicle position")}</p>
            </div>
            <div className="space-y-2">
              {technicians.map((tech) => {
                const statusColors: Record<string, string> = {
                  "Available": "bg-[#16A34A]/10 text-[#16A34A]",
                  "On a job": "bg-[#0891B2]/10 text-[#0891B2]",
                  "Idle": "bg-[#F59E0B]/10 text-[#F59E0B]",
                  "Off": "bg-[#E2E8F0] text-[#64748B]",
                };
                return (
                  <div
                    key={tech.id}
                    onDragOver={(e) => { e.preventDefault(); setDragOverTechId(tech.id); }}
                    onDragLeave={() => setDragOverTechId((cur) => (cur === tech.id ? null : cur))}
                    onDrop={(e) => {
                      e.preventDefault();
                      const jobId = e.dataTransfer.getData("text/job-id");
                      if (jobId) assignTech(jobId, tech.id);
                      setDragOverTechId(null);
                    }}
                    className={`p-3 rounded-lg border flex items-center gap-3 transition-colors ${dragOverTechId === tech.id ? "bg-[#0891B2]/10 border-[#0891B2] border-dashed" : "bg-[#F8FAFC] border-[#E2E8F0]"}`}
                  >
                    <Avatar className="w-10 h-10">
                      <AvatarFallback className="bg-[#0891B2] text-white text-sm">{tech.avatar}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm text-[#0F172A]">{tech.name}</p>
                        <Badge className={`${statusColors[tech.status] || ""} text-[10px] px-1.5 py-0`}>{tech.status}</Badge>
                      </div>
                      <p className="text-xs text-[#64748B]">{jobs.filter((j) => j.tech_id === tech.id).length} {t("jobs today")}</p>
                    </div>
                    <div className="shrink-0 text-xs text-[#64748B]">
                      {tech.status === "On a job" && <div className="flex items-center gap-1"><Clock className="w-3 h-3" /> {t("Active")}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Schedule View */}
      {activeTab === "schedule" && (
        <div className="space-y-4">
          {/* Client SMS 2026-09-09: real add/delete/change/drag-and-drop schedule. Client SMS 2026-09-21:
              month/week/day views + an employee panel to show/hide individual people. */}
          <ScheduleCalendar
            jobs={filteredJobs}
            technicians={technicians}
            onOpenJob={(id) => navigate(`/jobs/${id}`)}
            onReschedule={handleRescheduleDrop}
            onNewJob={openNewJobForDate}
            onUnschedule={handleUnschedule}
            allJobs={jobs}
            recurring={recurringJobs.filter(passesRecurringFilters)}
            typeColors={typeColors}
            dateFrom={effFrom}
            dateTo={effTo}
            onOpenRecurring={(id) => { const rj = recurringJobs.find((r) => r.id === id); if (rj) openEditRecurring(rj); }}
            onColorChange={handleColorChange}
            onRouteOrder={handleRouteOrder}
            extras={scheduleExtras}
            onOpenExtra={(kind, id) => setQuickView({ kind, id })}
          />

          {/* Client video 2026-09-25: look at an estimate / task right from the schedule without opening a new page. */}
          <Dialog open={quickView !== null} onOpenChange={(o) => { if (!o) setQuickView(null); }}>
            <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
              {quickEstimate && (
                <>
                  <DialogHeader><DialogTitle>{t("Estimate")} {quickEstimate.number}</DialogTitle></DialogHeader>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between gap-3"><span className="text-[#64748B]">{t("Customer")}</span><span className="font-medium text-right">{quickEstimate.customers?.name ?? "—"}</span></div>
                    {quickEstimate.customers?.address && <div className="flex justify-between gap-3"><span className="text-[#64748B]">{t("Address")}</span><span className="text-right">{quickEstimate.customers.address}</span></div>}
                    <div className="flex justify-between gap-3"><span className="text-[#64748B]">{t("Status")}</span><Badge variant="outline">{t(quickEstimate.status)}</Badge></div>
                    <div className="flex justify-between gap-3"><span className="text-[#64748B]">{t("Date")}</span><span>{quickEstimate.issue_date}{quickEstimate.expiry_date ? ` → ${quickEstimate.expiry_date}` : ""}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-[#64748B]">{t("Amount")}</span><span className="font-semibold text-[#0891B2]">${Number(quickEstimate.amount ?? 0).toFixed(2)}</span></div>
                    {quickEstimate.job_description && <p className="rounded-lg bg-[#F8FAFC] p-2.5 whitespace-pre-wrap">{quickEstimate.job_description}</p>}
                    <div className="border-t border-[#E2E8F0] pt-2">
                      {quickLines === null ? <p className="text-xs text-[#64748B]">{t("Loading...")}</p> : quickLines.length === 0 ? <p className="text-xs text-[#64748B]">{t("No line items.")}</p> : (
                        <table className="w-full text-xs">
                          <tbody>
                            {quickLines.map((li) => (
                              <tr key={li.id} className="border-b border-[#F1F5F9] last:border-0">
                                <td className="py-1 pr-2">{li.description}</td>
                                <td className="py-1 text-right text-[#64748B] whitespace-nowrap">{li.quantity} × ${Number(li.rate).toFixed(2)}</td>
                                <td className="py-1 pl-2 text-right font-medium whitespace-nowrap">${Number(li.amount).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button variant="outline" onClick={() => setQuickView(null)}>{t("Close")}</Button>
                    <Button className="bg-[#0891B2] hover:bg-[#0E7490] text-white" onClick={() => navigate(`/invoicing/estimates/${quickEstimate.id}`)}>{t("Open Estimate")}</Button>
                  </div>
                </>
              )}
              {quickTask && (
                <>
                  <DialogHeader><DialogTitle>{t("Task")}: {quickTask.type}</DialogTitle></DialogHeader>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between gap-3"><span className="text-[#64748B]">{t("Customer")}</span><span className="font-medium text-right">{quickTask.customers?.name ?? "—"}</span></div>
                    {quickTask.address && <div className="flex justify-between gap-3"><span className="text-[#64748B]">{t("Address")}</span><span className="text-right">{quickTask.address}</span></div>}
                    <div className="flex justify-between gap-3"><span className="text-[#64748B]">{t("Assigned to")}</span><span>{quickTask.profiles?.name ?? t("Unassigned")}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-[#64748B]">{t("Status")}</span><Badge variant="outline">{t(quickTask.status)}</Badge></div>
                    <div className="flex justify-between gap-3"><span className="text-[#64748B]">{t("Dates")}</span><span>{quickTask.start_date ?? "—"}{quickTask.end_date ? ` → ${quickTask.end_date}` : ""}</span></div>
                    {quickTask.notes && <p className="rounded-lg bg-[#F8FAFC] p-2.5 whitespace-pre-wrap">{quickTask.notes}</p>}
                    {(quickTask.photos ?? []).length > 0 && (
                      <div className="grid grid-cols-4 gap-2">
                        {quickTask.photos.map((url, i) => <a key={i} href={url} target="_blank" rel="noreferrer"><img src={url} alt="" className="w-full aspect-square object-cover rounded" /></a>)}
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button variant="outline" onClick={() => setQuickView(null)}>{t("Close")}</Button>
                    <Button className="bg-[#0891B2] hover:bg-[#0E7490] text-white" onClick={() => navigate("/invoicing?tab=tasks")}>{t("Open Tasks")}</Button>
                  </div>
                </>
              )}
            </DialogContent>
          </Dialog>

          {/* Recurring Jobs -- client PDF 2026-09-05: real schedule, not the old read-only
              "Recurring Routes" (never linked to actual jobs). Each generates a real job
              occurrence and rolls forward automatically as the current one completes.
              Client SMS 2026-09-09: "recurring fields, full functionality" -- pause/resume,
              edit, and delete a series (backend already supported this, UI didn't expose it). */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
              <h3 className="font-semibold text-[#0F172A]">{t("Recurring Jobs")}</h3>
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
                <Input placeholder={t("Search customer, technician, day of the week, or job type...")} value={recSearch} onChange={(e) => setRecSearch(e.target.value)} className="pl-9 h-9 bg-white border-[#E2E8F0]" />
              </div>
              <ViewToggle mode={recView} onChange={setRecView} />
            </div>
            {recView === "table" ? (
              <div className="overflow-x-auto border border-[#E2E8F0] rounded-lg">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                      <th className="text-left py-2.5 px-3 text-xs font-semibold text-[#64748B] uppercase">{t("Customer")}</th>
                      <th className="text-left py-2.5 px-3 text-xs font-semibold text-[#64748B] uppercase">{t("Job Type")}</th>
                      <th className="text-left py-2.5 px-3 text-xs font-semibold text-[#64748B] uppercase">{t("Technician")}</th>
                      <th className="text-left py-2.5 px-3 text-xs font-semibold text-[#64748B] uppercase">{t("Repeats")}</th>
                      <th className="text-left py-2.5 px-3 text-xs font-semibold text-[#64748B] uppercase">{t("Time")}</th>
                      <th className="text-left py-2.5 px-3 text-xs font-semibold text-[#64748B] uppercase">{t("Since")}</th>
                      <th className="text-left py-2.5 px-3 text-xs font-semibold text-[#64748B] uppercase">{t("Ends")}</th>
                      <th className="text-center py-2.5 px-3 text-xs font-semibold text-[#64748B] uppercase">{t("Status")}</th>
                      <th className="py-2.5 px-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {recurringFiltered.map((rj) => (
                      <tr key={rj.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]">
                        <td className="py-2.5 px-3 font-medium text-[#0F172A]">{rj.customers?.name ?? "—"}</td>
                        <td className="py-2.5 px-3 text-[#64748B]">{rj.job_type}</td>
                        <td className="py-2.5 px-3 text-[#64748B]">{rj.profiles?.name ?? t("Unassigned")}</td>
                        <td className="py-2.5 px-3 text-[#64748B]">{(rj.frequency === "weekly" ? t("Weekly") : rj.frequency === "biweekly" ? t("Every 2 weeks") : t("Monthly"))} · {t(repeatsOn(rj))}</td>
                        <td className="py-2.5 px-3 text-[#64748B]">{rj.start_time ? rj.start_time.slice(0, 5) : "—"}</td>
                        <td className="py-2.5 px-3 text-[#64748B]">{rj.start_date}</td>
                        <td className="py-2.5 px-3 text-[#64748B]">{rj.end_date ?? "—"}</td>
                        <td className="py-2.5 px-3 text-center">
                          <Badge className={`text-[10px] px-1.5 py-0 ${rj.active ? "bg-[#16A34A]/10 text-[#16A34A]" : "bg-[#F1F5F9] text-[#64748B]"}`}>{rj.active ? t("Active") : t("Paused")}</Badge>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center justify-end gap-3 whitespace-nowrap">
                            <button className="text-xs text-[#0891B2] font-medium flex items-center gap-1" onClick={() => handleToggleRecurringActive(rj)}>
                              {rj.active ? <><Pause className="w-3 h-3" /> {t("Pause")}</> : <><Play className="w-3 h-3" /> {t("Resume")}</>}
                            </button>
                            <button className="text-xs text-[#64748B] font-medium flex items-center gap-1" onClick={() => openEditRecurring(rj)}><Pencil className="w-3 h-3" /> {t("Edit")}</button>
                            <button className="text-xs text-[#64748B] font-medium" onClick={() => setOneTimeTarget(rj)}>{t("Make one-time")}</button>
                            <button className="text-xs text-[#DC2626] font-medium flex items-center gap-1" onClick={() => handleDeleteRecurring(rj)}><Trash2 className="w-3 h-3" /> {t("Delete")}</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {recurringFiltered.length === 0 && (
                      <tr><td colSpan={9} className="py-6 text-center text-[#64748B]">{recurringJobs.length === 0 ? t("No recurring jobs set up yet.") : t("No recurring jobs match your search.")}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {recurringFiltered.map((rj) => (
                  <div key={rj.id} className="p-4 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-[#0F172A]">{rj.customers?.name ?? "—"}</h4>
                      <Badge className={`text-[10px] px-1.5 py-0 ${rj.active ? "bg-[#0891B2]/10 text-[#0891B2]" : "bg-[#F1F5F9] text-[#64748B]"}`}>
                        {rj.active ? rj.frequency : t("Paused")}
                      </Badge>
                    </div>
                    <div className="space-y-1 text-sm text-[#64748B]">
                      <p className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {rj.job_type} · {t(repeatsOn(rj))}</p>
                      <p className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> {rj.profiles?.name ?? t("Unassigned")}</p>
                      <p className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {t("Since")} {rj.start_date}{rj.end_date ? ` · ${t("ends")} ${rj.end_date}` : ` · ${t("no end date")}`}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 pt-2 border-t border-[#E2E8F0]">
                      <button className="text-xs text-[#0891B2] font-medium flex items-center gap-1" onClick={() => handleToggleRecurringActive(rj)}>
                        {rj.active ? <><Pause className="w-3 h-3" /> {t("Pause")}</> : <><Play className="w-3 h-3" /> {t("Resume")}</>}
                      </button>
                      <button className="text-xs text-[#64748B] font-medium flex items-center gap-1" onClick={() => openEditRecurring(rj)}>
                        <Pencil className="w-3 h-3" /> {t("Edit")}
                      </button>
                      <button className="text-xs text-[#64748B] font-medium" onClick={() => setOneTimeTarget(rj)}>{t("Make one-time")}</button>
                      <button className="text-xs text-[#DC2626] font-medium flex items-center gap-1" onClick={() => handleDeleteRecurring(rj)}>
                        <Trash2 className="w-3 h-3" /> {t("Delete")}
                      </button>
                    </div>
                  </div>
                ))}
                {recurringFiltered.length === 0 && <p className="text-sm text-[#64748B] col-span-full py-2">{recurringJobs.length === 0 ? t("No recurring jobs set up yet.") : t("No recurring jobs match your search.")}</p>}
              </div>
            )}
          </div>

          <Dialog open={!!oneTimeTarget} onOpenChange={(open) => !open && setOneTimeTarget(null)}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>{t("Make this a one-time job?")}</DialogTitle></DialogHeader>
              <p className="text-sm text-[#64748B]">
                {oneTimeTarget?.customers?.name} — {oneTimeTarget?.job_type}. {t("The recurring schedule is removed and its upcoming job stays as a normal one-time job. No more repeats will be created.")}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setOneTimeTarget(null)}>{t("Cancel")}</Button>
                <Button className="flex-1 bg-[#0891B2] hover:bg-[#0E7490] text-white" onClick={handleMakeOneTime}>{t("Make one-time")}</Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={!!editRecurring} onOpenChange={(open) => !open && setEditRecurring(null)}>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{t("Edit Recurring Job")} — {editRecurring?.customers?.name}</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label>{t("Technician")}</Label>
                  <Select value={editRecurringDraft.techId} onValueChange={(v) => setEditRecurringDraft((p) => ({ ...p, techId: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder={t("Unassigned")} /></SelectTrigger>
                    <SelectContent>{technicians.map((tech) => <SelectItem key={tech.id} value={tech.id}>{tech.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("Amount")}</Label>
                  <Input type="number" className="mt-1" value={editRecurringDraft.amount} onChange={(e) => setEditRecurringDraft((p) => ({ ...p, amount: e.target.value }))} />
                </div>
                <div>
                  <Label>{t("End Date")}</Label>
                  <Input type="date" className="mt-1" value={editRecurringDraft.endDate} onChange={(e) => setEditRecurringDraft((p) => ({ ...p, endDate: e.target.value }))} />
                </div>
                <div>
                  <Label>{t("Standard start time")}</Label>
                  <Input type="time" className="mt-1" value={editRecurringDraft.startTime} onChange={(e) => setEditRecurringDraft((p) => ({ ...p, startTime: e.target.value }))} />
                </div>
                <div>
                  <Label>{t("Tech-Only Notes (carries to every occurrence)")}</Label>
                  <Input className="mt-1" value={editRecurringDraft.techNotes} onChange={(e) => setEditRecurringDraft((p) => ({ ...p, techNotes: e.target.value }))} />
                </div>
                <div>
                  <Label>{t("Notes for this job only")}</Label>
                  <Input className="mt-1" value={editRecurringDraft.nextJobNotes} onChange={(e) => setEditRecurringDraft((p) => ({ ...p, nextJobNotes: e.target.value }))} />
                </div>
                {formTemplates.length > 0 && (
                  <div>
                    <Label>{t("Forms for all jobs")}</Label>
                    <div className="mt-1 border border-[#E2E8F0] rounded-lg p-2 space-y-1 max-h-32 overflow-y-auto">
                      {formTemplates.map((tpl) => (
                        <label key={tpl.id} className="flex items-center gap-2 text-sm py-1 px-1.5 rounded hover:bg-[#F8FAFC] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editRecurringDraft.selectedFormIds.includes(tpl.id)}
                            onChange={() => setEditRecurringDraft((p) => ({ ...p, selectedFormIds: p.selectedFormIds.includes(tpl.id) ? p.selectedFormIds.filter((x) => x !== tpl.id) : [...p.selectedFormIds, tpl.id] }))}
                          />
                          <span className="flex-1">{t(tpl.name)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <Button className="w-full bg-[#0891B2] hover:bg-[#0E7490] text-white" onClick={handleSaveRecurring}>{t("Save Changes")}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Map View — jobs on a map, scrollable by day; also shows each tech's daily route */}
      {activeTab === "map" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <button className="p-1 rounded hover:bg-[#F8FAFC]" onClick={() => shiftMapDate(-1)}>
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <h3 className="font-semibold text-[#0F172A]">
                  {new Date(mapDate + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
                </h3>
                <button className="p-1 rounded hover:bg-[#F8FAFC]" onClick={() => shiftMapDate(1)}>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                {mapProgress && <span className="text-[11px] text-[#0891B2]">{t("Locating addresses...")} {mapProgress.done}/{mapProgress.total}</span>}
                {approxCount > 0 && <span className="text-[11px] text-[#64748B]">{approxCount} {t("approximate (dashed) — exact address not found")}</span>}
                <Badge className="bg-[#F1F5F9] text-[#64748B] text-[10px]">{locatedCount} / {mapJobs.length} {t("on map")}</Badge>
              </div>
            </div>
            <div ref={mapContainerRef} className="w-full h-[calc(100vh-340px)] min-h-[480px] rounded-lg overflow-hidden" />
          </div>

          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-4 space-y-4 lg:max-h-[calc(100vh-260px)] lg:min-h-[560px] overflow-y-auto">
            <h3 className="font-semibold text-[#0F172A]">{t("Daily Route by Technician")}</h3>
            {routeByTech.map(({ tech, stops }) => (
              <div key={tech.id}>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: techDotColor(tech.id) }} />
                  <p className="font-medium text-sm text-[#0F172A]">{tech.name}</p>
                  <span className="text-xs text-[#64748B]">({stops.length})</span>
                </div>
                <div className="space-y-1 pl-4 border-l-2 border-[#F1F5F9]">
                  {stops.map((s, i) => (
                    <div key={s.id} className="text-xs text-[#64748B] cursor-pointer hover:text-[#0891B2] flex items-start gap-1.5" onClick={() => navigate(`/jobs/${s.id}`)}>
                      <span className="w-4 h-4 rounded-full text-[9px] font-bold text-white flex items-center justify-center shrink-0 mt-px" style={{ background: techDotColor(tech.id) }}>{i + 1}</span>
                      <span>{s.scheduled_time ? `${s.scheduled_time.slice(0, 5)} · ` : ""}{s.customers?.name}{unlocatedTag(s.id)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {unassignedStops.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: unassignedColor }} />
                  <p className="font-medium text-sm text-[#0F172A]">{t("Unassigned")}</p>
                  <span className="text-xs text-[#64748B]">({unassignedStops.length})</span>
                </div>
                <div className="space-y-1 pl-4 border-l-2 border-[#F1F5F9]">
                  {unassignedStops.map((s) => (
                    <div key={s.id} className="text-xs text-[#64748B] cursor-pointer hover:text-[#0891B2]" onClick={() => navigate(`/jobs/${s.id}`)}>
                      {s.scheduled_time ? `${s.scheduled_time.slice(0, 5)} · ` : ""}{s.customers?.name}{unlocatedTag(s.id)}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {mapJobs.length === 0 && <p className="text-sm text-[#64748B] text-center py-4">{t("No jobs scheduled this day")}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
