import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Plus, Calendar, LayoutDashboard, Truck, User, MapPin, Clock, Search, ChevronLeft, ChevronRight, Map as MapIcon, Navigation,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { jobTypes, callTypes, callSources } from "@/lib/data";
import { SearchableSelect } from "@/components/SearchableSelect";
import { jobsApi } from "@/lib/api/jobs";
import { profilesApi } from "@/lib/api/profiles";
import { customersApi } from "@/lib/api/customers";
import { recurringRoutesApi } from "@/lib/api/recurringRoutes";
import { geocodeAddress } from "@/lib/geocode";
import type { Database } from "@/lib/database.types";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Customer = Database["public"]["Tables"]["customers"]["Row"];
type Job = Database["public"]["Tables"]["jobs"]["Row"] & {
  customers: { name: string; address: string | null; lat?: number | null; lng?: number | null } | null;
  profiles: { name: string; avatar: string | null } | null;
};
type RecurringRoute = Database["public"]["Tables"]["recurring_routes"]["Row"] & {
  profiles: { name: string } | null;
};

const stages = [
  { id: "lead", label: "Lead", color: "bg-[#F59E0B]/10 border-t-[#F59E0B]" },
  { id: "booked", label: "Booked", color: "bg-[#0891B2]/10 border-t-[#0891B2]" },
  { id: "dispatched", label: "Dispatched", color: "bg-[#8B5CF6]/10 border-t-[#8B5CF6]" },
  { id: "in_progress", label: "In Progress", color: "bg-[#3B82F6]/10 border-t-[#3B82F6]" },
  { id: "completed", label: "Completed", color: "bg-[#16A34A]/10 border-t-[#16A34A]" },
];

const typeStyle = (label: string): React.CSSProperties => {
  const t = jobTypes.find((j) => j.label === label);
  const color = t?.color || "#0891B2";
  return { backgroundColor: `${color}1A`, color };
};

// Color identification by technician (not job type) across the Jobs & Dispatch views, per
// client request 2026-08-27 — each tech gets a stable color from this palette based on their id.
const techColorPalette = ["#0891B2", "#F59E0B", "#8B5CF6", "#3B82F6", "#16A34A", "#DC2626", "#EC4899", "#F97316"];
const unassignedColor = "#64748B";

const techStyle = (techId: string | null): React.CSSProperties => {
  if (!techId) return { backgroundColor: `${unassignedColor}1A`, color: unassignedColor };
  let hash = 0;
  for (let i = 0; i < techId.length; i++) hash = (hash * 31 + techId.charCodeAt(i)) >>> 0;
  const color = techColorPalette[hash % techColorPalette.length];
  return { backgroundColor: `${color}1A`, color };
};

const techDotColor = (techId: string): string => {
  let hash = 0;
  for (let i = 0; i < techId.length; i++) hash = (hash * 31 + techId.charCodeAt(i)) >>> 0;
  return techColorPalette[hash % techColorPalette.length];
};

export default function Jobs() {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<"pipeline" | "dispatch" | "schedule" | "map">(
    () => (searchParams.get("tab") as "pipeline" | "dispatch" | "schedule" | "map") || "pipeline",
  );

  useEffect(() => {
    if (searchParams.get("tab") === "schedule") setActiveTab("schedule");
  }, [searchParams]);
  const [search, setSearch] = useState("");
  const [newJobOpen, setNewJobOpen] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [technicians, setTechnicians] = useState<Profile[]>([]);
  const [recurringRoutes, setRecurringRoutes] = useState<RecurringRoute[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [newJob, setNewJob] = useState({ customerId: "", jobType: "", date: "", time: "", techId: "", description: "", amount: "", itemSku: "", laborSku: "" });
  const [mapDate, setMapDate] = useState(() => new Date().toISOString().slice(0, 10));
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
    profilesApi.list().then((data) => setTechnicians(data ?? []));
    customersApi.list().then((data) => setCustomers(data ?? []));
    recurringRoutesApi.list().then((data) => setRecurringRoutes(data ?? []));
  }, [loadJobs]);

  const handleCreateJob = async () => {
    if (!newJob.customerId || !newJob.jobType) return;
    await jobsApi.create({
      customerId: newJob.customerId,
      jobType: newJob.jobType,
      techId: newJob.techId || null,
      date: newJob.date || null,
      time: newJob.time || null,
      description: newJob.description || null,
      address: customers.find((c) => c.id === newJob.customerId)?.address ?? null,
      amount: parseFloat(newJob.amount) || 0,
      itemSku: newJob.itemSku || null,
      laborSku: newJob.laborSku || null,
    });
    setNewJob({ customerId: "", jobType: "", date: "", time: "", techId: "", description: "", amount: "", itemSku: "", laborSku: "" });
    setNewJobOpen(false);
    loadJobs();
  };

  const assignTech = async (jobId: string, techId: string) => {
    await jobsApi.update(jobId, { tech_id: techId, status: "Dispatched", stage: "dispatched" });
    loadJobs();
  };

  const shiftMapDate = (days: number) => {
    const d = new Date(mapDate + "T00:00:00");
    d.setDate(d.getDate() + days);
    setMapDate(d.toISOString().slice(0, 10));
  };

  const mapJobs = jobs.filter((j) => j.scheduled_date === mapDate);

  // Jobs map view (client request 2026-08-27): plot the selected day's jobs on a free
  // OpenStreetMap/Leaflet map (no Google Maps billing account available), color-coded by tech —
  // also doubles as the "daily route view" request via the per-tech stop list beside it.
  useEffect(() => {
    if (activeTab !== "map" || !mapContainerRef.current) return;
    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current).setView([30.2672, -97.7431], 11);
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

  useEffect(() => {
    if (activeTab !== "map" || !mapRef.current || !markersLayerRef.current) return;
    let cancelled = false;

    (async () => {
      const layer = markersLayerRef.current!;
      layer.clearLayers();
      const points: [number, number][] = [];

      for (const job of mapJobs) {
        let lat = job.customers?.lat ?? null;
        let lng = job.customers?.lng ?? null;
        if ((lat === null || lng === null) && job.address) {
          const result = await geocodeAddress(job.address);
          if (cancelled) return;
          if (result) {
            lat = result.lat;
            lng = result.lng;
            if (job.customer_id) customersApi.updateCoordinates(job.customer_id, lat, lng).catch(() => {});
          }
        }
        if (lat === null || lng === null) continue;
        points.push([lat, lng]);
        const color = job.tech_id ? techDotColor(job.tech_id) : unassignedColor;
        L.circleMarker([lat, lng], { radius: 9, color, fillColor: color, fillOpacity: 0.85, weight: 2 })
          .bindPopup(
            `<strong>${job.scheduled_time ?? ""} &middot; ${job.customers?.name ?? "Unknown"}</strong><br/>${job.type}<br/>Tech: ${job.profiles?.name ?? "Unassigned"}`
          )
          .addTo(layer);
      }

      if (points.length > 0) {
        mapRef.current!.fitBounds(points, { padding: [40, 40], maxZoom: 14 });
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, mapDate, jobs]);

  const routeByTech = technicians
    .map((t) => ({
      tech: t,
      stops: mapJobs
        .filter((j) => j.tech_id === t.id)
        .sort((a, b) => (a.scheduled_time ?? "").localeCompare(b.scheduled_time ?? "")),
    }))
    .filter((r) => r.stops.length > 0);
  const unassignedStops = mapJobs.filter((j) => !j.tech_id);

  const filteredJobs = jobs.filter((j) =>
    (j.customers?.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (j.address ?? "").toLowerCase().includes(search.toLowerCase()) ||
    j.type.toLowerCase().includes(search.toLowerCase())
  );

  const jobsByStage = (stage: string) => filteredJobs.filter((j) => j.stage === stage);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-[#0F172A]">Jobs & Dispatch</h1>
        <div className="flex items-center gap-2">
          <Dialog open={newJobOpen} onOpenChange={setNewJobOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#0891B2] hover:bg-[#0E7490] text-white gap-2 h-10">
                <Plus className="w-4 h-4" /> New Job
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader><DialogTitle>Create New Job</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label>Customer</Label>
                  <div className="mt-1">
                    <SearchableSelect
                      value={newJob.customerId}
                      onChange={(v) => setNewJob((p) => ({ ...p, customerId: v }))}
                      placeholder="Select customer"
                      searchPlaceholder="Search customers..."
                      options={customers.map((c) => ({ value: c.id, label: c.name, sublabel: [c.phone, c.address].filter(Boolean).join(" · ") || undefined }))}
                    />
                  </div>
                </div>
                <div>
                  <Label>Job Type</Label>
                  <Select value={newJob.jobType} onValueChange={(v) => setNewJob((p) => ({ ...p, jobType: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select job type" /></SelectTrigger>
                    <SelectContent>
                      {jobTypes.map((t) => (
                        <SelectItem key={t.id} value={t.label}>
                          <span className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ background: t.color }} />
                            {t.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Call Type</Label>
                    <Select>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select call type" /></SelectTrigger>
                      <SelectContent>
                        {callTypes.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Call Source</Label>
                    <Select>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select source" /></SelectTrigger>
                      <SelectContent>
                        {callSources.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Date</Label>
                    <Input type="date" className="mt-1" value={newJob.date} onChange={(e) => setNewJob((p) => ({ ...p, date: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Time</Label>
                    <Input type="time" className="mt-1" value={newJob.time} onChange={(e) => setNewJob((p) => ({ ...p, time: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label>Assign Technician</Label>
                  <Select value={newJob.techId} onValueChange={(v) => setNewJob((p) => ({ ...p, techId: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select tech" /></SelectTrigger>
                    <SelectContent>
                      {technicians.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Notes</Label>
                  <Input placeholder="Job description..." className="mt-1" value={newJob.description} onChange={(e) => setNewJob((p) => ({ ...p, description: e.target.value }))} />
                </div>
                <div>
                  <Label>Amount</Label>
                  <Input type="number" placeholder="0.00" className="mt-1" value={newJob.amount} onChange={(e) => setNewJob((p) => ({ ...p, amount: e.target.value }))} />
                  <p className="text-xs text-[#64748B] mt-1">Used for the invoice generated when this job is marked complete.</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Item SKU</Label>
                    <Input placeholder="e.g. HAY-SP15" className="mt-1" value={newJob.itemSku} onChange={(e) => setNewJob((p) => ({ ...p, itemSku: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Labor SKU</Label>
                    <Input placeholder="e.g. SVC-LABOR" className="mt-1" value={newJob.laborSku} onChange={(e) => setNewJob((p) => ({ ...p, laborSku: e.target.value }))} />
                  </div>
                </div>
                <Button className="w-full bg-[#0891B2] hover:bg-[#0E7490] text-white" onClick={handleCreateJob}>
                  Create Job
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
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
        <Input
          placeholder="Search jobs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-10 bg-white border-[#E2E8F0]"
        />
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
                    <span className="font-semibold text-sm text-[#0F172A]">{stage.label}</span>
                    <Badge className="bg-[#F1F5F9] text-[#64748B] text-[10px]">{stageJobs.length}</Badge>
                  </div>
                  <div className="bg-[#F8FAFC] rounded-b-lg border border-[#E2E8F0] border-t-0 p-2 space-y-2 min-h-[300px]">
                    {stageJobs.map((job) => (
                      <div
                        key={job.id}
                        className="bg-white rounded-lg p-3 border border-[#E2E8F0] shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => navigate(`/jobs/${job.id}`)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Badge className="text-[10px] px-1.5 py-0" style={techStyle(job.tech_id)}>{job.type}</Badge>
                          <div className="flex items-center gap-1.5">
                            {job.en_route_at && !job.arrived_at && !job.completed_at && (
                              <Navigation className="w-3.5 h-3.5 text-[#F59E0B]" aria-label="En route" />
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
            <h3 className="font-semibold text-[#0F172A] mb-3">Unassigned & Today's Jobs</h3>
            <div className="space-y-2">
              {filteredJobs.filter((j) => j.stage === "booked" || j.stage === "lead").map((job) => (
                <div key={job.id} className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge className="text-[10px] px-1.5 py-0" style={typeStyle(job.type)}>{job.type}</Badge>
                      <span className="text-xs text-[#64748B]">{job.scheduled_date} {job.scheduled_time}</span>
                    </div>
                    <p className="font-medium text-sm text-[#0F172A] mt-0.5">{job.customers?.name}</p>
                    <p className="text-xs text-[#64748B] truncate">{job.address}</p>
                  </div>
                  <div className="shrink-0">
                    <Select onValueChange={(v) => assignTech(job.id, v)}>
                      <SelectTrigger className="h-8 w-32 text-xs">
                        <SelectValue placeholder="Assign" />
                      </SelectTrigger>
                      <SelectContent>
                        {technicians.map((t) => (
                          <SelectItem key={t.id} value={t.id} className="text-xs">{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
              {filteredJobs.filter((j) => j.stage === "booked" || j.stage === "lead").length === 0 && (
                <p className="text-center text-[#64748B] py-4 text-sm">All jobs assigned</p>
              )}
            </div>
          </div>

          {/* Technicians */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-[#0F172A]">Technicians</h3>
              <p className="text-xs text-[#64748B] italic">Assigns nearest available based on live vehicle position</p>
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
                  <div key={tech.id} className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarFallback className="bg-[#0891B2] text-white text-sm">{tech.avatar}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm text-[#0F172A]">{tech.name}</p>
                        <Badge className={`${statusColors[tech.status] || ""} text-[10px] px-1.5 py-0`}>{tech.status}</Badge>
                      </div>
                      <p className="text-xs text-[#64748B]">{jobs.filter((j) => j.tech_id === tech.id).length} jobs today</p>
                    </div>
                    <div className="shrink-0 text-xs text-[#64748B]">
                      {tech.status === "On a job" && <div className="flex items-center gap-1"><Clock className="w-3 h-3" /> Active</div>}
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
          {/* Calendar Placeholder */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <button className="p-1 rounded hover:bg-[#F8FAFC]"><ChevronLeft className="w-4 h-4" /></button>
                <h3 className="font-semibold text-[#0F172A]">June 2024</h3>
                <button className="p-1 rounded hover:bg-[#F8FAFC]"><ChevronRight className="w-4 h-4" /></button>
              </div>
              <div className="flex items-center gap-3 text-xs">
                {technicians.map((t) => (
                  <div key={t.id} className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full" style={{ background: techDotColor(t.id) }} />
                    <span className="text-[#64748B]">{t.name}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-7 gap-2 text-center text-xs text-[#64748B] mb-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="font-semibold py-2">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 30 }, (_, i) => {
                const day = i + 1;
                const dayJobs = jobs.filter((j) => {
                  const jobDay = parseInt((j.scheduled_date ?? "").split("-")[2]);
                  return jobDay === day;
                });
                return (
                  <div
                    key={day}
                    className={`min-h-[80px] rounded-lg border border-[#E2E8F0] p-1.5 ${day === 20 ? "bg-[#0891B2]/5 border-[#0891B2]" : "bg-white"}`}
                  >
                    <span className={`text-xs font-medium ${day === 20 ? "text-[#0891B2]" : "text-[#0F172A]"}`}>{day}</span>
                    <div className="space-y-1 mt-1">
                      {dayJobs.slice(0, 3).map((j) => (
                        <div
                          key={j.id}
                          className="text-[10px] px-1.5 py-0.5 rounded cursor-pointer truncate"
                          style={techStyle(j.tech_id)}
                          title={j.description ?? `${j.type} — ${j.customers?.name ?? "Unassigned"}`}
                          onClick={() => navigate(`/jobs/${j.id}`)}
                        >
                          {j.scheduled_time} {j.customers?.name.split(" ")[0]}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recurring Routes */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-4">
            <h3 className="font-semibold text-[#0F172A] mb-3">Recurring Maintenance Routes</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {recurringRoutes.map((route) => (
                <div key={route.id} className="p-4 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-[#0F172A]">{route.name}</h4>
                    <Badge className="bg-[#0891B2]/10 text-[#0891B2] text-[10px] px-1.5 py-0">{route.frequency}</Badge>
                  </div>
                  <div className="space-y-1 text-sm text-[#64748B]">
                    <p className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {route.day}s</p>
                    <p className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> {route.profiles?.name}</p>
                    <p className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {route.customer_count} customers</p>
                    <p className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {route.avg_time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
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
              <Badge className="bg-[#F1F5F9] text-[#64748B] text-[10px]">{mapJobs.length} job{mapJobs.length === 1 ? "" : "s"}</Badge>
            </div>
            <div ref={mapContainerRef} className="w-full h-[480px] rounded-lg overflow-hidden" />
          </div>

          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-4 space-y-4 max-h-[560px] overflow-y-auto">
            <h3 className="font-semibold text-[#0F172A]">Daily Route by Technician</h3>
            {routeByTech.map(({ tech, stops }) => (
              <div key={tech.id}>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: techDotColor(tech.id) }} />
                  <p className="font-medium text-sm text-[#0F172A]">{tech.name}</p>
                  <span className="text-xs text-[#64748B]">({stops.length})</span>
                </div>
                <div className="space-y-1 pl-4 border-l-2 border-[#F1F5F9]">
                  {stops.map((s) => (
                    <div key={s.id} className="text-xs text-[#64748B] cursor-pointer hover:text-[#0891B2]" onClick={() => navigate(`/jobs/${s.id}`)}>
                      {s.scheduled_time} &middot; {s.customers?.name}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {unassignedStops.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: unassignedColor }} />
                  <p className="font-medium text-sm text-[#0F172A]">Unassigned</p>
                  <span className="text-xs text-[#64748B]">({unassignedStops.length})</span>
                </div>
                <div className="space-y-1 pl-4 border-l-2 border-[#F1F5F9]">
                  {unassignedStops.map((s) => (
                    <div key={s.id} className="text-xs text-[#64748B] cursor-pointer hover:text-[#0891B2]" onClick={() => navigate(`/jobs/${s.id}`)}>
                      {s.scheduled_time} &middot; {s.customers?.name}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {mapJobs.length === 0 && <p className="text-sm text-[#64748B] text-center py-4">No jobs scheduled this day</p>}
          </div>
        </div>
      )}
    </div>
  );
}
