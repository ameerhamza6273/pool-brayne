import { Fragment, useEffect, useState } from "react";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ReceiptDialog from "@/components/ReceiptDialog";
import InvoicePreviewDialog from "@/components/InvoicePreviewDialog";
import { reportsApi, type SalesTaxBasis, type SalesTaxDetail, type SalesTaxGroup } from "@/lib/api/reports";
import { receiptNumber } from "@/lib/api/pos";
import { useLanguage } from "@/lib/language-context";
import { toCsv, downloadCsv } from "@/lib/csv";

// Client PDF 2026-10-15 ("Sales Tax - Accrual Basis - ServiceWorks.pdf"): detail sales-tax report, parameters date range + accrual/cash basis, "by..."
const money = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(n).toFixed(2)}`;

export default function SalesTaxDetailReport({ start, end }: { start: string; end: string }) {
  const { t, lang } = useLanguage();
  const [basis, setBasis] = useState<SalesTaxBasis>(() => {
    try { return localStorage.getItem("sales-tax-basis") === "cash" ? "cash" : "accrual"; } catch { return "accrual"; }
  });
  const [report, setReport] = useState<SalesTaxDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openInvoiceId, setOpenInvoiceId] = useState<string | null>(null);
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);

  useEffect(() => {
    try { localStorage.setItem("sales-tax-basis", basis); } catch { /* per-viewer convenience only */ }
    setLoading(true);
    setError(null);
    reportsApi.salesTaxDetail(start, end, basis)
      .then(setReport)
      .catch(() => setError(t("Could not load the sales tax report.")))
      .finally(() => setLoading(false));
  }, [start, end, basis]); // eslint-disable-line react-hooks/exhaustive-deps

  const groupLabel = (g: SalesTaxGroup) => (g.kind === "pos" ? `${t("Receipt")} ${receiptNumber(g.id)}` : `${t("Invoice")} ${g.number}`);
  const formatDate = (d: string | null) => (d ? new Date(d + "T00:00:00").toLocaleDateString(lang === "es" ? "es-US" : "en-US") : "—");
  const open = (g: SalesTaxGroup) => (g.kind === "pos" ? setOpenOrderId(g.id) : setOpenInvoiceId(g.id));

  const exportCsv = () => {
    if (!report) return;
    const rows = report.groups.flatMap((g) => g.lines.map((l) => ({
      "Invoice / Receipt #": g.kind === "pos" ? receiptNumber(g.id) : g.number ?? "",
      Date: g.date ?? "",
      Customer: g.customerName ?? "Walk-in",
      "Job Type": g.jobType ?? (g.kind === "pos" ? "Point of Sale" : ""),
      Brand: l.brand ?? "",
      "Item #": l.itemNumber ?? "",
      Description: l.description,
      Category: l.category,
      Qty: l.quantity,
      Price: l.price.toFixed(2),
      "Tax Paid": l.tax.toFixed(2),
    })));
    downloadCsv(`sales-tax-${basis}-${start}-to-${end}.csv`, toCsv(rows, ["Invoice / Receipt #", "Date", "Customer", "Job Type", "Brand", "Item #", "Description", "Category", "Qty", "Price", "Tax Paid"]));
  };

  const th = "py-2 px-3 text-xs font-semibold text-[#64748B] uppercase";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <div className="flex items-center gap-2">
          <span className="text-sm text-[#64748B]">{t("Basis")}</span>
          <Select value={basis} onValueChange={(v) => setBasis(v as SalesTaxBasis)}>
            <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="accrual">{t("Accrual Basis")}</SelectItem>
              <SelectItem value="cash">{t("Cash Basis")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-[#64748B] flex-1 min-w-[200px]">
          {basis === "accrual"
            ? t("Accrual: invoices by issue date, plus Point of Sale sales by sale date.")
            : t("Cash: only money actually received in the date range — invoice payments by payment date (partial payments count only the part paid), plus Point of Sale sales.")}
        </p>
        <Button variant="outline" size="sm" className="gap-1.5" disabled={!report} onClick={() => window.print()}>
          <Printer className="w-4 h-4" /> {t("Print")}
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" disabled={!report || report.groups.length === 0} onClick={exportCsv}>
          <Download className="w-4 h-4" /> {t("Export CSV")}
        </Button>
      </div>

      <h2 className="hidden print:block text-lg font-semibold text-[#0F172A]">
        {t("Sales Tax")} — {basis === "accrual" ? t("Accrual Basis") : t("Cash Basis")} · {formatDate(start)} – {formatDate(end)}
      </h2>

      {error && <p className="text-sm text-[#DC2626]">{error}</p>}
      {loading && !report && <p className="text-sm text-[#64748B] py-6 text-center">{t("Loading reports...")}</p>}

      {report && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: t("Orders / Jobs"), value: String(report.totals.orders) },
              { label: t("Total Sales"), value: money(report.totals.sales) },
              { label: t("Taxable Sales"), value: money(report.totals.taxableSales) },
              { label: t("Non-taxable Sales"), value: money(report.totals.nontaxableSales) },
              { label: `${t("Tax Collected")} (${(report.taxRate * 100).toFixed(2)}%)`, value: money(report.totals.tax), accent: true },
            ].map((c) => (
              <div key={c.label} className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-4">
                <p className="text-xs font-semibold text-[#64748B] uppercase">{c.label}</p>
                <p className={`text-lg font-bold mt-1 ${c.accent ? "text-[#0891B2]" : "text-[#0F172A]"}`}>{c.value}</p>
              </div>
            ))}
          </div>

          <div className={`bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-x-auto ${loading ? "opacity-60" : ""}`}>
            <table className="w-full text-sm min-w-[860px]">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <th className={`${th} text-left`}>{t("Brand")}</th>
                  <th className={`${th} text-left`}>{t("Item #")}</th>
                  <th className={`${th} text-left`}>{t("Description")}</th>
                  <th className={`${th} text-left`}>{t("Category")}</th>
                  <th className={`${th} text-right`}>{t("Qty")}</th>
                  <th className={`${th} text-right`}>{t("Price")}</th>
                  <th className={`${th} text-right`}>{t("Tax Paid")}</th>
                </tr>
              </thead>
              <tbody>
                {report.groups.map((g) => {
                  const subPrice = g.lines.reduce((s, l) => s + l.price, 0);
                  const subTax = g.lines.reduce((s, l) => s + l.tax, 0);
                  return (
                    <Fragment key={`${g.kind}-${g.id}`}>
                      <tr className="bg-[#F1F5F9] border-t border-[#E2E8F0]">
                        <td colSpan={7} className="py-2 px-3">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <button className="font-semibold text-[#0891B2] hover:underline" onClick={() => open(g)}>{groupLabel(g)}</button>
                            <span className="text-[#0F172A] font-medium">{g.customerName ?? t("Walk-in")}</span>
                            <span className="text-xs text-[#64748B]">{formatDate(g.date)}</span>
                            <span className="text-xs text-[#64748B]">{g.kind === "pos" ? t("Point of Sale") : g.jobType ? t(g.jobType) : t("Invoice")}</span>
                            {g.kind === "invoice" && <span className="text-xs text-[#64748B]">· {t(g.status)}</span>}
                            {g.paidShare != null && g.paidShare < 100 && (
                              <span className="text-xs text-[#B45309]">· {t("Paid in range")}: {g.paidShare}%</span>
                            )}
                          </div>
                        </td>
                      </tr>
                      {g.lines.map((l, i) => (
                        <tr key={i} className="border-b border-[#F1F5F9]">
                          <td className="py-2 px-3 text-[#64748B]">{l.brand ?? "—"}</td>
                          <td className="py-2 px-3 text-[#64748B]">{l.itemNumber ?? "—"}</td>
                          <td className="py-2 px-3 text-[#0F172A]">{l.description}</td>
                          <td className="py-2 px-3 text-xs text-[#64748B] whitespace-nowrap">{t(l.category)}</td>
                          <td className="py-2 px-3 text-right text-[#64748B]">{l.quantity}</td>
                          <td className="py-2 px-3 text-right text-[#0F172A]">{money(l.price)}</td>
                          <td className="py-2 px-3 text-right font-medium text-[#0891B2]">{money(l.tax)}</td>
                        </tr>
                      ))}
                      <tr className="border-b border-[#E2E8F0]">
                        <td colSpan={5} className="py-1.5 px-3 text-right text-xs text-[#64748B]">{t("Subtotal")}</td>
                        <td className="py-1.5 px-3 text-right text-xs font-semibold text-[#0F172A]">{money(subPrice)}</td>
                        <td className="py-1.5 px-3 text-right text-xs font-semibold text-[#0F172A]">{money(subTax)}</td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
              {report.groups.length > 0 && (
                <tfoot>
                  <tr className="bg-[#F8FAFC] border-t-2 border-[#E2E8F0]">
                    <td colSpan={5} className="py-3 px-3 text-right font-semibold text-[#0F172A]">{t("Total")}</td>
                    <td className="py-3 px-3 text-right font-bold text-[#0F172A]">{money(report.totals.sales)}</td>
                    <td className="py-3 px-3 text-right font-bold text-[#0891B2]">{money(report.totals.tax)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
            {report.groups.length === 0 && <p className="text-sm text-[#64748B] text-center py-6">{t("No orders in this date range.")}</p>}
          </div>
        </>
      )}

      <ReceiptDialog orderId={openOrderId} onClose={() => setOpenOrderId(null)} />
      <InvoicePreviewDialog invoiceId={openInvoiceId} onClose={() => setOpenInvoiceId(null)} />
    </div>
  );
}
