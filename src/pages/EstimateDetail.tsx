import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Download, FileText, ArrowRight, Link2, Mail, Camera, Upload, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { invoicingApi, type EstimateAttachment } from "@/lib/api/invoicing";
import DocumentsSection from "@/components/DocumentsSection";
import { SearchableSelect } from "@/components/SearchableSelect";
import LineItemsEditor, { type DraftLineItem } from "@/components/LineItemsEditor";
import { customersApi } from "@/lib/api/customers";
import { inventoryApi, type ItemWithStock } from "@/lib/api/inventory";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
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

export default function EstimateDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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
    return <div className="text-center py-20 text-[#64748B]">Loading estimate...</div>;
  }

  if (!estimate) {
    return (
      <div className="text-center py-20">
        <p className="text-[#64748B]">Estimate not found</p>
        <Button onClick={() => navigate("/invoicing")} className="mt-4 bg-[#0891B2] text-white">Back to Invoicing</Button>
      </div>
    );
  }

  const items: { description: string; sku?: string | null; item_type?: string; notes?: string | null; quantity: number; rate: number; cost?: number; amount: number }[] =
    lineItems.length > 0 ? lineItems : [{ description: `Estimate - ${estimate.customers?.name ?? ""}`, quantity: 1, rate: estimate.amount, amount: estimate.amount }];
  const subtotal = items.reduce((sum, li) => sum + li.amount, 0);
  // Client sample estimate PDF (2026-09-06): "Parts & Materials" and "Labor" shown as separate
  // subtotal lines, not one combined Subtotal.
  const materialsSubtotal = items.filter((li) => li.item_type !== "labor").reduce((sum, li) => sum + li.amount, 0);
  const laborSubtotal = items.filter((li) => li.item_type === "labor").reduce((sum, li) => sum + li.amount, 0);
  const tax = subtotal * 0.0825;
  const total = subtotal + tax;
  const downPayment = estimate.down_payment ?? 0;
  const remainingBalance = total - downPayment;
  const totalCost = items.reduce((sum, li) => sum + (li.cost ?? 0) * li.quantity, 0);

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
  const emailApprovalHref = estimate?.customers
    ? `mailto:?subject=${encodeURIComponent(`Estimate ${estimate.number} — please review and approve`)}&body=${encodeURIComponent(`Hi ${estimate.customers.name},\n\nPlease review and approve your estimate here:\n${approvalUrl}\n\nThank you!`)}`
    : "#";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/invoicing")} className="p-2 rounded-lg hover:bg-[#F8FAFC] text-[#64748B]">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <h1 className="text-xl font-bold text-[#0F172A]">{estimate.number}</h1>
            <Badge className={`${statusColors[estimate.status] ?? "bg-[#F1F5F9] text-[#64748B]"} text-[10px] px-1.5 py-0`}>{estimate.status}</Badge>
          </div>
        </div>
        {estimate.status !== "Converted" && !editing ? (
          <div className="flex gap-2">
            <Button variant="outline" className="h-9 border-[#E2E8F0] gap-2" onClick={handleStartEdit}>
              <Pencil className="w-4 h-4" /> Edit
            </Button>
            <Button variant="outline" className="h-9 border-[#E2E8F0] gap-2" onClick={handleConvertToJob} disabled={converting}>
              <ArrowRight className="w-4 h-4" /> {converting ? "Converting..." : "Convert to Job"}
            </Button>
            <Button className="bg-[#0891B2] hover:bg-[#0E7490] text-white gap-2 h-9" onClick={handleConvert} disabled={converting}>
              <ArrowRight className="w-4 h-4" /> {converting ? "Converting..." : "Convert to Invoice"}
            </Button>
          </div>
        ) : estimate.status === "Converted" && estimate.converted_invoice_id ? (
          <Button variant="outline" className="h-9 border-[#E2E8F0]" onClick={() => navigate(`/invoicing/${estimate.converted_invoice_id}`)}>
            View Invoice
          </Button>
        ) : estimate.converted_job_id ? (
          <Button variant="outline" className="h-9 border-[#E2E8F0]" onClick={() => navigate(`/jobs/${estimate.converted_job_id}`)}>
            View Job
          </Button>
        ) : editing ? (
          <div className="flex gap-2">
            <Button variant="outline" className="h-9 border-[#E2E8F0]" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
            <Button className="bg-[#0891B2] hover:bg-[#0E7490] text-white h-9" onClick={handleSaveEdit} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" className="h-9 gap-2 border-[#E2E8F0] text-[#0F172A]" onClick={() => window.print()}>
          <Download className="w-4 h-4 text-[#0891B2]" /> Download PDF
        </Button>
        {estimate.status !== "Converted" && (
          <>
            <Button variant="outline" className="h-9 gap-2 border-[#E2E8F0] text-[#0F172A]" onClick={handleCopyApprovalLink}>
              <Link2 className="w-4 h-4 text-[#0891B2]" /> {linkCopied ? "Link Copied!" : "Copy Approval Link"}
            </Button>
            <a href={emailApprovalHref}>
              <Button variant="outline" className="h-9 gap-2 border-[#E2E8F0] text-[#0F172A]" disabled={!estimate.customers?.name}>
                <Mail className="w-4 h-4 text-[#0891B2]" /> Email Customer
              </Button>
            </a>
          </>
        )}
        {estimate.approved_at && (
          <Badge className={`${approvalStatusColors[estimate.status] ?? "bg-[#F1F5F9] text-[#64748B]"} text-xs px-2 py-1`}>
            {estimate.status} by customer {new Date(estimate.approved_at).toLocaleString()}
          </Badge>
        )}
      </div>
      {/* No email-sending service is wired up (no SendGrid) -- the link above is real and works,
          but reaching the customer's inbox is a manual copy/mailto step, not automatic. */}
      <p className="text-xs text-[#94A3B8]">Share the approval link above with the customer — there's no automatic email delivery yet.</p>

      {editing && (
        <Card className="border-[#E2E8F0] shadow-sm">
          <CardContent className="p-6 lg:p-8 space-y-4">
            <div>
              <label className="text-sm font-medium text-[#0F172A]">Customer</label>
              <div className="mt-1">
                <SearchableSelect
                  value={editDraft.customerId}
                  onChange={(v) => setEditDraft((p) => ({ ...p, customerId: v }))}
                  placeholder="Select customer"
                  searchPlaceholder="Search customers..."
                  options={customers.map((c) => ({ value: c.id, label: c.name, sublabel: [c.phone, c.email].filter(Boolean).join(" · ") || undefined }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-[#0F172A]">Issue Date</label>
                <Input type="date" className="mt-1" value={editDraft.issueDate} onChange={(e) => setEditDraft((p) => ({ ...p, issueDate: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-[#0F172A]">Expires</label>
                <Input type="date" className="mt-1" value={editDraft.expiryDate} onChange={(e) => setEditDraft((p) => ({ ...p, expiryDate: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-[#0F172A]">Job Description</label>
              <textarea
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] p-2 text-sm min-h-[60px]"
                value={editDraft.jobDescription}
                onChange={(e) => setEditDraft((p) => ({ ...p, jobDescription: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[#0F172A]">Line Items</label>
              <div className="mt-1">
                <LineItemsEditor items={editLines} onChange={setEditLines} inventoryItems={inventoryItems} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-[#0F172A]">Down Payment ($)</label>
              <Input type="number" className="mt-1" value={editDraft.downPayment} onChange={(e) => setEditDraft((p) => ({ ...p, downPayment: e.target.value }))} />
            </div>
          </CardContent>
        </Card>
      )}

      {!editing && (
      <Card className="border-[#E2E8F0] shadow-sm">
        <CardContent className="p-6 lg:p-8">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-lg bg-[#0891B2] flex items-center justify-center">
                  <FileText className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-xl font-bold text-[#0F172A]">{business?.invoice_business_name || business?.name || "—"}</h2>
              </div>
              {business?.address && <p className="text-sm text-[#64748B]">{business.address}</p>}
              {(business?.city || business?.state || business?.zip) && (
                <p className="text-sm text-[#64748B]">{[business?.city, business?.state].filter(Boolean).join(", ")} {business?.zip ?? ""}</p>
              )}
              {business?.phone && <p className="text-sm text-[#64748B]">{business.phone}</p>}
            </div>
            <div className="text-right">
              <h3 className="text-2xl font-bold text-[#0F172A]">ESTIMATE</h3>
              <p className="text-sm text-[#64748B]">{estimate.number}</p>
              <div className="mt-2">
                <Badge className={`${statusColors[estimate.status] ?? "bg-[#F1F5F9] text-[#64748B]"} text-[10px] px-2 py-0.5`}>{estimate.status}</Badge>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8 p-4 rounded-lg bg-[#F8FAFC]">
            <div>
              <p className="text-xs font-semibold text-[#64748B] uppercase mb-1">Client Details</p>
              <p className="font-medium text-[#0F172A]">{estimate.customers?.name ?? "—"}</p>
              <p className="text-sm text-[#64748B]">{estimate.customers?.phone ?? ""}</p>
              <p className="text-sm text-[#64748B]">{estimate.customers?.address ?? ""}</p>
            </div>
            <div className="sm:text-right">
              <p className="text-xs font-semibold text-[#64748B] uppercase mb-1">Estimate Details</p>
              <p className="text-sm text-[#0F172A]">Date of Request: <span className="text-[#64748B]">{estimate.issue_date}</span></p>
              <p className="text-sm text-[#0F172A]">Expires: <span className="text-[#64748B]">{estimate.expiry_date ?? "—"}</span></p>
            </div>
          </div>

          {(estimate.job_description || photos.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {estimate.job_description && (
                <div className="border border-[#E2E8F0] rounded-lg p-4">
                  <p className="text-xs font-semibold text-[#64748B] uppercase mb-1">Job Description</p>
                  <p className="text-sm text-[#0F172A] whitespace-pre-wrap">{estimate.job_description}</p>
                </div>
              )}
              <div className="border border-[#E2E8F0] rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-[#64748B] uppercase flex items-center gap-1.5"><Camera className="w-3.5 h-3.5" /> Trip Photos</p>
                  <label className="inline-flex items-center gap-1 text-xs text-[#0891B2] cursor-pointer hover:underline print:hidden">
                    <Upload className="w-3 h-3" /> {photosUploading ? "Uploading..." : "Add"}
                    <input type="file" accept="image/*" className="hidden" onChange={handleUploadPhoto} disabled={photosUploading} />
                  </label>
                </div>
                {photos.length === 0 ? (
                  <p className="text-xs text-[#94A3B8]">No photos yet.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {photos.map((p) => (
                      <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="block aspect-square rounded-md overflow-hidden border border-[#E2E8F0]">
                        <img src={p.url} alt="Trip" className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          {!estimate.job_description && photos.length === 0 && (
            <div className="mb-6 border border-dashed border-[#E2E8F0] rounded-lg p-4 print:hidden">
              <label className="inline-flex items-center gap-1.5 text-xs text-[#0891B2] cursor-pointer hover:underline">
                <Camera className="w-3.5 h-3.5" /> Add Trip Photos
                <input type="file" accept="image/*" className="hidden" onChange={handleUploadPhoto} disabled={photosUploading} />
              </label>
            </div>
          )}

          <div className="mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E2E8F0]">
                  <th className="text-left py-3 text-xs font-semibold text-[#64748B] uppercase">Description</th>
                  <th className="text-right py-3 text-xs font-semibold text-[#64748B] uppercase">Qty</th>
                  <th className="text-right py-3 text-xs font-semibold text-[#64748B] uppercase">Price</th>
                  <th className="text-right py-3 text-xs font-semibold text-[#64748B] uppercase">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((li, idx: number) => (
                  <tr key={idx} className="border-b border-[#F1F5F9]">
                    <td className="py-3 text-[#0F172A]">
                      {li.sku && <span className="text-[#64748B]">{li.sku} — </span>}
                      {li.description}
                      {li.item_type === "labor" && <Badge className="ml-2 bg-[#F59E0B]/10 text-[#F59E0B] text-[10px] px-1.5 py-0">Labor</Badge>}
                      {li.notes && <p className="text-xs text-[#94A3B8]">{li.notes}</p>}
                    </td>
                    <td className="text-right py-3 text-[#64748B]">{li.quantity}</td>
                    <td className="text-right py-3 text-[#64748B]">${li.rate.toFixed(2)}</td>
                    <td className="text-right py-3 font-medium text-[#0F172A]">${li.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <div className="w-full sm:w-64 space-y-2">
              {/* Client sample estimate PDF (2026-09-06): Parts & Materials / Labor shown as
                  separate lines, not a single combined Subtotal. */}
              <div className="flex justify-between text-sm">
                <span className="text-[#64748B]">Parts &amp; Materials</span>
                <span className="text-[#0F172A]">${materialsSubtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#64748B]">Labor</span>
                <span className="text-[#0F172A]">${laborSubtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#64748B]">Tax (8.25%)</span>
                <span className="text-[#0F172A]">${tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t border-[#E2E8F0]">
                <span className="text-[#0F172A]">Total</span>
                <span className="text-[#0891B2]">${total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-[#E2E8F0]">
                <span className="text-[#64748B]">Down Payment</span>
                <span className="text-[#0F172A]">${downPayment.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold">
                <span className="text-[#0F172A]">Remaining Balance</span>
                <span className="text-[#0F172A]">${remainingBalance.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {totalCost > 0 && (
            <div className="print:hidden mt-8 border border-dashed border-[#E2E8F0] rounded-lg p-4 bg-[#F8FAFC]">
              <p className="text-xs font-semibold text-[#64748B] uppercase mb-2">Internal Costs (Staff Only — not shown to customer)</p>
              <div className="flex justify-between text-sm">
                <span className="text-[#64748B]">Total Cost</span>
                <span className="text-[#0F172A]">${totalCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#64748B]">Margin</span>
                <span className="text-[#16A34A] font-medium">${(subtotal - totalCost).toFixed(2)}</span>
              </div>
            </div>
          )}

          <div className="mt-12 flex justify-end">
            <div className="text-center">
              <div className="w-56 border-t border-[#0F172A] pt-1">
                <p className="text-xs text-[#64748B]">Customer Signature</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      )}

      <DocumentsSection documents={documents} onUpload={handleUploadDocument} uploading={docsUploading} />
    </div>
  );
}
