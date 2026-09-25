// Client video 2026-09-25: POS receipts had no printout at all (the dialog's Print button only closed it)
// and no place for a return/refund disclaimer ("no returns on chemicals", "30 days to return", ...). This
// builds a narrow printable receipt in its own window, with the tenant's editable disclaimer at the bottom.

export type ReceiptLine = { name: string; sku: string; qty: number; price: number };
export type ReceiptData = {
  number: string;
  date: Date;
  customer: string;
  lines: ReceiptLine[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  payment: string;
  note: string | null;
};
export type ReceiptBusiness = { businessName: string; phone: string; address: string; disclaimer: string };
// Printed labels follow the app language (pass t("...") values); English by default.
export type ReceiptLabels = { receipt: string; date: string; customer: string; subtotal: string; discount: string; tax: string; total: string; paidBy: string; ret: string; thanks: string; locale: string };
const DEFAULT_LABELS: ReceiptLabels = { receipt: "Receipt", date: "Date", customer: "Customer", subtotal: "Subtotal", discount: "Discount", tax: "Tax", total: "Total", paidBy: "Paid by", ret: "Return", thanks: "Thank you!", locale: "en-US" };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
const money = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(n).toFixed(2)}`;

export function receiptHtml(r: ReceiptData, b: ReceiptBusiness, labels?: Partial<ReceiptLabels>): string {
  const L = { ...DEFAULT_LABELS, ...labels };
  const rows = r.lines.map((l) => `
    <tr><td colspan="3" class="name">${esc(l.name)}${l.qty < 0 ? ` (${esc(L.ret)})` : ""}</td></tr>
    <tr class="sub"><td>${esc(l.sku)}</td><td>${l.qty} x ${money(l.price)}</td><td class="r">${money(l.qty * l.price)}</td></tr>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(r.number)}</title>
<style>
  @page { margin: 0; }
  body { font-family: -apple-system, Segoe UI, Arial, sans-serif; font-size: 12px; color: #0F172A; margin: 0; padding: 16px; }
  .wrap { max-width: 300px; margin: 0 auto; }
  h1 { font-size: 16px; text-align: center; margin: 0 0 2px; }
  .c { text-align: center; color: #475569; }
  hr { border: 0; border-top: 1px dashed #94A3B8; margin: 8px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 1px 0; vertical-align: top; }
  .name { font-weight: 600; padding-top: 4px; }
  .sub td { color: #475569; }
  .r { text-align: right; white-space: nowrap; }
  .tot td { padding: 2px 0; }
  .grand td { font-size: 14px; font-weight: 700; border-top: 1px solid #0F172A; padding-top: 4px; }
  .disc { white-space: pre-wrap; font-size: 11px; color: #334155; text-align: center; }
</style></head><body><div class="wrap">
  <h1>${esc(b.businessName || L.receipt)}</h1>
  ${b.address ? `<div class="c">${esc(b.address)}</div>` : ""}
  ${b.phone ? `<div class="c">${esc(b.phone)}</div>` : ""}
  <hr>
  <div>${esc(L.receipt)}: <b>${esc(r.number)}</b></div>
  <div>${esc(L.date)}: ${esc(r.date.toLocaleString(L.locale))}</div>
  <div>${esc(L.customer)}: ${esc(r.customer)}</div>
  <hr>
  <table>${rows}</table>
  <hr>
  <table class="tot">
    <tr><td>${esc(L.subtotal)}</td><td class="r">${money(r.subtotal)}</td></tr>
    ${r.discount ? `<tr><td>${esc(L.discount)}</td><td class="r">-${money(r.discount)}</td></tr>` : ""}
    <tr><td>${esc(L.tax)}</td><td class="r">${money(r.tax)}</td></tr>
    <tr class="grand"><td>${esc(L.total)}</td><td class="r">${money(r.total)}</td></tr>
    <tr><td>${esc(L.paidBy)}</td><td class="r">${esc(r.payment)}</td></tr>
  </table>
  ${r.note ? `<hr><div>${esc(r.note)}</div>` : ""}
  ${b.disclaimer ? `<hr><div class="disc">${esc(b.disclaimer)}</div>` : ""}
  <hr><div class="c">${esc(L.thanks)}</div>
</div></body></html>`;
}

// Opened synchronously from the click (popup blockers), then printed once the content has rendered.
export function printReceipt(r: ReceiptData, b: ReceiptBusiness, labels?: Partial<ReceiptLabels>) {
  const w = window.open("", "_blank", "width=420,height=640");
  if (!w) return false;
  w.document.open();
  w.document.write(receiptHtml(r, b, labels));
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 250);
  return true;
}

export const receiptLabels = (t: (s: string) => string, locale: string): ReceiptLabels => ({
  receipt: t("Receipt"), date: t("Date"), customer: t("Customer"), subtotal: t("Subtotal"), discount: t("Discount"),
  tax: t("Tax"), total: t("Total"), paidBy: t("Paid by"), ret: t("Return"), thanks: t("Thank you!"), locale,
});
