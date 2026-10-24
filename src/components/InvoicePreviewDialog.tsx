import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { invoicingApi, type InvoiceDetailBundle } from "@/lib/api/invoicing";
import { useTaxRate } from "@/hooks/use-tax-rate";
import { useLanguage } from "@/lib/language-context";

// Client video 2026-10-15: "click here and then see the invoice pop up ...
export default function InvoicePreviewDialog({ invoiceId, onClose, allowOpenFull = true }: { invoiceId: string | null; onClose: () => void; allowOpenFull?: boolean }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const taxRate = useTaxRate();
  const [bundle, setBundle] = useState<InvoiceDetailBundle | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!invoiceId) return;
    setBundle(null);
    setError(null);
    invoicingApi.detail(invoiceId)
      .then(setBundle)
      .catch(() => setError(t("Could not load this invoice.")));
  }, [invoiceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const invoice = bundle?.invoice;
  const items: { id?: string; description: string; item_type?: string; quantity: number; rate: number; amount: number; taxable?: boolean | null }[] =
    bundle && invoice
      ? bundle.lineItems.length > 0
        ? bundle.lineItems
        : [{ description: invoice.job_description ?? t("Service"), quantity: 1, rate: invoice.amount, amount: invoice.amount }]
      : [];
  const subtotal = items.reduce((s, li) => s + Number(li.amount), 0);
  const taxableSubtotal = items.filter((li) => li.taxable ?? li.item_type !== "labor").reduce((s, li) => s + Number(li.amount), 0);
  const tax = taxableSubtotal * taxRate;
  const total = subtotal + tax;

  return (
    <Dialog open={invoiceId !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {t("Invoice")} {invoice?.number ?? ""}
            {invoice && <Badge className="bg-[#0891B2]/10 text-[#0891B2] text-[10px] px-1.5 py-0">{t(invoice.status)}</Badge>}
          </DialogTitle>
        </DialogHeader>

        {error && <p className="text-sm text-[#DC2626]">{error}</p>}
        {!bundle && !error && <p className="text-sm text-[#64748B]">{t("Loading...")}</p>}

        {bundle && invoice && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <div><p className="text-xs text-[#64748B] uppercase">{t("Issued")}</p><p className="font-medium text-[#0F172A]">{invoice.issue_date ?? "—"}</p></div>
              <div><p className="text-xs text-[#64748B] uppercase">{t("Due Date")}</p><p className="font-medium text-[#0F172A]">{invoice.due_date ?? "—"}</p></div>
              <div><p className="text-xs text-[#64748B] uppercase">{t("Paid")}</p><p className="font-medium text-[#0F172A]">{invoice.paid_date ?? "—"}</p></div>
            </div>
            {bundle.job?.description && (
              <div><p className="text-xs text-[#64748B] uppercase">{t("Job Description")}</p><p className="text-sm text-[#0F172A] whitespace-pre-wrap">{bundle.job.description}</p></div>
            )}

            <div className="rounded-lg border border-[#E2E8F0] overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                    <th className="text-left py-2 px-3 text-xs font-semibold text-[#64748B] uppercase">{t("Description")}</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-[#64748B] uppercase">{t("Qty")}</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-[#64748B] uppercase">{t("Rate")}</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-[#64748B] uppercase">{t("Amount")}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((li, i) => (
                    <tr key={li.id ?? i} className="border-b border-[#F1F5F9] last:border-0">
                      <td className="py-2 px-3 text-[#0F172A]">{li.description}</td>
                      <td className="py-2 px-3 text-right text-[#64748B]">{li.quantity}</td>
                      <td className="py-2 px-3 text-right text-[#64748B]">${Number(li.rate).toFixed(2)}</td>
                      <td className="py-2 px-3 text-right text-[#0F172A]">${Number(li.amount).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="ml-auto max-w-xs space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-[#64748B]">{t("Subtotal")}</span><span>${subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-[#64748B]">{t("Tax")} ({(taxRate * 100).toFixed(2)}%)</span><span>${tax.toFixed(2)}</span></div>
              <div className="flex justify-between pt-1 border-t border-[#E2E8F0] font-semibold"><span>{t("Total")}</span><span className="text-[#0891B2]">${total.toFixed(2)}</span></div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onClose}>{t("Close")}</Button>
              {allowOpenFull && (
                <Button className="bg-[#0891B2] text-white gap-1.5" onClick={() => navigate(`/invoicing/${invoice.id}`)}>
                  <ExternalLink className="w-4 h-4" /> {t("Open Full Invoice")}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
