import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Download, FileText, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { invoicingApi, type EstimateAttachment } from "@/lib/api/invoicing";
import DocumentsSection from "@/components/DocumentsSection";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import type { Database } from "@/lib/database.types";

type Estimate = Database["public"]["Tables"]["estimates"]["Row"] & { customers: { name: string; address?: string | null; phone?: string | null } | null };
type LineItem = Database["public"]["Tables"]["estimate_line_items"]["Row"];

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
  const { tenantId } = useAuth();

  const loadEstimate = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const bundle = await invoicingApi.estimateDetail(id);
      setEstimate(bundle.estimate as Estimate);
      setLineItems(bundle.lineItems);
      setBusiness(bundle.business);
      invoicingApi.getEstimateAttachments(id).then(setDocuments);
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

  const items: { description: string; sku?: string | null; item_type?: string; quantity: number; rate: number; cost?: number; amount: number }[] =
    lineItems.length > 0 ? lineItems : [{ description: `Estimate - ${estimate.customers?.name ?? ""}`, quantity: 1, rate: estimate.amount, amount: estimate.amount }];
  const subtotal = items.reduce((sum, li) => sum + li.amount, 0);
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
      await invoicingApi.addEstimateAttachment(id, { url: data.publicUrl, label, filename: file.name });
      invoicingApi.getEstimateAttachments(id).then(setDocuments);
    } finally {
      setDocsUploading(false);
    }
  };

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
        {estimate.status !== "Converted" ? (
          <div className="flex gap-2">
            <Button variant="outline" className="h-9 border-[#E2E8F0] gap-2" onClick={handleConvertToJob} disabled={converting}>
              <ArrowRight className="w-4 h-4" /> {converting ? "Converting..." : "Convert to Job"}
            </Button>
            <Button className="bg-[#0891B2] hover:bg-[#0E7490] text-white gap-2 h-9" onClick={handleConvert} disabled={converting}>
              <ArrowRight className="w-4 h-4" /> {converting ? "Converting..." : "Convert to Invoice"}
            </Button>
          </div>
        ) : estimate.converted_invoice_id ? (
          <Button variant="outline" className="h-9 border-[#E2E8F0]" onClick={() => navigate(`/invoicing/${estimate.converted_invoice_id}`)}>
            View Invoice
          </Button>
        ) : estimate.converted_job_id ? (
          <Button variant="outline" className="h-9 border-[#E2E8F0]" onClick={() => navigate(`/jobs/${estimate.converted_job_id}`)}>
            View Job
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="h-9 gap-2 border-[#E2E8F0] text-[#0F172A]" onClick={() => window.print()}>
          <Download className="w-4 h-4 text-[#0891B2]" /> Download PDF
        </Button>
      </div>

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

          {estimate.job_description && (
            <div className="mb-6 border border-[#E2E8F0] rounded-lg p-4">
              <p className="text-xs font-semibold text-[#64748B] uppercase mb-1">Job Description</p>
              <p className="text-sm text-[#0F172A] whitespace-pre-wrap">{estimate.job_description}</p>
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
              <div className="flex justify-between text-sm">
                <span className="text-[#64748B]">Subtotal</span>
                <span className="text-[#0F172A]">${subtotal.toFixed(2)}</span>
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

      <DocumentsSection documents={documents} onUpload={handleUploadDocument} uploading={docsUploading} />
    </div>
  );
}
