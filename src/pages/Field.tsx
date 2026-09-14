import { useState, useEffect, useCallback, useRef } from "react";
import {
  ArrowLeft, MapPin, Clock, Phone, Camera, CheckCircle2, Navigation,
  ChevronRight, Wrench, User, DollarSign, Minus, Plus, Eraser,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { jobsApi, type JobLineItem, type JobForm } from "@/lib/api/jobs";
import { customersApi } from "@/lib/api/customers";
import { invoicingApi } from "@/lib/api/invoicing";
import { inventoryApi, type ItemWithStock } from "@/lib/api/inventory";
import { formTemplatesApi, type FormTemplate } from "@/lib/api/formTemplates";
import { libraryApi, type LibraryDocument } from "@/lib/api/library";
import DynamicForm from "@/components/DynamicForm";
import DocumentsSection, { type DocumentAttachment } from "@/components/DocumentsSection";
import { supabase } from "@/lib/supabase";
import { useAuth, isFieldOnlyRole } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import type { Database } from "@/lib/database.types";

type Job = Database["public"]["Tables"]["jobs"]["Row"] & { customers: { name: string; address: string | null } | null };

const typeColors: Record<string, string> = {
  Maintenance: "bg-[#0891B2]/10 text-[#0891B2]",
  Repair: "bg-[#F59E0B]/10 text-[#F59E0B]",
  Install: "bg-[#8B5CF6]/10 text-[#8B5CF6]",
};

const statusSteps = [
  { id: "en_route", label: "En Route", action: "Navigate to Site", icon: Navigation },
  { id: "arrived", label: "Arrived", action: "I've Arrived", icon: MapPin },
  { id: "completed", label: "Complete", action: "Complete Job", icon: CheckCircle2 },
];

export default function Field() {
  const navigate = useNavigate();
  const { profileId, tenantId, user, role } = useAuth();
  const { t } = useLanguage();
  const fieldOnly = isFieldOnlyRole(role);
  const [myJobs, setMyJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<"dispatched" | "en_route" | "arrived" | "completed">("dispatched");
  const [photos, setPhotos] = useState<{ id: string; url: string }[]>([]);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<ItemWithStock[]>([]);
  const [partsUsed, setPartsUsed] = useState<Record<string, number>>({});
  const [partsSearch, setPartsSearch] = useState("");

  // Client feedback 2026-09-11: Field view was missing the job's line items, its forms, and its
  // documents -- techs only ever work from this page, not the desktop JobDetail.
  const [jobLineItems, setJobLineItems] = useState<JobLineItem[]>([]);
  const [jobForms, setJobForms] = useState<JobForm[]>([]);
  const [allTemplates, setAllTemplates] = useState<FormTemplate[]>([]);
  const [jobDocuments, setJobDocuments] = useState<DocumentAttachment[]>([]);
  const [docsUploading, setDocsUploading] = useState(false);
  const [libraryDocuments, setLibraryDocuments] = useState<LibraryDocument[]>([]);
  const [formError, setFormError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);

  const loadMyJobs = useCallback(async () => {
    if (!profileId) return;
    setIsLoading(true);
    const data = await jobsApi.mine();
    const list = (data ?? []) as Job[];
    setMyJobs(list);
    setActiveJobId((prev) => prev ?? (list.length > 0 ? list[0].id : null));
    setIsLoading(false);
  }, [profileId]);

  useEffect(() => {
    loadMyJobs();
  }, [loadMyJobs]);

  useEffect(() => {
    inventoryApi.summary().then((data) => setInventoryItems(data.items));
    formTemplatesApi.list().then(setAllTemplates);
    libraryApi.list().then(setLibraryDocuments);
  }, []);

  const currentJob = myJobs.find((j) => j.id === activeJobId) ?? null;
  const currentStepIdx = statusSteps.findIndex((s) => s.id === jobStatus);

  const selectJob = (job: Job) => {
    setActiveJobId(job.id);
    setJobStatus(job.status === "In Progress" ? "en_route" : "dispatched");
    setNotes("");
    setSignatureUrl(null);
    setPartsUsed({});
    setFormError("");
    jobsApi.getAttachments(job.id).then((attachments) => {
      setPhotos(attachments.filter((a) => a.type === "photo").map((a) => ({ id: a.id, url: a.url })));
      const sig = attachments.find((a) => a.type === "signature");
      setSignatureUrl(sig?.url ?? null);
      setJobDocuments(attachments.filter((a) => a.type === "document"));
    });
    jobsApi.getLineItems(job.id).then(setJobLineItems);
    jobsApi.getForms(job.id).then(setJobForms);
  };

  const uploadAttachment = async (jobId: string, file: Blob, filename: string, type: "photo" | "signature") => {
    const path = `${tenantId}/${jobId}/${type}-${Date.now()}-${filename}`;
    const { error } = await supabase.storage.from("job-attachments").upload(path, file);
    if (error) throw error;
    const { data } = supabase.storage.from("job-attachments").getPublicUrl(path);
    return jobsApi.addAttachment(jobId, { type, url: data.publicUrl });
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentJob || !e.target.files) return;
    for (const file of Array.from(e.target.files)) {
      const attachment = await uploadAttachment(currentJob.id, file, file.name, "photo");
      setPhotos((prev) => [...prev, { id: attachment.id, url: attachment.url }]);
    }
    e.target.value = "";
  };

  const clearSignatureCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawingRef.current = true;
    const ctx = canvasRef.current?.getContext("2d");
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!ctx || !rect) return;
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!ctx || !rect) return;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0F172A";
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const endDraw = () => {
    drawingRef.current = false;
  };

  const saveSignature = async () => {
    if (!currentJob || !canvasRef.current) return;
    canvasRef.current.toBlob(async (blob) => {
      if (!blob) return;
      const attachment = await uploadAttachment(currentJob.id, blob, "signature.png", "signature");
      setSignatureUrl(attachment.url);
    }, "image/png");
  };

  const adjustPart = (itemId: string, delta: number) => {
    setPartsUsed((prev) => {
      const next = Math.max(0, (prev[itemId] ?? 0) + delta);
      return { ...prev, [itemId]: next };
    });
  };

  // Client feedback 2026-09-11: forms weren't reachable here at all (Field techs never see
  // desktop JobDetail) -- same suggested-templates rule as JobDetail: any template with no
  // applies_to, or matching this job's type.
  const suggestedTemplates = currentJob ? allTemplates.filter((t) => t.applies_to === currentJob.type || t.applies_to === null) : [];
  const missingRequiredTemplates = suggestedTemplates.filter((t) => t.required && !jobForms.some((f) => f.template_id === t.id));

  const handleSaveForm = async (template: FormTemplate, data: Record<string, unknown>) => {
    if (!currentJob) return;
    const notesField = template.fields.find((f) => /notes/i.test(f.id) || /notes/i.test(f.label));
    const formNotes = notesField ? (data[notesField.id] as string | undefined) ?? null : null;
    await jobsApi.saveForm(currentJob.id, template.name, data, formNotes, template.id);
    jobsApi.getForms(currentJob.id).then(setJobForms);
    setFormError("");
  };

  const handleFormPhotoUpload = async (file: File): Promise<string> => {
    if (!currentJob || !tenantId) throw new Error("Not ready");
    const path = `${tenantId}/${currentJob.id}/forms/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("job-attachments").upload(path, file);
    if (error) throw error;
    const { data } = supabase.storage.from("job-attachments").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleUploadDocument = async (file: File, label: string) => {
    if (!currentJob || !tenantId) return;
    setDocsUploading(true);
    try {
      const path = `${tenantId}/${currentJob.id}/document-${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("job-attachments").upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from("job-attachments").getPublicUrl(path);
      await jobsApi.addAttachment(currentJob.id, { type: "document", url: data.publicUrl, label, filename: file.name });
      jobsApi.getAttachments(currentJob.id).then((docs) => setJobDocuments(docs.filter((a) => a.type === "document")));
    } finally {
      setDocsUploading(false);
    }
  };

  const handleAttachLibraryDocument = async (doc: LibraryDocument) => {
    if (!currentJob) return;
    await jobsApi.addAttachment(currentJob.id, { type: "document", url: doc.url, label: doc.name, filename: doc.filename });
    jobsApi.getAttachments(currentJob.id).then((docs) => setJobDocuments(docs.filter((a) => a.type === "document")));
  };

  const advanceStatus = async () => {
    if (!currentJob) return;
    const next = statusSteps[currentStepIdx + 1];
    if (!next) return;

    if (next.id === "completed" && missingRequiredTemplates.length > 0) {
      setFormError(`Submit the required form${missingRequiredTemplates.length > 1 ? "s" : ""} first: ${missingRequiredTemplates.map((t) => t.name).join(", ")}`);
      return;
    }

    if (next.id === "en_route") {
      await jobsApi.update(currentJob.id, { status: "In Progress", stage: "in_progress", en_route_at: new Date().toISOString() });
    }

    if (next.id === "arrived") {
      await jobsApi.update(currentJob.id, { arrived_at: new Date().toISOString() });
    }

    if (next.id === "completed") {
      await jobsApi.update(currentJob.id, { status: "Completed", stage: "completed", completed_at: new Date().toISOString() });
      if (notes.trim()) {
        await customersApi.addNote(currentJob.customer_id, { text: notes.trim(), author: user?.name ?? "Technician" });
      }
      const usedItems = Object.entries(partsUsed)
        .filter(([, qty]) => qty > 0)
        .map(([itemId, quantity]) => ({ itemId, quantity }));
      if (usedItems.length > 0) {
        await jobsApi.addParts(currentJob.id, usedItems);
      }
    }

    setJobStatus(next.id as typeof jobStatus);
  };

  const generateInvoice = async () => {
    if (!currentJob) return;
    setGeneratingInvoice(true);
    const issueDate = new Date().toISOString().slice(0, 10);
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14);
    const number = `INV-${issueDate.replace(/-/g, "")}-${currentJob.id.slice(0, 4).toUpperCase()}`;

    try {
      const invoice = await invoicingApi.create({
        customerId: currentJob.customer_id,
        jobId: currentJob.id,
        number,
        issueDate,
        dueDate: dueDate.toISOString().slice(0, 10),
        amount: currentJob.amount,
        status: "Sent",
      });
      setGeneratingInvoice(false);
      navigate(`/invoicing/${invoice.id}`);
    } catch {
      setGeneratingInvoice(false);
    }
  };

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        {!fieldOnly && (
          <button onClick={() => navigate("/jobs")} className="p-2 rounded-lg hover:bg-[#F8FAFC] text-[#64748B]">
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <h1 className="text-xl font-bold text-[#0F172A]">{t("My Day")}</h1>
        <div className="ml-auto flex items-center gap-3">
          {/* Client request 2026-09-03: "On the phone app be able to toggle between admin and
              tech view" — jumps straight to the full desktop-style Dashboard/nav. Client feedback
              2026-09-11: technician/contractor role accounts are field-only now (ProtectedRoute
              bounces them back), so this toggle only makes sense for admin/manager roles who are
              previewing the field view themselves. */}
          {!fieldOnly && (
            <button
              onClick={() => navigate("/dashboard")}
              className="text-xs font-medium text-[#0891B2] border border-[#0891B2]/30 rounded-md px-2 py-1 hover:bg-[#0891B2]/10"
            >
              {t("Admin View")}
            </button>
          )}
          <div className="flex items-center gap-1 text-sm text-[#64748B]">
            <Clock className="w-4 h-4" />
            <span>{myJobs.length} {t("jobs")}</span>
          </div>
        </div>
      </div>

      {isLoading && <div className="text-center py-8 text-[#64748B]">{t("Loading your jobs...")}</div>}

      {!isLoading && myJobs.length === 0 && (
        <div className="text-center py-12 text-[#64748B]">{t("No active jobs assigned to you")}</div>
      )}

      {/* Job List - Compact */}
      <div className="space-y-2">
        {myJobs.map((job) => (
          <button
            key={job.id}
            onClick={() => selectJob(job)}
            className={`w-full text-left p-3 rounded-xl border transition-all ${
              activeJobId === job.id ? "border-[#0891B2] bg-[#0891B2]/5" : "border-[#E2E8F0] bg-white hover:bg-[#F8FAFC]"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                job.status === "Completed" ? "bg-[#16A34A]/10" : "bg-[#0891B2]/10"
              }`}>
                <Wrench className={`w-5 h-5 ${job.status === "Completed" ? "text-[#16A34A]" : "text-[#0891B2]"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm text-[#0F172A] truncate">{job.customers?.name ?? "—"}</p>
                  <Badge className={`${typeColors[job.type] ?? "bg-[#F1F5F9] text-[#64748B]"} text-[10px] px-1.5 py-0`}>{job.type}</Badge>
                </div>
                <p className="text-xs text-[#64748B]">{job.scheduled_time ?? "—"} &middot; {job.address}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-[#64748B] shrink-0" />
            </div>
          </button>
        ))}
      </div>

      {/* Active Job Detail */}
      {currentJob && (
        <Card className="border-[#E2E8F0] shadow-sm">
          <CardContent className="p-4 space-y-4">
            {/* Status Bar */}
            <div className="flex items-center gap-2">
              {statusSteps.map((step, idx) => {
                const isActive = jobStatus === step.id;
                const isDone = currentStepIdx > idx;
                return (
                  <div key={step.id} className="flex items-center gap-2 flex-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      isDone ? "bg-[#16A34A] text-white" : isActive ? "bg-[#0891B2] text-white" : "bg-[#F1F5F9] text-[#64748B]"
                    }`}>
                      {isDone ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                    </div>
                    {idx < 2 && (
                      <div className={`flex-1 h-0.5 ${isDone ? "bg-[#16A34A]" : "bg-[#E2E8F0]"}`} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Customer Quick Info */}
            <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#0891B2] flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-[#0F172A]">{currentJob.customers?.name ?? "—"}</p>
                  <p className="text-xs text-[#64748B]">{currentJob.address}</p>
                </div>
                <div className="flex gap-1">
                  <button className="p-2 rounded-lg bg-[#0891B2]/10 text-[#0891B2]">
                    <Phone className="w-4 h-4" />
                  </button>
                  <button
                    className="p-2 rounded-lg bg-[#0891B2]/10 text-[#0891B2]"
                    onClick={() => currentJob.address && window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(currentJob.address)}`, "_blank", "noopener,noreferrer")}
                  >
                    <Navigation className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs text-[#64748B]">
                <MapPin className="w-3 h-3" />
                <span>{currentJob.address}</span>
              </div>
            </div>

            {/* Job Description */}
            <div>
              <p className="text-sm font-medium text-[#0F172A] mb-1">{t("Description")}</p>
              <p className="text-sm text-[#64748B]">{currentJob.description || t("No description")}</p>
            </div>

            {/* Job Total */}
            <div>
              <p className="text-sm font-medium text-[#0F172A] mb-2">{t("Job Value")}</p>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#F8FAFC]">
                <div className="flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-[#0891B2]" />
                  <span className="text-sm text-[#0F172A]">{currentJob.type}</span>
                </div>
                <span className="text-base font-bold text-[#0891B2]">${currentJob.amount.toFixed(2)}</span>
              </div>
            </div>

            {/* Line Items — client feedback 2026-09-11: "Show all items in the job / estimate
                for the job they are doing for that day." job_line_items already carries over an
                estimate's items on convert-to-job, so this is the merged, single source. */}
            {jobLineItems.length > 0 && (
              <div>
                <p className="text-sm font-medium text-[#0F172A] mb-2">{t("Job Items")}</p>
                <div className="rounded-lg border border-[#E2E8F0] divide-y divide-[#F1F5F9]">
                  {jobLineItems.map((li) => (
                    <div key={li.id} className="flex items-center justify-between px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm text-[#0F172A] truncate">{li.description}</p>
                        <p className="text-xs text-[#64748B]">{li.quantity} × ${li.rate.toFixed(2)}{li.sku ? ` · ${li.sku}` : ""}</p>
                      </div>
                      <span className="text-sm font-medium text-[#0F172A] shrink-0">${li.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Parts Used */}
            <div>
              <p className="text-sm font-medium text-[#0F172A] mb-2">{t("Parts Used")}</p>
              <Input
                placeholder={t("Search parts by name, SKU, or description...")}
                className="mb-2 h-9 text-sm"
                value={partsSearch}
                onChange={(e) => setPartsSearch(e.target.value)}
              />
              <div className="max-h-40 overflow-y-auto space-y-1 rounded-lg border border-[#E2E8F0]">
                {inventoryItems
                  .filter((item) => item.category !== "Services")
                  .filter((item) => {
                    // Client request 2026-09-04: with 2,500+ real parts, showing everything before
                    // the user types anything was the same "unpaginated big list" issue seen
                    // elsewhere — always keep already-selected parts visible, otherwise require a
                    // search term (same cap approach as SearchableSelect).
                    if ((partsUsed[item.id] ?? 0) > 0) return true;
                    if (!partsSearch.trim()) return false;
                    const q = partsSearch.toLowerCase();
                    return [item.name, item.sku, item.short_description, item.long_description, item.category, item.manufacturer]
                      .filter(Boolean)
                      .some((f) => (f as string).toLowerCase().includes(q));
                  })
                  .slice(0, 50)
                  .map((item) => (
                  <div key={item.id} className="flex items-center justify-between px-3 py-2 border-b border-[#F1F5F9] last:border-b-0">
                    <span className="text-sm text-[#0F172A] truncate">{item.name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => adjustPart(item.id, -1)}
                        className="w-6 h-6 rounded-md bg-[#F1F5F9] flex items-center justify-center text-[#64748B]"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-5 text-center text-sm font-medium text-[#0F172A]">{partsUsed[item.id] ?? 0}</span>
                      <button
                        onClick={() => adjustPart(item.id, 1)}
                        className="w-6 h-6 rounded-md bg-[#0891B2]/10 flex items-center justify-center text-[#0891B2]"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
                {!partsSearch.trim() && Object.values(partsUsed).every((q) => !q) && (
                  <p className="px-3 py-3 text-sm text-[#64748B]">{t("Search above to find a part.")}</p>
                )}
              </div>
            </div>

            {/* Forms — client feedback 2026-09-11: forms only ever showed on desktop JobDetail,
                which a technician never opens; same suggested-template rule reused here. */}
            {suggestedTemplates.length > 0 && (
              <div>
                <p className="text-sm font-medium text-[#0F172A] mb-2">{t("Forms")}</p>
                <div className="space-y-3">
                  {suggestedTemplates.map((tpl) => (
                    <div key={tpl.id} className="relative">
                      {tpl.required && !jobForms.some((f) => f.template_id === tpl.id) && (
                        <Badge className="absolute -top-2 right-2 z-10 bg-[#DC2626] text-white text-[10px] px-1.5 py-0">{t("Required")}</Badge>
                      )}
                      <DynamicForm template={tpl} onSave={(data) => handleSaveForm(tpl, data)} onUploadPhoto={handleFormPhotoUpload} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Documents — client feedback 2026-09-11: "Show documents (still need a document
                section... these are pdfs for estimates showing scope of work)." Read/attach only
                here; techs pick from the Library instead of re-uploading a scope-of-work PDF. */}
            <DocumentsSection
              documents={jobDocuments}
              onUpload={handleUploadDocument}
              uploading={docsUploading}
              libraryDocuments={libraryDocuments}
              onAttachExisting={handleAttachLibraryDocument}
            />

            {/* Photos */}
            <div>
              <p className="text-sm font-medium text-[#0F172A] mb-2">{t("Photos")}</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handlePhotoSelect}
              />
              <div className="grid grid-cols-4 gap-2">
                {photos.map((photo) => (
                  <div key={photo.id} className="aspect-square rounded-lg overflow-hidden bg-[#0891B2]/10">
                    <img src={photo.url} alt="Job" className="w-full h-full object-cover" />
                  </div>
                ))}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square rounded-lg bg-[#F1F5F9] border border-dashed border-[#E2E8F0] flex items-center justify-center"
                >
                  <Camera className="w-5 h-5 text-[#64748B]" />
                </button>
              </div>
            </div>

            {/* Notes */}
            <div>
              <p className="text-sm font-medium text-[#0F172A] mb-2">{t("Job Notes")}</p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("Add notes about this job... (saved to customer record on completion)")}
                className="w-full h-20 p-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#0891B2]"
              />
            </div>

            {/* Signature */}
            <div>
              <p className="text-sm font-medium text-[#0F172A] mb-2">{t("Customer Signature")}</p>
              {signatureUrl ? (
                <div className="h-24 rounded-lg border-2 border-[#16A34A] bg-[#16A34A]/5 flex items-center justify-center gap-4">
                  <img src={signatureUrl} alt="Signature" className="h-16" />
                  <button
                    onClick={() => setSignatureUrl(null)}
                    className="text-xs font-medium text-[#0891B2] hover:underline"
                  >
                    {t("Redo")}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <canvas
                    ref={canvasRef}
                    width={400}
                    height={120}
                    className="w-full h-24 rounded-lg border-2 border-dashed border-[#E2E8F0] bg-[#F8FAFC] touch-none"
                    onPointerDown={startDraw}
                    onPointerMove={draw}
                    onPointerUp={endDraw}
                    onPointerLeave={endDraw}
                  />
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={clearSignatureCanvas}>
                      <Eraser className="w-3.5 h-3.5" /> {t("Clear")}
                    </Button>
                    <Button size="sm" className="bg-[#0891B2] hover:bg-[#0E7490] text-white gap-1.5" onClick={saveSignature}>
                      <CheckCircle2 className="w-3.5 h-3.5" /> {t("Save Signature")}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              {formError && <p className="text-sm text-[#DC2626]">{t(formError)}</p>}
              {jobStatus !== "completed" && (
                <Button
                  className="w-full h-12 bg-[#0891B2] hover:bg-[#0E7490] text-white font-semibold gap-2"
                  onClick={advanceStatus}
                >
                  {currentStepIdx < 0 ? (
                    <>
                      <Navigation className="w-5 h-5" />
                      {t("Start Job — Navigate to Site")}
                    </>
                  ) : (
                    <>
                      {(() => {
                        const Icon = statusSteps[currentStepIdx]?.icon || CheckCircle2;
                        return <Icon className="w-5 h-5" />;
                      })()}
                      {t(statusSteps[currentStepIdx]?.action || "Complete Job")}
                    </>
                  )}
                </Button>
              )}

              {jobStatus === "completed" && (
                <Button
                  className="w-full h-12 bg-[#16A34A] hover:bg-[#15803D] text-white font-semibold gap-2"
                  disabled={generatingInvoice}
                  onClick={generateInvoice}
                >
                  <DollarSign className="w-5 h-5" />
                  {generatingInvoice ? t("Generating...") : t("Generate Invoice & Collect Payment")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
