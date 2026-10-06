import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Download, ArrowRight, Link2, Mail, Upload, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { invoicingApi, type EstimateAttachment } from "@/lib/api/invoicing";
import DocumentsSection from "@/components/DocumentsSection";
import { libraryApi, type LibraryDocument } from "@/lib/api/library";
import { SearchableSelect } from "@/components/SearchableSelect";
import LineItemsEditor, { type DraftLineItem } from "@/components/LineItemsEditor";
import { customersApi } from "@/lib/api/customers";
import { inventoryApi, type ItemWithStock } from "@/lib/api/inventory";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { laborFirst } from "@/lib/labor";
import { customerOption } from "@/lib/customer-options";
import type { Database } from "@/lib/database.types";

type Estimate = Database["public"]["Tables"]["estimates"]["Row"] & { customers: { name: string; address?: string | null; phone?: string | null } | null };
type LineItem = Database["public"]["Tables"]["estimate_line_items"]["Row"];

const approvalStatusColors: Record<string, string> = {
  Accepted: "bg-[#16A34A]/10 text-[#16A34A]",
  Declined: "bg-[#DC2626]/10 text-[#DC2626]",
};

const statusColors: Record<string, string> = {
  Draft: "bg-[#F59E0B]/10 text-[#F59E0B]",
  Sent: "bg-[#0891B2]/10 text-[#0891B2]",
  Accepted: "bg-[#16A34A]/10 text-[#16A34A]",
  Declined: "bg-[#DC2626]/10 text-[#DC2626]",
  Converted: "bg-[#0891B2]/10 text-[#0891B2]",
};

// MM/DD/YYYY, matching InvoiceDetail.tsx so the two documents look the same. Date-only strings
// are split rather than parsed so a timezone cannot shift the day.
const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  if (m && d.length === 10) return `${m[2]}/${m[3]}/${m[1]}`;
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
};

export default function EstimateDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [business, setBusiness] = useState<{ name: string; phone: string | null; address: string | null; city: string | null; state: string | null; zip: string | null; invoice_business_name: string | null } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [converting, setConverting] = useState(false);
  const [documents, setDocuments] = useState<EstimateAttachment[]>([]);
  const [docsUploading, setDocsUploading] = useState(false);
  const [photos, setPhotos] = useState<EstimateAttachment[]>([]);
  const [photosUploading, setPhotosUploading] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  // Client video 2026-10-06: real "Send via Email" now exists (backend/src/lib/mailer.ts) --
  // replaces the old mailto: fallback. Fails with a clear message until the server's SMTP
  // password is configured.
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendEmailResult, setSendEmailResult] = useState<string | null>(null);
  const { tenantId } = useAuth();

  // Client PDF 2026-09-05: "Need to be able to edit an estimate once created and saves".
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState({ customerId: "", issueDate: "", expiryDate: "", jobDescription: "", downPayment: "" });
  const [editLines, setEditLines] = useState<DraftLineItem[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string; phone: string | null; email: string | null }[]>([]);
  const [inventoryItems, setInventoryItems] = useState<ItemWithStock[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    customersApi.list().then((data) => setCustomers(data ?? []));
    inventoryApi.summary().then((data) => setInventoryItems(data?.items ?? []));
  }, []);

  // Client feedback 2026-09-11: "link to select a document from the document folder" -- these
  // are typically the client's scope-of-work PDFs already sitting in the Library.
  const [libraryDocuments, setLibraryDocuments] = useState<LibraryDocument[]>([]);
  useEffect(() => {
    libraryApi.list().then(setLibraryDocuments);
  }, []);

  const handleAttachLibraryDocument = async (doc: LibraryDocument) => {
    if (!id) return;
    await invoicingApi.addEstimateAttachment(id, { url: doc.url, label: doc.name, filename: doc.filename, type: "document" });
    invoicingApi.getEstimateAttachments(id).then((all) => setDocuments(all.filter((a) => a.type !== "photo")));
  };

  // Client video 2026-09-25: Edit / Delete on documents.
  const handleRenameDocument = async (doc: { id: string }, label: string) => {
    if (!id) return;
    await invoicingApi.updateEstimateDocumentLabel(id, doc.id, label);
    setDocuments((prev) => prev.map((d) => (d.id === doc.id ? { ...d, label } : d)));
  };
  const handleDeleteDocument = async (doc: { id: string }) => {
    if (!id) return;
    await invoicingApi.deleteEstimateDocument(id, doc.id);
    setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
  };

  const loadEstimate = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const bundle = await invoicingApi.estimateDetail(id);
      setEstimate(bundle.estimate as Estimate);
      setLineItems(bundle.lineItems);
      setBusiness(bundle.business);
      invoicingApi.getEstimateAttachments(id).then((all) => {
        setDocuments(all.filter((a) => a.type !== "photo"));
        setPhotos(all.filter((a) => a.type === "photo"));
      });
    } catch {
      setEstimate(null);
    }
    setIsLoading(false);
  }, [id]);

  useEffect(() => {
    loadEstimate();
  }, [loadEstimate]);

  if (isLoading) {
    return <div className="text-center py-20 text-[#64748B]">{t("Loading estimate...")}</div>;
  }

  if (!estimate) {
    return (
      <div className="text-center py-20">
        <p className="text-[#64748B]">{t("Estimate not found")}</p>
        <Button onClick={() => navigate("/invoicing")} className="mt-4 bg-[#0891B2] text-white">{t("Back to Invoicing")}</Button>
      </div>
    );
  }

  const items: { description: string; sku?: string | null; item_type?: string; notes?: string | null; quantity: number; rate: number; cost?: number; amount: number; taxable?: boolean }[] =
    lineItems.length > 0 ? lineItems : [{ description: `Estimate - ${estimate.customers?.name ?? ""}`, quantity: 1, rate: estimate.amount, amount: estimate.amount }];
  const subtotal = items.reduce((sum, li) => sum + li.amount, 0);
  // Client sample estimate PDF (2026-09-06): "Parts & Materials" and "Labor" shown as separate
  // subtotal lines, not one combined Subtotal.
  const materialsSubtotal = items.filter((li) => li.item_type !== "labor").reduce((sum, li) => sum + li.amount, 0);
  const laborSubtotal = items.filter((li) => li.item_type === "labor").reduce((sum, li) => sum + li.amount, 0);
  // Client SMS 2026-09-21: labor is not taxed -- tax applies to Parts & Materials only. Client
  // video 2026-10-06: now a real per-line `taxable` override, not just the material/labor split.
  const taxableSubtotal = items.filter((li) => li.taxable ?? li.item_type !== "labor").reduce((sum, li) => sum + li.amount, 0);
  const tax = taxableSubtotal * 0.0825;
  const total = subtotal + tax;
  const downPayment = estimate.down_payment ?? 0;
  const remainingBalance = total - downPayment;
  const totalCost = items.reduce((sum, li) => sum + (li.cost ?? 0) * li.quantity, 0);
  // customers.address is one free-text string ("street, city, ST, zip") -- street on line 1, rest
  // on line 2, matching InvoiceDetail.tsx's Billing Address box.
  const customerAddressLines = (() => {
    const a = estimate.customers?.address;
    if (!a) return [] as string[];
    const i = a.indexOf(",");
    return i > 0 ? [a.slice(0, i).trim(), a.slice(i + 1).trim()] : [a];
  })();

  const handleConvert = async () => {
    if (!id) return;
    setConverting(true);
    const { invoiceId } = await invoicingApi.convertEstimateToInvoice(id);
    navigate(`/invoicing/${invoiceId}`);
  };

  const handleStartEdit = () => {
    setEditDraft({
      customerId: estimate.customer_id,
      issueDate: estimate.issue_date,
      expiryDate: estimate.expiry_date ?? "",
      jobDescription: estimate.job_description ?? "",
      downPayment: String(estimate.down_payment ?? 0),
    });
    setEditLines(
      lineItems.length > 0
        ? lineItems.map((li) => ({ description: li.description, sku: li.sku, itemType: li.item_type as "material" | "labor", quantity: li.quantity, cost: li.cost, rate: li.rate, notes: li.notes }))
        : [],
    );
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await invoicingApi.updateEstimate(id, {
        customerId: editDraft.customerId,
        issueDate: editDraft.issueDate,
        expiryDate: editDraft.expiryDate || null,
        downPayment: parseFloat(editDraft.downPayment) || 0,
        jobDescription: editDraft.jobDescription || null,
        lineItems: editLines.filter((li) => li.description.trim()),
      });
      setEditing(false);
      loadEstimate();
    } finally {
      setSaving(false);
    }
  };

  // Client question 2026-09-03: "How to convert an estimate to a Job".
  const handleConvertToJob = async () => {
    if (!id) return;
    setConverting(true);
    const { jobId } = await invoicingApi.convertEstimateToJob(id);
    navigate(`/jobs/${jobId}`);
  };

  // Client request 2026-09-03: Documents section on an estimate — reuses the same
  // job-attachments bucket (its RLS only checks the tenant_id path segment) under an
  // `estimates/` sub-path instead of a job id.
  const handleUploadDocument = async (file: File, label: string) => {
    if (!id || !tenantId) return;
    setDocsUploading(true);
    try {
      const path = `${tenantId}/estimates/${id}/document-${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("job-attachments").upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from("job-attachments").getPublicUrl(path);
      await invoicingApi.addEstimateAttachment(id, { url: data.publicUrl, label, filename: file.name, type: "document" });
      invoicingApi.getEstimateAttachments(id).then((all) => setDocuments(all.filter((a) => a.type !== "photo")));
    } finally {
      setDocsUploading(false);
    }
  };

  // Client sample estimate PDF (2026-09-06): a "Trip Photos" gallery on the estimate itself,
  // distinct from the generic Documents list below.
  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id || !tenantId) return;
    setPhotosUploading(true);
    try {
      const path = `${tenantId}/estimates/${id}/photo-${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("job-attachments").upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from("job-attachments").getPublicUrl(path);
      await invoicingApi.addEstimateAttachment(id, { url: data.publicUrl, filename: file.name, type: "photo" });
      invoicingApi.getEstimateAttachments(id).then((all) => setPhotos(all.filter((a) => a.type === "photo")));
    } finally {
      setPhotosUploading(false);
      e.target.value = "";
    }
  };

  const approvalUrl = estimate ? `${window.location.origin}/estimate/${estimate.approval_token}` : "";
  const handleCopyApprovalLink = async () => {
    await navigator.clipboard.writeText(approvalUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };
  const handleSendEmail = async () => {
    if (!id) return;
    setSendingEmail(true);
    setSendEmailResult(null);
    try {
      await invoicingApi.sendEstimateEmail(id);
      setSendEmailResult("sent");
    } catch (err) {
      setSendEmailResult(err instanceof Error ? err.message : "Failed to send");
    }
    setSendingEmail(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center flex-wrap gap-3 print:hidden">
        <button onClick={() => navigate("/invoicing")} className="p-2 rounded-lg hover:bg-[#F8FAFC] text-[#64748B]">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <h1 className="text-xl font-bold text-[#0F172A]">{estimate.number}</h1>
            <Badge className={`${statusColors[estimate.status] ?? "bg-[#F1F5F9] text-[#64748B]"} text-[10px] px-1.5 py-0`}>{t(estimate.status)}</Badge>
          </div>
        </div>
        {estimate.status !== "Converted" && !editing ? (
          <div className="flex gap-2">
            <Button variant="outline" className="h-9 border-[#E2E8F0] gap-2" onClick={handleStartEdit}>
              <Pencil className="w-4 h-4" /> {t("Edit")}
            </Button>
            <Button variant="outline" className="h-9 border-[#E2E8F0] gap-2" onClick={handleConvertToJob} disabled={converting}>
              <ArrowRight className="w-4 h-4" /> {converting ? t("Converting...") : t("Convert to Job")}
            </Button>
            <Button className="bg-[#0891B2] hover:bg-[#0E7490] text-white gap-2 h-9" onClick={handleConvert} disabled={converting}>
              <ArrowRight className="w-4 h-4" /> {converting ? t("Converting...") : t("Convert to Invoice")}
            </Button>
          </div>
        ) : estimate.status === "Converted" && estimate.converted_invoice_id ? (
          <Button variant="outline" className="h-9 border-[#E2E8F0]" onClick={() => navigate(`/invoicing/${estimate.converted_invoice_id}`)}>
            {t("View Invoice")}
          </Button>
        ) : estimate.converted_job_id ? (
          <Button variant="outline" className="h-9 border-[#E2E8F0]" onClick={() => navigate(`/jobs/${estimate.converted_job_id}`)}>
            {t("View Job")}
          </Button>
        ) : editing ? (
          <div className="flex gap-2">
            <Button variant="outline" className="h-9 border-[#E2E8F0]" onClick={() => setEditing(false)} disabled={saving}>{t("Cancel")}</Button>
            <Button className="bg-[#0891B2] hover:bg-[#0E7490] text-white h-9" onClick={handleSaveEdit} disabled={saving}>{saving ? t("Saving...") : t("Save Changes")}</Button>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Button variant="outline" className="h-9 gap-2 border-[#E2E8F0] text-[#0F172A]" onClick={() => window.print()}>
          <Download className="w-4 h-4 text-[#0891B2]" /> {t("Download PDF")}
        </Button>
        {estimate.status !== "Converted" && (
          <>
            <Button variant="outline" className="h-9 gap-2 border-[#E2E8F0] text-[#0F172A]" onClick={handleCopyApprovalLink}>
              <Link2 className="w-4 h-4 text-[#0891B2]" /> {linkCopied ? t("Link Copied!") : t("Copy Approval Link")}
            </Button>
            <Button variant="outline" className="h-9 gap-2 border-[#E2E8F0] text-[#0F172A]" onClick={handleSendEmail} disabled={sendingEmail}>
              <Mail className="w-4 h-4 text-[#0891B2]" /> {sendingEmail ? t("Sending...") : t("Send via Email")}
            </Button>
            {sendEmailResult === "sent" && <span className="text-xs text-[#16A34A]">{t("Email sent")}</span>}
            {sendEmailResult && sendEmailResult !== "sent" && <span className="text-xs text-[#DC2626]">{t(sendEmailResult)}</span>}
          </>
        )}
        {estimate.approved_at && (
          <Badge className={`${approvalStatusColors[estimate.status] ?? "bg-[#F1F5F9] text-[#64748B]"} text-xs px-2 py-1`}>
            {t(estimate.status)} {t("by customer")} {new Date(estimate.approved_at).toLocaleString()}
          </Badge>
        )}
      </div>

      {editing && (
        <Card className="border-[#E2E8F0] shadow-sm">
          <CardContent className="p-6 lg:p-8 space-y-4">
            <div>
              <label className="text-sm font-medium text-[#0F172A]">{t("Customer")}</label>
              <div className="mt-1">
                <SearchableSelect
                  value={editDraft.customerId}
                  onChange={(v) => setEditDraft((p) => ({ ...p, customerId: v }))}
                  placeholder={t("Select customer")}
                  searchPlaceholder={t("Search customers...")}
                  options={customers.map(customerOption)}
                  showSublabelWhenSelected
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-[#0F172A]">{t("Issue Date")}</label>
                <Input type="date" className="mt-1" value={editDraft.issueDate} onChange={(e) => setEditDraft((p) => ({ ...p, issueDate: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-[#0F172A]">{t("Expires")}</label>
                <Input type="date" className="mt-1" value={editDraft.expiryDate} onChange={(e) => setEditDraft((p) => ({ ...p, expiryDate: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-[#0F172A]">{t("Job Description")}</label>
              <textarea
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] p-2 text-sm min-h-[60px]"
                value={editDraft.jobDescription}
                onChange={(e) => setEditDraft((p) => ({ ...p, jobDescription: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[#0F172A]">{t("Line Items")}</label>
              <div className="mt-1">
                <LineItemsEditor items={editLines} onChange={setEditLines} inventoryItems={inventoryItems} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-[#0F172A]">{t("Down Payment ($)")}</label>
              <Input type="number" className="mt-1" value={editDraft.downPayment} onChange={(e) => setEditDraft((p) => ({ ...p, downPayment: e.target.value }))} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Estimate Document — mirrors InvoiceDetail.tsx's layout exactly (client ask, 2026-10-02:
          "make the customer estimates look like the customer invoice") so the two documents read
          as one consistent system: dark header band with Business / Client Details / Billing
          Address / Service Details boxes, then a Breakdown of Services. */}
      {!editing && (
      <Card className="border-[#E2E8F0] shadow-sm">
        <CardContent className="p-4 sm:p-6 lg:p-8">
          <div className="rounded-xl bg-gradient-to-r from-[#0E7490] to-[#0891B2] p-3 sm:p-4 text-white [print-color-adjust:exact] [-webkit-print-color-adjust:exact]">
            <div className="flex items-center justify-center gap-3 mb-3">
              <h2 className="text-[27px] leading-none font-bold text-center">{t("Estimate")}</h2>
              <Badge className="bg-white/20 text-white border border-white/30 text-[10px] px-2 py-0.5 print:hidden">{t(estimate.status)}</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 print:grid-cols-4 gap-2 text-[11px] leading-relaxed">
              <div className="rounded-lg border border-white/30 bg-white/10 p-3 flex flex-col">
                <p className="font-bold uppercase tracking-wide text-center mb-2 pb-1.5 border-b border-white/30">{business?.invoice_business_name || business?.name || "—"}</p>
                <div className="mt-auto space-y-0.5">
                  {business?.phone && <p>{t("Phone #")}: {business.phone}</p>}
                  {business?.address && <p>{business.address}</p>}
                  {(business?.city || business?.state || business?.zip) && (
                    <p>{[business?.city, business?.state].filter(Boolean).join(", ")} {business?.zip ?? ""}</p>
                  )}
                </div>
              </div>
              <div className="rounded-lg border border-white/30 bg-white/10 p-3 space-y-0.5">
                <p className="font-bold uppercase tracking-wide text-center mb-2 pb-1.5 border-b border-white/30">{t("Client Details")}</p>
                <p>{t("Name")}: {estimate.customers?.name ?? "—"}</p>
                <p>{t("Phone #")}: {estimate.customers?.phone ? <a href={`tel:${estimate.customers.phone}`} className="hover:underline">{estimate.customers.phone}</a> : "—"}</p>
                <p>{t("Estimate #")}: {estimate.number}</p>
                <p>{t("Date of Request")}: {fmtDate(estimate.issue_date)}</p>
                <p>{t("Expires")}: {fmtDate(estimate.expiry_date)}</p>
              </div>
              <div className="rounded-lg border border-white/30 bg-white/10 p-3 space-y-0.5">
                <p className="font-bold uppercase tracking-wide text-center mb-2 pb-1.5 border-b border-white/30">{t("Billing Address")}:</p>
                <p>{estimate.customers?.name ?? "—"}</p>
                {customerAddressLines.length > 0 ? customerAddressLines.map((line, i) => <p key={i}>{line}</p>) : <p>—</p>}
              </div>
              <div className="rounded-lg border border-white/30 bg-white/10 p-3 space-y-0.5">
                <p className="font-bold uppercase tracking-wide text-center mb-2 pb-1.5 border-b border-white/30">{t("Service Details")}</p>
                <p>{t("Item/Parts")}: ${materialsSubtotal.toFixed(2)}</p>
                <p>{t("Labor Cost")}: ${laborSubtotal.toFixed(2)}</p>
                <p>{t("Item Tax")}: ${tax.toFixed(2)}</p>
                <p>{t("Total Tax")}: ${tax.toFixed(2)}</p>
                <p>{t("Total")}: ${total.toFixed(2)}</p>
                <p>{t("Down Payment")}: ${downPayment.toFixed(2)}</p>
                <p>{t("Remaining Balance")}: ${remainingBalance.toFixed(2)}</p>
              </div>
            </div>
          </div>

          <h3 className="font-bold text-[#0F172A] mt-6 mb-2 text-sm">{t("Breakdown of Services")}</h3>

          {/* Job Description + Trip Photos (estimates aren't tied to a completed job yet, so
              photos are uploaded directly on the estimate rather than pulled from job_attachments). */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 mb-3 space-y-3">
              {estimate.job_description && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#0891B2] mb-1">{t("Job Description")}:</p>
                  <p className="text-xs text-[#0F172A] whitespace-pre-wrap">{estimate.job_description}</p>
                </div>
              )}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-base font-bold text-[#0F172A]">{t("Trip Photos")}</p>
                  <label className="inline-flex items-center gap-1 text-xs text-[#0891B2] cursor-pointer hover:underline print:hidden">
                    <Upload className="w-3 h-3" /> {photosUploading ? t("Uploading...") : t("Add")}
                    <input type="file" accept="image/*" className="hidden" onChange={handleUploadPhoto} disabled={photosUploading} />
                  </label>
                </div>
                {photos.length === 0 ? (
                  <p className="text-xs text-[#94A3B8]">{t("No photos yet.")}</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {photos.map((photo) => (
                      <div key={photo.id} className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-2 break-inside-avoid">
                        <img src={photo.url} alt="Trip" className="w-full h-36 object-contain" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
          </div>

          {/* Service Line Items */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 mb-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#0891B2] mb-2">{t("Service Line Items")}:</p>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B]">
                  <th className="text-left py-2 pr-2 font-medium w-12">{t("SI No")}</th>
                  <th className="text-left py-2 font-medium">{t("Description")}</th>
                  <th className="text-right py-2 font-medium">{t("Qty")}</th>
                  <th className="text-right py-2 font-medium pl-3">{t("Unit Price")}</th>
                  <th className="text-right py-2 font-medium pl-3">{t("Amount")}</th>
                </tr>
              </thead>
              <tbody>
                {laborFirst(items).map((li, idx: number) => (
                  <tr key={idx} className="border-b border-[#E2E8F0] align-top">
                    <td className="py-2 pr-2 text-[#64748B]">{idx + 1}</td>
                    <td className="py-2 text-[#0F172A]">
                      {li.sku && <span className="text-[#64748B]">{li.sku} — </span>}
                      {li.description}
                      {li.item_type === "labor" && <Badge className="ml-2 bg-[#F59E0B]/10 text-[#F59E0B] text-[10px] px-1.5 py-0">{t("Labor")}</Badge>}
                      {(li.taxable ?? li.item_type !== "labor") !== (li.item_type !== "labor") && (
                        <Badge className="ml-2 bg-[#0891B2]/10 text-[#0891B2] text-[10px] px-1.5 py-0">{(li.taxable ?? li.item_type !== "labor") ? t("Taxable") : t("Tax-exempt")}</Badge>
                      )}
                      {li.notes && <p className="text-[11px] text-[#94A3B8] whitespace-pre-wrap">{li.notes}</p>}
                    </td>
                    <td className="text-right py-2 text-[#64748B]">{li.quantity}</td>
                    <td className="text-right py-2 pl-3 text-[#64748B]">${li.rate.toFixed(2)}</td>
                    <td className="text-right py-2 pl-3 font-medium text-[#0F172A]">${li.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-xs text-[#0F172A] space-y-1.5 sm:ml-auto sm:w-72">
            <p>{t("Tax")}: ${tax.toFixed(2)}</p>
            <p>{t("Total")}: ${total.toFixed(2)}</p>
            <p>{t("Down Payment")}: ${downPayment.toFixed(2)}</p>
            <p>{t("Remaining Balance")}: ${remainingBalance.toFixed(2)}</p>
          </div>

          {/* Internal cost/margin — staff only, excluded from Download PDF (window.print). */}
          {totalCost > 0 && (
            <div className="print:hidden mt-8 border border-dashed border-[#E2E8F0] rounded-lg p-4 bg-[#F8FAFC]">
              <p className="text-xs font-semibold text-[#64748B] uppercase mb-2">{t("Internal Costs (Staff Only — not shown to customer)")}</p>
              <div className="flex justify-between text-sm">
                <span className="text-[#64748B]">{t("Total Cost")}</span>
                <span className="text-[#0F172A]">${totalCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#64748B]">{t("Margin")}</span>
                <span className="text-[#16A34A] font-medium">${(subtotal - totalCost).toFixed(2)}</span>
              </div>
            </div>
          )}

          <div className="mt-8 flex justify-end">
            <div className="text-center">
              <div className="w-56 border-t border-[#0F172A] pt-1">
                <p className="text-xs text-[#64748B]">{t("Customer Signature")}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      )}

      <div className="print:hidden">
        <DocumentsSection
          documents={documents}
          onUpload={handleUploadDocument}
          uploading={docsUploading}
          libraryDocuments={libraryDocuments}
          onAttachExisting={handleAttachLibraryDocument}
          onRename={handleRenameDocument}
          onDelete={handleDeleteDocument}
          collapseWhenEmpty
        />
      </div>
    </div>
  );
}
