import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Mail, MessageSquare, CreditCard, BadgeCheck, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { invoicingApi, type InvoiceDetailBundle } from "@/lib/api/invoicing";
import CardPaymentForm from "@/components/CardPaymentForm";
import { useLanguage } from "@/lib/language-context";
import { laborFirst } from "@/lib/labor";
import type { Database } from "@/lib/database.types";

type Invoice = Database["public"]["Tables"]["invoices"]["Row"] & { customers: { name: string; address: string | null; phone?: string | null } | null };
type LineItem = Database["public"]["Tables"]["invoice_line_items"]["Row"];

const statusColors: Record<string, string> = {
  Draft: "bg-[#F59E0B]/10 text-[#F59E0B]",
  Sent: "bg-[#0891B2]/10 text-[#0891B2]",
  Paid: "bg-[#16A34A]/10 text-[#16A34A]",
  Overdue: "bg-[#DC2626]/10 text-[#DC2626]",
  "Written Off": "bg-[#64748B]/10 text-[#64748B]",
};

// MM/DD/YYYY, matching the client's previous invoice. Date-only strings are split rather than parsed
// so a timezone cannot shift the day.
const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  if (m && d.length === 10) return `${m[2]}/${m[3]}/${m[1]}`;
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
};

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [business, setBusiness] = useState<{ name: string; phone: string | null; address: string | null; city: string | null; state: string | null; zip: string | null; invoice_business_name: string | null } | null>(null);
  const [job, setJob] = useState<InvoiceDetailBundle["job"]>(null);
  const [photos, setPhotos] = useState<InvoiceDetailBundle["photos"]>([]);
  const [serviceNotes, setServiceNotes] = useState<InvoiceDetailBundle["serviceNotes"]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [payOpen, setPayOpen] = useState(false);
  const [qboSyncing, setQboSyncing] = useState(false);
  const [qboError, setQboError] = useState<string | null>(null);
  const [writeOffOpen, setWriteOffOpen] = useState(false);
  const [writeOffReason, setWriteOffReason] = useState("");
  const [writingOff, setWritingOff] = useState(false);

  const loadInvoice = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const bundle = await invoicingApi.detail(id);
      setInvoice(bundle.invoice as Invoice);
      setLineItems(bundle.lineItems);
      setBusiness(bundle.business);
      setJob(bundle.job ?? null);
      setPhotos(bundle.photos ?? []);
      setServiceNotes(bundle.serviceNotes ?? []);
    } catch {
      setInvoice(null);
    }
    setIsLoading(false);
  }, [id]);

  useEffect(() => {
    loadInvoice();
  }, [loadInvoice]);

  if (isLoading) {
    return <div className="text-center py-20 text-[#64748B]">{t("Loading invoice...")}</div>;
  }

  if (!invoice) {
    return (
      <div className="text-center py-20">
        <p className="text-[#64748B]">{t("Invoice not found")}</p>
        <Button onClick={() => navigate("/invoicing")} className="mt-4 bg-[#0891B2] text-white">{t("Back to Invoicing")}</Button>
      </div>
    );
  }

  const items: { description: string; sku?: string | null; item_type?: string; notes?: string | null; quantity: number; rate: number; cost?: number; amount: number }[] =
    lineItems.length > 0
      ? lineItems
      : [{ description: `${invoice.status === "Draft" ? "Service" : "Weekly Maintenance"} - ${invoice.customers?.name ?? ""}`, quantity: 1, rate: invoice.amount, amount: invoice.amount }];
  const subtotal = items.reduce((sum, li) => sum + li.amount, 0);
  // Client sample estimate PDF (2026-09-06): Parts & Materials / Labor as separate subtotal lines.
  const materialsSubtotal = items.filter((li) => li.item_type !== "labor").reduce((sum, li) => sum + li.amount, 0);
  const laborSubtotal = items.filter((li) => li.item_type === "labor").reduce((sum, li) => sum + li.amount, 0);
  // Client SMS 2026-09-21: labor is not taxed -- tax applies to Parts & Materials only.
  const tax = materialsSubtotal * 0.0825;
  const total = subtotal + tax;
  const downPayment = invoice.down_payment ?? 0;
  const remainingBalance = total - downPayment;
  const totalCost = items.reduce((sum, li) => sum + (li.cost ?? 0) * li.quantity, 0);
  const jobDescription = invoice.job_description || job?.description || null;
  // customers.address is one free-text string ("street, city, ST, zip") -- street on line 1, rest on line 2.
  const customerAddressLines = (() => {
    const a = invoice.customers?.address;
    if (!a) return [] as string[];
    const i = a.indexOf(",");
    return i > 0 ? [a.slice(0, i).trim(), a.slice(i + 1).trim()] : [a];
  })();

  const handleCollectPayment = async (method: "Card" | "ACH", opaqueData?: { dataDescriptor: string; dataValue: string }) => {
    if (!id) return;
    await invoicingApi.collectPayment(id, method, opaqueData);
    setPayOpen(false);
    loadInvoice();
  };

  // Client PDF 2026-09-06: "A way to Write off a job – (bad debt)".
  const handleWriteOff = async () => {
    if (!id || !writeOffReason.trim()) return;
    setWritingOff(true);
    await invoicingApi.writeOffInvoice(id, writeOffReason.trim());
    setWritingOff(false);
    setWriteOffOpen(false);
    setWriteOffReason("");
    loadInvoice();
  };

  const handleSyncToQuickbooks = async () => {
    if (!id) return;
    setQboSyncing(true);
    setQboError(null);
    try {
      await invoicingApi.syncToQuickbooks(id);
      await loadInvoice();
    } catch (err) {
      setQboError(err instanceof Error ? err.message : "QuickBooks sync failed");
    }
    setQboSyncing(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 print:hidden">
        <button onClick={() => navigate("/invoicing")} className="p-2 rounded-lg hover:bg-[#F8FAFC] text-[#64748B]">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <h1 className="text-xl font-bold text-[#0F172A]">{invoice.number}</h1>
            <Badge className={`${statusColors[invoice.status]} text-[10px] px-1.5 py-0`}>{t(invoice.status)}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {invoice.status !== "Paid" && invoice.status !== "Written Off" && (
            <Dialog open={writeOffOpen} onOpenChange={setWriteOffOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="h-9 gap-2 border-[#E2E8F0] text-[#64748B]">
                  <Ban className="w-4 h-4" /> {t("Write Off")}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>{t("Write Off Invoice (Bad Debt)")}</DialogTitle></DialogHeader>
                <div className="space-y-3 pt-2">
                  <p className="text-sm text-[#64748B]">{t("This marks the")} ${total.toFixed(2)} {t("balance as uncollectible bad debt. This can't be undone from here.")}</p>
                  <Textarea placeholder={t("Reason (e.g. customer unreachable, bankruptcy, disputed...)")} value={writeOffReason} onChange={(e) => setWriteOffReason(e.target.value)} rows={3} />
                  <Button className="w-full bg-[#DC2626] hover:bg-[#B91C1C] text-white" onClick={handleWriteOff} disabled={writingOff || !writeOffReason.trim()}>
                    {writingOff ? t("Writing off...") : t("Confirm Write-Off")}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
          {invoice.status !== "Paid" && invoice.status !== "Written Off" && (
          <Dialog open={payOpen} onOpenChange={setPayOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#16A34A] hover:bg-[#15803D] text-white gap-2 h-9">
                <CreditCard className="w-4 h-4" /> {t("Collect Payment")}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{t("Collect Payment")}</DialogTitle></DialogHeader>
              <Tabs defaultValue="card">
                <TabsList className="w-full">
                  <TabsTrigger value="card" className="flex-1">{t("Card")}</TabsTrigger>
                  <TabsTrigger value="ach" className="flex-1">ACH</TabsTrigger>
                </TabsList>
                <TabsContent value="card" className="space-y-4 mt-4">
                  {/* Charges the full invoice total, matching the backend's computeInvoiceTotal
                      — down_payment is recorded on the invoice but not yet subtracted from what
                      gets charged here (that would need a separate down-payment-collection flow). */}
                  <CardPaymentForm amount={total} onCharge={(opaqueData) => handleCollectPayment("Card", opaqueData)} />
                </TabsContent>
                <TabsContent value="ach" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t("Bank Account")}</label>
                    <div className="h-10 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] flex items-center px-3 text-sm text-[#64748B]">
                      **** **** **** 9876
                    </div>
                  </div>
                  <Button className="w-full bg-[#16A34A] text-white" onClick={() => handleCollectPayment("ACH")}>{t("Pay")} ${total.toFixed(2)} {t("via ACH")}</Button>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
          )}
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap gap-2 print:hidden">
        <Button variant="outline" className="h-9 gap-2 border-[#E2E8F0] text-[#0F172A]">
          <Mail className="w-4 h-4 text-[#0891B2]" /> {t("Send via Email")}
        </Button>
        <Button variant="outline" className="h-9 gap-2 border-[#E2E8F0] text-[#0F172A]">
          <MessageSquare className="w-4 h-4 text-[#0891B2]" /> {t("Send via SMS")}
        </Button>
        <Button variant="outline" className="h-9 gap-2 border-[#E2E8F0] text-[#0F172A]" onClick={() => window.print()}>
          <Download className="w-4 h-4 text-[#0891B2]" /> {t("Download PDF")}
        </Button>
        <div className="ml-auto flex items-center gap-2">
          {invoice.qbo_invoice_id ? (
            <>
              <BadgeCheck className="w-4 h-4 text-[#16A34A]" />
              <span className="text-xs text-[#64748B]">{t("Synced to QuickBooks")}</span>
            </>
          ) : (
            <Button variant="outline" size="sm" className="h-8 border-[#E2E8F0] text-[#0F172A]" onClick={handleSyncToQuickbooks} disabled={qboSyncing}>
              <BadgeCheck className="w-4 h-4 text-[#0891B2]" /> {qboSyncing ? t("Syncing...") : t("Sync to QuickBooks")}
            </Button>
          )}
        </div>
      </div>
      {qboError && <div className="text-xs text-red-600 -mt-2 print:hidden">{qboError}</div>}

      {/* Invoice Document — layout mirrors the emailed invoice PDF from the client's previous
          system (client SMS 2026-09-21): dark header band with Business / Client Details /
          Billing Address / Service Details boxes, then a Breakdown of Services. */}
      <Card className="border-[#E2E8F0] shadow-sm">
        <CardContent className="p-4 sm:p-6 lg:p-8">
          <div className="rounded-xl bg-gradient-to-r from-[#0E7490] to-[#0891B2] p-3 sm:p-4 text-white [print-color-adjust:exact] [-webkit-print-color-adjust:exact]">
            <div className="flex items-center justify-center gap-3 mb-3">
              <h2 className="text-lg font-bold text-center">{t("Invoice")}</h2>
              <Badge className="bg-white/20 text-white border border-white/30 text-[10px] px-2 py-0.5 print:hidden">{t(invoice.status)}</Badge>
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
                <p>{t("Name")}: {invoice.customers?.name ?? "—"}</p>
                <p>{t("Phone #")}: {invoice.customers?.phone || "—"}</p>
                <p>{t("Invoice #")}: {invoice.number}</p>
                <p>{t("Date of Request")}: {fmtDate(job?.created_at ?? invoice.issue_date)}</p>
                <p>{t("Date of Service")}: {job ? fmtDate(job.completed_at ?? job.scheduled_date) : "—"}</p>
              </div>
              <div className="rounded-lg border border-white/30 bg-white/10 p-3 space-y-0.5">
                <p className="font-bold uppercase tracking-wide text-center mb-2 pb-1.5 border-b border-white/30">{t("Billing Address")}:</p>
                <p>{invoice.customers?.name ?? "—"}</p>
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

          {invoice.status === "Written Off" && invoice.write_off_reason && (
            <div className="mb-4 border border-[#E2E8F0] rounded-lg p-4 bg-[#64748B]/5 print:hidden">
              <p className="text-xs font-semibold text-[#64748B] uppercase mb-1 flex items-center gap-1.5"><Ban className="w-3.5 h-3.5" /> {t("Written Off (Bad Debt)")} — {invoice.write_off_date}</p>
              <p className="text-sm text-[#0F172A]">{invoice.write_off_reason}</p>
            </div>
          )}

          {/* Job Description + Trip Details (job photos) */}
          {(jobDescription || photos.length > 0) && (
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 mb-3 space-y-3">
              {jobDescription && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#0891B2] mb-1">{t("Job Description")}:</p>
                  <p className="text-xs text-[#0F172A] whitespace-pre-wrap">{jobDescription}</p>
                </div>
              )}
              {photos.length > 0 && (
                <div>
                  <p className="text-base font-bold text-[#0F172A] mb-2">{t("Trip Details")}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {photos.map((photo) => (
                      <div key={photo.id} className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-2 break-inside-avoid">
                        <img src={photo.url} alt={photo.label ?? "Job photo"} className="w-full h-36 object-contain" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Service Performed — the tech's dated job notes */}
          {serviceNotes.length > 0 && (
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 mb-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#0891B2] mb-1">{t("Service Performed")}:</p>
              <div className="space-y-1">
                {serviceNotes.map((note, i) => (
                  <p key={i} className="text-xs text-[#0F172A] whitespace-pre-wrap">
                    <span className="font-bold">{fmtDate(note.created_at)}</span> : {note.text}
                  </p>
                ))}
              </div>
            </div>
          )}

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
                      {li.notes && <p className="text-[11px] text-[#94A3B8]">{li.notes}</p>}
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

          <div className="mt-4 flex items-center justify-end gap-2 print:hidden">
            <Label htmlFor="cc-toggle" className="text-xs text-[#64748B] flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5" /> {t("Allow CC Payment")}
            </Label>
            <Switch id="cc-toggle" defaultChecked />
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
        </CardContent>
      </Card>
    </div>
  );
}
