import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, MapPin, Clock, User, Wrench, FileText, Camera,
  Plus, CheckCircle2, Circle, Send, Signature, Truck, DollarSign,
  Phone, MessageSquare, Mail, UserX, AlertCircle, Lock, ExternalLink,
  Barcode, Receipt, Info, Upload, Languages, RotateCw, Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  jobs, jobStatuses, jobTypes, cancellationReasons, rescheduleTypes,
} from "@/lib/data";
import { useTranslator } from "@/hooks/use-translator";
import { useLanguage } from "@/lib/language-context";
import { Loader2, RefreshCw } from "lucide-react";
import WaterTestingForm from "@/components/forms/WaterTestingForm";
import MaintenanceChecklist from "@/components/forms/MaintenanceChecklist";
import OneOffJobChecklist from "@/components/forms/OneOffJobChecklist";

type Lang = "en" | "es";

function TranslationPanel({
  lang, states, onRetry,
}: {
  lang: Lang;
  states: Record<Lang, { translation: string; loading: boolean; error: string | null }>;
  onRetry: () => void;
}) {
  const target: Lang = lang === "en" ? "es" : "en";
  const s = states[target];
  const targetLabel = target === "es" ? "Traducción al Español" : "English Translation";
  const sourceTag = target === "es" ? "ES" : "EN";

  return (
    <div className="p-3 rounded-lg bg-[#0891B2]/5 border border-[#0891B2]/20 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-[#0E7490] flex items-center gap-1.5">
          <Languages className="w-3.5 h-3.5" /> {targetLabel}
          <span className="ml-1 px-1.5 py-0.5 rounded bg-[#0891B2] text-white text-[10px] font-semibold">{sourceTag}</span>
        </p>
        {s.loading && <Loader2 className="w-3.5 h-3.5 text-[#0891B2] animate-spin" />}
      </div>
      {s.error ? (
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-[#EF4444] shrink-0" />
          <p className="text-xs text-[#B91C1C] flex-1">{s.error}</p>
          <button onClick={onRetry} className="text-[#0891B2] hover:text-[#0E7490]"><RefreshCw className="w-3.5 h-3.5" /></button>
        </div>
      ) : s.translation ? (
        <p className="text-sm text-[#0F172A]">{s.translation}</p>
      ) : !s.loading && (
        <p className="text-xs text-[#64748B] italic">Translating...</p>
      )}
    </div>
  );
}

const timelineSteps = [
  { id: "booked", label: "Booked", icon: Circle },
  { id: "en_route", label: "En route", icon: Truck },
  { id: "arrived", label: "Arrived", icon: MapPin },
  { id: "completed", label: "Completed", icon: CheckCircle2 },
];

const statusBadge = (status: string) => {
  const s = jobStatuses.find((j) => j.label === status || j.id === status);
  if (!s) return "bg-[#64748B]/10 text-[#64748B]";
  return `bg-[${s.color}]/10 text-[${s.color}]`;
};

const typeBadgeStyle = (type: string): React.CSSProperties => {
  const t = jobTypes.find((j) => j.label === type);
  const color = t?.color || "#0891B2";
  return { backgroundColor: `${color}1A`, color };
};

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const job = jobs.find((j) => j.id === id);
  const [activeTab, setActiveTab] = useState("trip_details");
  const [noteText, setNoteText] = useState("");
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const { lang, setLang, t } = useLanguage();
  const { states: trStates, translateDebounced } = useTranslator();

  // When user types a note, translate to the OTHER language in real time
  const handleNoteChange = (val: string) => {
    setNoteText(val);
    const target: "en" | "es" = lang === "en" ? "es" : "en";
    translateDebounced(val, lang, target);
  };

  // When toggling language while a note exists, re-translate for the new direction
  const handleLangToggle = (newLang: "en" | "es") => {
    setLang(newLang);
    if (noteText.trim()) {
      const target: "en" | "es" = newLang === "en" ? "es" : "en";
      translateDebounced(noteText, newLang, target, 100);
    }
  };

  if (!job) {
    return (
      <div className="text-center py-20">
        <p className="text-[#64748B]">Job not found</p>
        <Button onClick={() => navigate("/jobs")} className="mt-4 bg-[#0891B2] text-white">Back to Jobs</Button>
      </div>
    );
  }

  const contentTabs = [
    { id: "trip_details", label: "Trip Details", icon: Truck },
    { id: "documents", label: "Documents", icon: FileText },
    { id: "customer_not_available", label: "Customer Not Available", icon: UserX },
    { id: "known_issue", label: "Known Issue", icon: AlertCircle },
    { id: "private", label: "Private", icon: Lock },
    { id: "customer_portal", label: "Customer Portal", icon: ExternalLink },
    { id: "before_after", label: "Before / After Photos", icon: Camera },
    { id: "model_serial", label: "Model & Serial", icon: Barcode },
    { id: "receipts", label: "Receipts", icon: Receipt },
    { id: "extra_job_info", label: "Extra Job Info", icon: Info },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <button onClick={() => navigate("/jobs")} className="p-2 rounded-lg hover:bg-[#F8FAFC] text-[#64748B] self-start">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <h1 className="text-xl font-bold text-[#0F172A]">Job {job.id.toUpperCase()}</h1>
            <Badge className="text-[10px] px-1.5 py-0" style={typeBadgeStyle(job.type)}>{job.type}</Badge>
            <Badge className={`${statusBadge(job.status)} text-[10px] px-1.5 py-0`}>{job.status}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="h-9 gap-2 border-[#E2E8F0] text-[#0F172A]"
            onClick={() => setRescheduleOpen(!rescheduleOpen)}
          >
            <RotateCw className="w-4 h-4" />
            <span className="hidden sm:inline">Reschedule</span>
          </Button>
          <Button variant="outline" className="gap-2 h-9 border-[#E2E8F0] hover:bg-[#F8FAFC]" onClick={() => navigate("/jobs")}>
            <Copy className="w-4 h-4" />
            <span className="hidden sm:inline">Clone Job</span>
          </Button>
          <Button className="bg-[#16A34A] hover:bg-[#15803D] text-white gap-2 h-9">
            <CheckCircle2 className="w-4 h-4" />
            <span className="hidden sm:inline">{t("Mark Complete & Generate Invoice")}</span>
            <span className="sm:hidden">Complete</span>
          </Button>
        </div>
      </div>

      {/* Reschedule panel */}
      {rescheduleOpen && (
        <Card className="border-[#F59E0B]/30 bg-[#F59E0B]/5 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <RotateCw className="w-4 h-4 text-[#F59E0B]" />
              <h3 className="font-semibold text-[#0F172A] text-sm">Reschedule Job</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Reschedule Type</Label>
                <Select>
                  <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="Select reason" /></SelectTrigger>
                  <SelectContent>
                    {rescheduleTypes.map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">New Date & Time</Label>
                <Input type="datetime-local" className="mt-1 h-9" />
              </div>
            </div>
            <Textarea placeholder="Reschedule notes..." className="text-sm" rows={2} />
            <div className="flex gap-2">
              <Button size="sm" className="bg-[#F59E0B] hover:bg-[#D97706] text-white">Confirm Reschedule</Button>
              <Button size="sm" variant="outline" onClick={() => setRescheduleOpen(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Job Details */}
          <Card className="border-[#E2E8F0] shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-[#0F172A]">{t("Job Details")}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#0891B2]/10 flex items-center justify-center">
                    <User className="w-5 h-5 text-[#0891B2]" />
                  </div>
                  <div>
                    <p className="text-xs text-[#64748B]">{t("Customer")}</p>
                    <button onClick={() => navigate(`/customers/${job.customerId}`)} className="font-medium text-[#0F172A] hover:text-[#0891B2] transition-colors">
                      {job.customerName}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#0891B2]/10 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-[#0891B2]" />
                  </div>
                  <div>
                    <p className="text-xs text-[#64748B]">{t("Scheduled")}</p>
                    <p className="font-medium text-[#0F172A]">{job.date} at {job.time}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#0891B2]/10 flex items-center justify-center">
                    <Truck className="w-5 h-5 text-[#0891B2]" />
                  </div>
                  <div>
                    <p className="text-xs text-[#64748B]">{t("Assigned")}</p>
                    <div className="flex items-center gap-1.5">
                      <Avatar className="w-5 h-5">
                        <AvatarFallback className="bg-[#0891B2] text-white text-[10px]">{job.techAvatar}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-[#0F172A]">{job.tech}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#0891B2]/10 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-[#0891B2]" />
                  </div>
                  <div>
                    <p className="text-xs text-[#64748B]">{t("Address")}</p>
                    <p className="font-medium text-[#0F172A]">{job.address}</p>
                  </div>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                <p className="text-sm font-medium text-[#0F172A] mb-1">{t("Description")}</p>
                <p className="text-sm text-[#64748B]">{job.description}</p>
              </div>
            </CardContent>
          </Card>

          {/* Content Categories Tabs */}
          <Card className="border-[#E2E8F0] shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-[#0F172A]">Content Categories</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="bg-[#F8FAFC] border border-[#E2E8F0] h-auto p-1 flex flex-wrap gap-1">
                  {contentTabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <TabsTrigger
                        key={tab.id}
                        value={tab.id}
                        className="text-xs data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-3 py-1.5 gap-1.5"
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {tab.label}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>

                {/* Trip Details */}
                <TabsContent value="trip_details" className="mt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Departure Time</Label>
                      <Input type="time" className="mt-1 h-9" />
                    </div>
                    <div>
                      <Label className="text-xs">Arrival Time</Label>
                      <Input type="time" className="mt-1 h-9" />
                    </div>
                    <div>
                      <Label className="text-xs">Travel Miles</Label>
                      <Input type="number" placeholder="0.0" className="mt-1 h-9" />
                    </div>
                    <div>
                      <Label className="text-xs">Vehicle</Label>
                      <Select>
                        <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="Assign vehicle" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="v1">Truck 1 — Ford Transit</SelectItem>
                          <SelectItem value="v2">Truck 2 — Ram Promaster</SelectItem>
                          <SelectItem value="v3">Truck 3 — Chevy Express</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </TabsContent>

                {/* Documents */}
                <TabsContent value="documents" className="mt-4 space-y-3">
                  <div className="border-2 border-dashed border-[#E2E8F0] rounded-lg p-6 text-center">
                    <Upload className="w-8 h-8 text-[#64748B] mx-auto mb-2" />
                    <p className="text-sm font-medium text-[#0F172A]">Upload job documents</p>
                    <p className="text-xs text-[#64748B] mt-1">PDFs, contracts, permits, work orders</p>
                    <Button variant="outline" size="sm" className="mt-3 gap-2">
                      <Plus className="w-4 h-4" /> Add Document
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {["Work Order - signed.pdf", "Permit - City of Austin.pdf"].map((doc) => (
                      <div key={doc} className="flex items-center gap-3 p-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                        <FileText className="w-4 h-4 text-[#0891B2] shrink-0" />
                        <span className="text-sm text-[#0F172A] flex-1 truncate">{doc}</span>
                        <button className="text-xs text-[#0891B2] font-medium hover:underline">View</button>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                {/* Customer Not Available */}
                <TabsContent value="customer_not_available" className="mt-4 space-y-3">
                  <div className="rounded-lg bg-[#EF4444]/5 border border-[#EF4444]/20 p-3 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-[#EF4444] shrink-0 mt-0.5" />
                    <p className="text-xs text-[#B91C1C]">Mark this job if the customer was not home or unavailable. A cancellation reason is required.</p>
                  </div>
                  <div>
                    <Label className="text-xs">Cancellation Reason</Label>
                    <Select>
                      <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="Select reason" /></SelectTrigger>
                      <SelectContent>
                        {cancellationReasons.map((r) => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Door Tag Left?</Label>
                    <div className="flex gap-2 mt-1">
                      <Button size="sm" variant="outline" className="h-8">Yes — Photo Logged</Button>
                      <Button size="sm" variant="outline" className="h-8">No</Button>
                    </div>
                  </div>
                  <Textarea placeholder="Notes for office / dispatch..." className="text-sm" rows={3} />
                </TabsContent>

                {/* Known Issue */}
                <TabsContent value="known_issue" className="mt-4 space-y-3">
                  <div className="rounded-lg bg-[#F59E0B]/5 border border-[#F59E0B]/20 p-3 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-[#F59E0B] shrink-0 mt-0.5" />
                    <p className="text-xs text-[#B45309]">Recurring or known issues at this property. Visible to all technicians.</p>
                  </div>
                  <div className="space-y-2">
                    {[
                      "Gate code: #4291 (side entrance only)",
                      "Dog in backyard — ask owner to secure before service",
                      "Pool equipment pad is behind the shed",
                    ].map((issue) => (
                      <div key={issue} className="flex items-center gap-2 p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                        <AlertCircle className="w-4 h-4 text-[#F59E0B] shrink-0" />
                        <span className="text-sm text-[#0F172A] flex-1">{issue}</span>
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Plus className="w-4 h-4" /> Add Known Issue
                  </Button>
                </TabsContent>

                {/* Private */}
                <TabsContent value="private" className="mt-4 space-y-3">
                  <div className="rounded-lg bg-[#6366F1]/5 border border-[#6366F1]/20 p-3 flex items-start gap-2">
                    <Lock className="w-4 h-4 text-[#6366F1] shrink-0 mt-0.5" />
                    <p className="text-xs text-[#4338CA]">Private notes visible to office staff only. Not shown to technicians or customers.</p>
                  </div>
                  <Textarea placeholder="Private internal notes..." className="text-sm" rows={5} />
                </TabsContent>

                {/* Customer Portal */}
                <TabsContent value="customer_portal" className="mt-4 space-y-3">
                  <div className="rounded-lg bg-[#0891B2]/5 border border-[#0891B2]/20 p-3 flex items-start gap-2">
                    <ExternalLink className="w-4 h-4 text-[#0891B2] shrink-0 mt-0.5" />
                    <p className="text-xs text-[#0E7490]">Customer-visible job info. This is what the customer sees in their portal.</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                      <span className="text-sm text-[#0F172A]">Portal status visible to customer</span>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                      <span className="text-sm text-[#0F172A]">Show before/after photos</span>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                      <span className="text-sm text-[#0F172A]">Allow online payment</span>
                      <Switch defaultChecked />
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="gap-2">
                    <ExternalLink className="w-4 h-4" /> Open Customer Portal Preview
                  </Button>
                </TabsContent>

                {/* Before / After Photos */}
                <TabsContent value="before_after" className="mt-4 space-y-4">
                  <div>
                    <p className="text-sm font-medium text-[#0F172A] mb-2">Before</p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {[1, 2].map((i) => (
                        <div key={i} className="aspect-square rounded-lg bg-[#F1F5F9] flex items-center justify-center">
                          <Camera className="w-5 h-5 text-[#64748B]" />
                        </div>
                      ))}
                      <div className="aspect-square rounded-lg bg-[#F1F5F9] border border-dashed border-[#E2E8F0] flex items-center justify-center cursor-pointer hover:bg-[#E2E8F0]">
                        <Plus className="w-5 h-5 text-[#64748B]" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#0F172A] mb-2">After</p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="aspect-square rounded-lg bg-[#F1F5F9] flex items-center justify-center">
                          <Camera className="w-5 h-5 text-[#64748B]" />
                        </div>
                      ))}
                      <div className="aspect-square rounded-lg bg-[#F1F5F9] border border-dashed border-[#E2E8F0] flex items-center justify-center cursor-pointer hover:bg-[#E2E8F0]">
                        <Plus className="w-5 h-5 text-[#64748B]" />
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Model & Serial */}
                <TabsContent value="model_serial" className="mt-4 space-y-3">
                  <div className="space-y-2">
                    {[
                      { equip: "Pump", model: "Hayward Super Pump SP1515", serial: "SP1515-2023-0892" },
                      { equip: "Filter", model: "Pentair Clean & Clear 200", serial: "CC200-2022-4471" },
                      { equip: "Heater", model: "Raypak 266K BTU", serial: "RP-266-2024-0123" },
                    ].map((item) => (
                      <div key={item.equip} className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                        <div className="flex items-center gap-2 mb-1">
                          <Barcode className="w-4 h-4 text-[#0891B2]" />
                          <span className="text-sm font-semibold text-[#0F172A]">{item.equip}</span>
                        </div>
                        <p className="text-xs text-[#64748B]">Model: <span className="text-[#0F172A] font-medium">{item.model}</span></p>
                        <p className="text-xs text-[#64748B]">Serial: <span className="text-[#0F172A] font-mono">{item.serial}</span></p>
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Plus className="w-4 h-4" /> Add Equipment
                  </Button>
                </TabsContent>

                {/* Receipts */}
                <TabsContent value="receipts" className="mt-4 space-y-3">
                  <div className="border-2 border-dashed border-[#E2E8F0] rounded-lg p-6 text-center">
                    <Receipt className="w-8 h-8 text-[#64748B] mx-auto mb-2" />
                    <p className="text-sm font-medium text-[#0F172A]">Upload or attach receipts</p>
                    <p className="text-xs text-[#64748B] mt-1">Parts purchased, fuel, materials for this job</p>
                    <Button variant="outline" size="sm" className="mt-3 gap-2">
                      <Plus className="w-4 h-4" /> Add Receipt
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {[
                      { name: "Pump seal kit — PoolMart", amount: 32.99 },
                      { name: "Pipe fittings — Home Depot", amount: 14.47 },
                    ].map((r) => (
                      <div key={r.name} className="flex items-center gap-3 p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                        <Receipt className="w-4 h-4 text-[#0891B2] shrink-0" />
                        <span className="text-sm text-[#0F172A] flex-1">{r.name}</span>
                        <span className="text-sm font-semibold text-[#0F172A]">${r.amount}</span>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                {/* Extra Job Info */}
                <TabsContent value="extra_job_info" className="mt-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Job Priority</Label>
                      <Select defaultValue="normal">
                        <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="emergency">Emergency</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Estimated Duration</Label>
                      <Input placeholder="e.g. 2.5 hrs" className="mt-1 h-9" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Access Notes</Label>
                    <Textarea placeholder="How to access the property, gate codes, parking..." className="mt-1 text-sm" rows={2} />
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Service Forms — shown based on job type */}
          {job.type === "Maintenance" && (
            <div className="space-y-4">
              <WaterTestingForm />
              <MaintenanceChecklist />
            </div>
          )}
          {(job.type === "Repair" || job.type === "Install" || job.type === "Equipment Service" || job.type === "Renovation / Remodel") && (
            <OneOffJobChecklist />
          )}
          {(job.type !== "Maintenance" && job.type !== "Repair" && job.type !== "Install" && job.type !== "Equipment Service" && job.type !== "Renovation / Remodel") && (
            <div className="space-y-4">
              <WaterTestingForm />
              <MaintenanceChecklist />
              <OneOffJobChecklist />
            </div>
          )}

          {/* Line Items */}
          <Card className="border-[#E2E8F0] shadow-sm">
            <CardHeader className="pb-3 flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-[#0F172A]">{t("Line Items")}</CardTitle>
              <Button variant="ghost" size="sm" className="h-8 gap-1 text-[#0891B2]"><Plus className="w-4 h-4" /> Add</Button>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="divide-y divide-[#F1F5F9]">
                <div className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <Wrench className="w-4 h-4 text-[#0891B2]" />
                    <div>
                      <p className="text-sm font-medium text-[#0F172A]">Labor - {job.type}</p>
                      <p className="text-xs text-[#64748B]">1.5 hrs @ $85/hr</p>
                    </div>
                  </div>
                  <span className="font-semibold text-[#0F172A]">$127.50</span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-[#0891B2]" />
                    <div>
                      <p className="text-sm font-medium text-[#0F172A]">Parts & Materials</p>
                      <p className="text-xs text-[#64748B]">From inventory</p>
                    </div>
                  </div>
                  <span className="font-semibold text-[#0F172A]">$17.50</span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-sm font-medium text-[#0F172A]">Subtotal</span>
                  <span className="font-semibold text-[#0F172A]">$145.00</span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-sm text-[#64748B]">Tax (8.25%)</span>
                  <span className="text-sm text-[#0F172A]">$11.96</span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-base font-semibold text-[#0F172A]">Total</span>
                  <span className="text-base font-bold text-[#0891B2]">$156.96</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Language-aware notes section with real translation */}
          <Card className="border-[#E2E8F0] shadow-sm">
            <CardHeader className="pb-3 flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-[#0F172A]">
                {lang === "es" ? "Notas del Trabajo" : "Job Notes"}
              </CardTitle>
              <div className="flex items-center rounded-lg border border-[#E2E8F0] overflow-hidden h-7">
                <button onClick={() => handleLangToggle("en")} className={`px-2.5 h-full text-xs font-medium ${lang === "en" ? "bg-[#0891B2] text-white" : "text-[#64748B]"}`}>EN</button>
                <button onClick={() => handleLangToggle("es")} className={`px-2.5 h-full text-xs font-medium ${lang === "es" ? "bg-[#0891B2] text-white" : "text-[#64748B]"}`}>ES</button>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <Textarea
                value={noteText}
                onChange={(e) => handleNoteChange(e.target.value)}
                placeholder={lang === "es" ? "Escribir notas en español..." : "Write notes in English..."}
                className="text-sm"
                rows={4}
              />
              {noteText.trim() && (
                <TranslationPanel
                  lang={lang}
                  states={trStates}
                  onRetry={() => {
                    const target: "en" | "es" = lang === "en" ? "es" : "en";
                    translateDebounced(noteText, lang, target, 0);
                  }}
                />
              )}
            </CardContent>
          </Card>

          {/* Customer Signature */}
          <Card className="border-[#E2E8F0] shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-[#0F172A]">{t("Customer Signature")}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="h-32 rounded-lg bg-[#F1F5F9] border border-dashed border-[#E2E8F0] flex items-center justify-center">
                <div className="text-center">
                  <Signature className="w-6 h-6 text-[#64748B] mx-auto mb-1" />
                  <p className="text-sm text-[#64748B]">{t("Customer Signature on completion")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Status Timeline */}
          <Card className="border-[#E2E8F0] shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-[#0F172A]">{t("Status Timeline")}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-0">
                {timelineSteps.map((step, idx) => {
                  const isComplete =
                    job.stage === "completed" ? true :
                    job.stage === "in_progress" ? idx < 3 :
                    job.stage === "dispatched" ? idx < 2 :
                    job.stage === "booked" ? idx < 1 : false;
                  const isCurrent =
                    job.stage === "completed" ? idx === 3 :
                    job.stage === "in_progress" ? idx === 2 :
                    job.stage === "dispatched" ? idx === 1 :
                    job.stage === "booked" ? idx === 0 : false;
                  const Icon = step.icon;
                  return (
                    <div key={step.id} className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          isComplete ? "bg-[#16A34A] text-white" : isCurrent ? "bg-[#0891B2] text-white" : "bg-[#F1F5F9] text-[#64748B]"
                        }`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        {idx < timelineSteps.length - 1 && (
                          <div className={`w-0.5 h-6 ${isComplete ? "bg-[#16A34A]" : "bg-[#E2E8F0]"}`} />
                        )}
                      </div>
                      <div className="pb-4">
                        <p className={`text-sm font-medium ${isComplete || isCurrent ? "text-[#0F172A]" : "text-[#64748B]"}`}>
                          {step.label}
                        </p>
                        {isCurrent && <p className="text-xs text-[#0891B2]">Current</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Status Changer */}
          <Card className="border-[#E2E8F0] shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-[#0F172A]">Update Status</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <Select defaultValue={job.status.toLowerCase().replace(/[^a-z]+/g, "_")}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {jobStatuses.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                        {s.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Automated Notifications */}
          <Card className="border-[#E2E8F0] shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-[#0F172A]">{t("Automated Notifications")}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              {[
                { label: "Booking confirmed", enabled: true },
                { label: "Technician en route", enabled: job.stage === "dispatched" || job.stage === "in_progress" || job.stage === "completed" },
                { label: "Job completed", enabled: job.stage === "completed" },
              ].map((notif) => (
                <div key={notif.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Send className="w-4 h-4 text-[#64748B]" />
                    <Label className="text-sm text-[#0F172A]">{t(notif.label)}</Label>
                  </div>
                  <Switch checked={notif.enabled} />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="border-[#E2E8F0] shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-[#0F172A]">{t("Quick Actions")}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              <Button variant="outline" className="w-full justify-start gap-2 h-10 border-[#E2E8F0] text-[#0F172A]">
                <Phone className="w-4 h-4 text-[#0891B2]" /> {t("Call Customer")}
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2 h-10 border-[#E2E8F0] text-[#0F172A]">
                <MessageSquare className="w-4 h-4 text-[#0891B2]" /> {t("Text Customer")}
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2 h-10 border-[#E2E8F0] text-[#0F172A]">
                <Mail className="w-4 h-4 text-[#0891B2]" /> {t("Email Customer")}
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2 h-10 border-[#E2E8F0] text-[#0F172A]">
                <DollarSign className="w-4 h-4 text-[#0891B2]" /> {t("View Invoice")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
