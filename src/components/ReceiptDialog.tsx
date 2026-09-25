import { useEffect, useState } from "react";
import { Printer, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { posApi, receiptNumber, type PosOrderDetail } from "@/lib/api/pos";
import { settingsApi } from "@/lib/api/settings";
import { printReceipt, receiptLabels, type ReceiptBusiness } from "@/lib/pos-receipt";
import { useLanguage } from "@/lib/language-context";

// Client SMS 2026-09-25: "click a recent transaction and bring up a receipt, then give an option to edit (add
// notes to a receipt) then print and/or re-print" -- same from Customer > Previous Sales. One dialog for both.

const money = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(n).toFixed(2)}`;

export default function ReceiptDialog({ orderId, onClose, onSaved }: { orderId: string | null; onClose: () => void; onSaved?: () => void }) {
  const { t, lang } = useLanguage();
  // Dates follow the chosen language (they used to always print in English).
  const locale = lang === "es" ? "es-US" : "en-US";
  const [data, setData] = useState<PosOrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [business, setBusiness] = useState<ReceiptBusiness>({ businessName: "", phone: "", address: "", disclaimer: "" });
  const [printBlocked, setPrintBlocked] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    setData(null); setError(null); setPrintBlocked(false);
    posApi.order(orderId)
      .then((d) => { setData(d); setNote(d.order.note ?? ""); setSavedNote(d.order.note ?? ""); })
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load this sale"));
    settingsApi.receipt().then(setBusiness).catch(() => { /* prints without header / disclaimer */ });
  }, [orderId]);

  const dirty = data !== null && note.trim() !== (savedNote ?? "").trim();

  const saveNote = async () => {
    if (!orderId) return;
    setSaving(true);
    try {
      const r = await posApi.saveOrderNote(orderId, note);
      setSavedNote(r.note ?? "");
      onSaved?.();
    } finally {
      setSaving(false);
    }
  };

  const print = async () => {
    if (!data) return;
    const o = data.order;
    const subtotal = Number(o.subtotal);
    const tax = Number(o.tax);
    const total = Number(o.total);
    const methods = data.payments.length > 1 ? `${t("Split")} (${data.payments.map((p) => t(p.method)).join(" + ")})` : t(data.payments[0]?.method ?? o.payment_method ?? "");
    const ok = printReceipt({
      number: receiptNumber(o.id),
      date: new Date(o.created_at),
      customer: o.customer_name ?? t("Walk-in"),
      lines: data.items.map((i) => ({ name: i.description, sku: i.sku ?? "", qty: Number(i.quantity), price: Number(i.unit_price) })),
      subtotal,
      // Discount isn't stored separately; it's whatever makes subtotal + tax reach the total.
      discount: Math.max(0, Math.round((subtotal + tax - total) * 100) / 100),
      tax,
      total,
      payment: methods,
      note: note.trim() || null,
    }, business, receiptLabels(t, locale));
    setPrintBlocked(!ok);
    // Print window opens first (straight from the click, so pop-up blockers allow it), then the note is saved.
    if (dirty) await saveNote();
  };

  const o = data?.order;
  return (
    <Dialog open={orderId !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("Receipt")} {orderId ? receiptNumber(orderId) : ""}</DialogTitle>
        </DialogHeader>
        {error && <p className="text-sm text-[#DC2626]">{t(error)}</p>}
        {!data && !error && <p className="text-sm text-[#64748B] py-6 text-center">{t("Loading...")}</p>}
        {data && o && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><p className="text-xs text-[#64748B]">{t("Date")}</p><p className="font-medium text-[#0F172A]">{new Date(o.created_at).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })}</p></div>
              <div><p className="text-xs text-[#64748B]">{t("Customer")}</p><p className="font-medium text-[#0F172A]">{o.customer_name ?? t("Walk-in")}</p></div>
              {o.cashier_name && <div><p className="text-xs text-[#64748B]">{t("Cashier")}</p><p className="font-medium text-[#0F172A]">{o.cashier_name}</p></div>}
              <div>
                <p className="text-xs text-[#64748B]">{t("Payment")}</p>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {(data.payments.length ? data.payments : [{ method: o.payment_method ?? "—", amount: Number(o.total) }]).map((p, i) => (
                    <Badge key={i} className="bg-[#0891B2]/10 text-[#0891B2] text-[10px] px-1.5 py-0">{t(p.method)} {money(Number(p.amount))}</Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="border border-[#E2E8F0] rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                    <th className="text-left py-2 px-3 text-xs font-semibold text-[#64748B] uppercase">{t("Item")}</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-[#64748B] uppercase">{t("Qty")}</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-[#64748B] uppercase">{t("Price")}</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-[#64748B] uppercase">{t("Amount")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((i) => (
                    <tr key={i.id} className="border-b border-[#F1F5F9] last:border-0">
                      <td className="py-2 px-3">
                        <p className="text-[#0F172A]">{i.description}{Number(i.quantity) < 0 ? ` (${t("Return")})` : ""}</p>
                        {(i.sku || i.serial_number) && <p className="text-[11px] text-[#94A3B8]">{[i.sku, i.serial_number ? `S/N ${i.serial_number}` : null].filter(Boolean).join(" · ")}</p>}
                      </td>
                      <td className={`py-2 px-3 text-right ${Number(i.quantity) < 0 ? "text-[#DC2626]" : ""}`}>{Number(i.quantity)}</td>
                      <td className="py-2 px-3 text-right">{money(Number(i.unit_price))}</td>
                      <td className="py-2 px-3 text-right font-medium">{money(Number(i.amount))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="bg-[#F8FAFC] border-t border-[#E2E8F0] px-3 py-2 text-sm space-y-0.5">
                <div className="flex justify-between"><span className="text-[#64748B]">{t("Subtotal")}</span><span>{money(Number(o.subtotal))}</span></div>
                <div className="flex justify-between"><span className="text-[#64748B]">{t("Tax")}</span><span>{money(Number(o.tax))}</span></div>
                <div className="flex justify-between font-semibold text-[#0F172A]"><span>{t("Total")}</span><span className="text-[#0891B2]">{money(Number(o.total))}</span></div>
              </div>
            </div>

            <div>
              <Label>{t("Receipt notes")}</Label>
              <Textarea
                className="mt-1 min-h-[80px] text-sm"
                placeholder={t("Add a note to this receipt (printed on it)...")}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              {!dirty && savedNote && <p className="text-[11px] text-[#16A34A] mt-1">{t("Saved")}</p>}
            </div>
            {printBlocked && <p className="text-xs text-[#DC2626]">{t("The browser blocked the print window — allow pop-ups for this site and try again.")}</p>}

            <div className="flex flex-wrap gap-2 justify-end">
              <Button variant="outline" onClick={onClose}>{t("Close")}</Button>
              <Button variant="outline" className="gap-1.5 border-[#E2E8F0]" disabled={!dirty || saving} onClick={saveNote}>
                <Save className="w-4 h-4" /> {saving ? t("Saving...") : t("Save Notes")}
              </Button>
              <Button className="gap-1.5 bg-[#0891B2] hover:bg-[#0E7490] text-white" onClick={print}>
                <Printer className="w-4 h-4" /> {t("Print")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
