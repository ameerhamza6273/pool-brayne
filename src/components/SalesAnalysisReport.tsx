import { Fragment, useEffect, useMemo, useState } from "react";
import { Download, Printer, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ReceiptDialog from "@/components/ReceiptDialog";
import InvoicePreviewDialog from "@/components/InvoicePreviewDialog";
import { reportsApi, type SalesAnalysisRow } from "@/lib/api/reports";
import { receiptNumber } from "@/lib/api/pos";
import { useLanguage } from "@/lib/language-context";
import { matchesQuery } from "@/lib/search";
import { toCsv, downloadCsv } from "@/lib/csv";

// Client xlsx 2026-10-15 ("sample sales analysis report.xlsx" from their old ServiceWorks): "lists
// all sales for a specified date range and includes the columns as shown". Same columns, same
// grouping (by payment type with a total per group, Grand Total, then a by-mode summary).
const TYPE_ORDER: SalesAnalysisRow["paymentType"][] = ["Cash", "Check", "Credit Card", "Other", "Refund"];

type NumKey = "amount" | "delivered" | "salesCheck" | "diffAr" | "labor" | "itemCost" | "laborCost" | "customerDeposit" | "merch" | "inStoreLabor" | "jobLabor" | "discount" | "tax";
const NUM_COLS: { key: NumKey; label: string }[] = [
  { key: "amount", label: "Amount" },
  { key: "delivered", label: "Delivered" },
  { key: "salesCheck", label: "Sales check" },
  { key: "diffAr", label: "Diff/AR" },
  { key: "labor", label: "Labor" },
  { key: "itemCost", label: "Item Cost" },
  { key: "laborCost", label: "Labor Cost" },
  { key: "customerDeposit", label: "Cust Dep (not delivrd)" },
  { key: "merch", label: "Merch" },
  { key: "inStoreLabor", label: "In Store Labor" },
  { key: "jobLabor", label: "Job Labor" },
  { key: "discount", label: "Sales Discount" },
  { key: "tax", label: "Sales Tax" },
];

const money = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const sumBy = (rows: SalesAnalysisRow[], key: NumKey) => Math.round(rows.reduce((s, r) => s + r[key], 0) * 100) / 100;

export default function SalesAnalysisReport({ start, end }: { start: string; end: string }) {
  const { t, lang } = useLanguage();
  const [rows, setRows] = useState<SalesAnalysisRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [openInvoiceId, setOpenInvoiceId] = useState<string | null>(null);
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    reportsApi.salesAnalysis(start, end)
      .then((r) => setRows(r.rows))
      .catch(() => setError(t("Could not load the sales analysis report.")))
      .finally(() => setLoading(false));
  }, [start, end]); // eslint-disable-line react-hooks/exhaustive-deps

  const refNumber = (r: SalesAnalysisRow) => (r.kind === "pos" ? receiptNumber(r.refId) : r.number ?? "");
  const formatDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString(lang === "es" ? "es-US" : "en-US");

  const filtered = useMemo(
    () => (rows ?? []).filter((r) => matchesQuery(query, [refNumber(r), r.customerName, r.accountNumber, r.jobType, r.paymentType, r.paymentMode, r.payoutId])),
    [rows, query], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const groups = TYPE_ORDER.map((type) => ({ type, rows: filtered.filter((r) => r.paymentType === type) })).filter((g) => g.rows.length > 0);

  const exportCsv = () => {
    const out = filtered.map((r) => ({
      "Inv #/Tick #": refNumber(r),
      "Paid Date": r.paidDate,
      "Job Type": r.jobType ?? "",
      Status: r.status,
      "Acct #": r.accountNumber ?? "",
      "Cust Name": r.customerName ?? "Walk-in",
      "Payment Type": r.paymentType,
      "Payment Mode": r.paymentMode,
      ...Object.fromEntries(NUM_COLS.map((c) => [c.label, r[c.key].toFixed(2)])),
      "Found on Combine Inv": r.combinedInvoice ?? refNumber(r),
      "CC Payout ID": r.payoutId ?? "",
    }));
    downloadCsv(`sales-analysis-${start}-to-${end}.csv`, toCsv(out, ["Inv #/Tick #", "Paid Date", "Job Type", "Status", "Acct #", "Cust Name", "Payment Type", "Payment Mode", ...NUM_COLS.map((c) => c.label), "Found on Combine Inv", "CC Payout ID"]));
  };

  const th = "py-2 px-2 text-[11px] font-semibold text-[#64748B] uppercase whitespace-nowrap";
  const td = "py-1.5 px-2 whitespace-nowrap";
  const totalCells = (rs: SalesAnalysisRow[]) => NUM_COLS.map((c) => (
    <td key={c.key} className={`${td} text-right font-semibold ${sumBy(rs, c.key) < 0 ? "text-[#DC2626]" : "text-[#0F172A]"}`}>{money(sumBy(rs, c.key))}</td>
  ));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
          <Input className="h-9 pl-9" placeholder={t("Search invoice #, customer, phone, payment...")} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <p className="text-xs text-[#64748B] flex-1 min-w-[200px]">{t("Every payment received in the date range — invoices and Point of Sale. Click an Inv #/Tick # to open it.")}</p>
        <Button variant="outline" size="sm" className="gap-1.5" disabled={!rows} onClick={() => window.print()}>
          <Printer className="w-4 h-4" /> {t("Print")}
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" disabled={filtered.length === 0} onClick={exportCsv}>
          <Download className="w-4 h-4" /> {t("Export CSV")}
        </Button>
      </div>

      <h2 className="hidden print:block text-lg font-semibold text-[#0F172A]">{t("Sales Analysis")} · {formatDate(start)} – {formatDate(end)}</h2>

      {error && <p className="text-sm text-[#DC2626]">{error}</p>}
      {loading && !rows && <p className="text-sm text-[#64748B] py-6 text-center">{t("Loading reports...")}</p>}

      {rows && (
        <>
          <div className={`bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-auto max-h-[70vh] print:max-h-none print:overflow-visible ${loading ? "opacity-60" : ""}`}>
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10 bg-[#F8FAFC]">
                <tr className="border-b border-[#E2E8F0]">
                  <th className={`${th} text-left`}>{t("Inv #/Tick #")}</th>
                  <th className={`${th} text-left`}>{t("Paid Date")}</th>
                  <th className={`${th} text-left`}>{t("Job Type")}</th>
                  <th className={`${th} text-left`}>{t("Status")}</th>
                  <th className={`${th} text-left`}>{t("Acct #")}</th>
                  <th className={`${th} text-left`}>{t("Cust Name")}</th>
                  <th className={`${th} text-left`}>{t("Payment Type")}</th>
                  <th className={`${th} text-left`}>{t("Payment Mode")}</th>
                  {NUM_COLS.map((c) => <th key={c.key} className={`${th} text-right`}>{t(c.label)}</th>)}
                  <th className={`${th} text-left`}>{t("Found on Combine Inv")}</th>
                  <th className={`${th} text-left`}>{t("CC Payout ID")}</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <Fragment key={g.type}>
                    {g.rows.map((r) => (
                      <tr key={r.key} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC]">
                        <td className={td}>
                          <button className="font-medium text-[#0891B2] hover:underline" onClick={() => (r.kind === "pos" ? setOpenOrderId(r.refId) : setOpenInvoiceId(r.refId))}>{refNumber(r)}</button>
                        </td>
                        <td className={`${td} text-[#64748B]`}>{formatDate(r.paidDate)}</td>
                        <td className={`${td} text-[#64748B]`}>{r.jobType ? t(r.jobType) : ""}</td>
                        <td className={`${td} ${r.status === "Delivered" ? "text-[#16A34A]" : "text-[#B45309]"}`}>{t(r.status)}</td>
                        <td className={`${td} text-[#64748B]`}>{r.accountNumber ?? ""}</td>
                        <td className={`${td} text-[#0F172A] font-medium`}>{r.customerName ?? t("Walk-in")}</td>
                        <td className={`${td} text-[#0F172A]`}>{t(r.paymentType)}</td>
                        <td className={`${td} text-[#64748B]`}>{t(r.paymentMode)}</td>
                        {NUM_COLS.map((c) => (
                          <td key={c.key} className={`${td} text-right ${r[c.key] < 0 ? "text-[#DC2626]" : "text-[#0F172A]"}`}>{money(r[c.key])}</td>
                        ))}
                        <td className={`${td} text-[#64748B]`}>{r.combinedInvoice ?? refNumber(r)}</td>
                        <td className={`${td} text-[#64748B]`}>{r.payoutId ?? ""}</td>
                      </tr>
                    ))}
                    <tr className="bg-[#F1F5F9] border-b border-[#E2E8F0]">
                      <td colSpan={8} className={`${td} text-right font-semibold text-[#0F172A]`}>{t(g.type)} {t("Total")}</td>
                      {totalCells(g.rows)}
                      <td colSpan={2} />
                    </tr>
                  </Fragment>
                ))}
              </tbody>
              {groups.length > 0 && (
                <tfoot className="sticky bottom-0 bg-[#E0F2FE]">
                  <tr className="border-t-2 border-[#0891B2]">
                    <td colSpan={8} className={`${td} text-right font-bold text-[#0F172A]`}>{t("Grand Total")}</td>
                    {totalCells(filtered)}
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
            {filtered.length === 0 && <p className="text-sm text-[#64748B] text-center py-6">{t("No payments in this date range.")}</p>}
          </div>

          {groups.length > 0 && (
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm max-w-xs">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="text-left py-2 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Mode Type")}</th>
                    <th className="text-right py-2 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Amount")}</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => (
                    <tr key={g.type} className="border-b border-[#F1F5F9]">
                      <td className="py-2 px-4 text-[#0F172A]">{t(g.type)}</td>
                      <td className={`py-2 px-4 text-right ${sumBy(g.rows, "amount") < 0 ? "text-[#DC2626]" : "text-[#0F172A]"}`}>{money(sumBy(g.rows, "amount"))}</td>
                    </tr>
                  ))}
                  <tr className="bg-[#F8FAFC]">
                    <td className="py-2 px-4 font-semibold text-[#0F172A]">{t("Grand Total")}</td>
                    <td className="py-2 px-4 text-right font-bold text-[#0891B2]">{money(sumBy(filtered, "amount"))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <ReceiptDialog orderId={openOrderId} onClose={() => setOpenOrderId(null)} />
      <InvoicePreviewDialog invoiceId={openInvoiceId} onClose={() => setOpenInvoiceId(null)} />
    </div>
  );
}
