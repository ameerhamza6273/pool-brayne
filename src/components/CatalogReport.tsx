import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Printer, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ReceiptDialog from "@/components/ReceiptDialog";
import { useSort, SortTh } from "@/components/SortableTh";
import { reportCatalogApi, type CatalogColType, type CatalogColumn, type CatalogReportData, type CatalogRow } from "@/lib/api/reportCatalog";
import { useLanguage } from "@/lib/language-context";
import { matchesQuery } from "@/lib/search";
import { toCsv, downloadCsv } from "@/lib/csv";

// Renders any table report from the report catalog (backend routes/reportCatalog.ts): summary
// cards, search, click-to-sort headers, a totals row, CSV export, print, and links to the job /
// invoice / estimate / customer / POS receipt behind a row.
const PAGE_SIZE = 100;
const money = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const isNumeric = (type?: CatalogColType) => type === "money" || type === "number" || type === "hours" || type === "percent";

export default function CatalogReport({ reportId, title, start, end }: { reportId: string; title: string; start: string; end: string }) {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const [data, setData] = useState<CatalogReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    reportCatalogApi.get(reportId, start, end)
      .then((d) => { if (!cancelled) { setData(d); setPage(1); } })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reportId, start, end]);

  const columns = data?.columns ?? [];
  const fmtDate = (s: string) => {
    const d = new Date(`${s.slice(0, 10)}T00:00:00`);
    return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString(lang === "es" ? "es-US" : "en-US", { month: "short", day: "numeric", year: "numeric" });
  };
  const format = (col: CatalogColumn, v: CatalogRow[string]) => {
    if (v == null || v === "") return "—";
    if (col.type === "money") return money(Number(v));
    if (col.type === "percent") return `${Number(v).toFixed(1)}%`;
    if (col.type === "hours") return Number(v).toFixed(2);
    if (col.type === "number") return Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 });
    if (col.type === "date") return fmtDate(String(v));
    return col.translate ? t(String(v)) : String(v);
  };

  const filtered = useMemo(
    () => (data?.rows ?? []).filter((r) => matchesQuery(query, columns.map((c) => (r[c.key] == null ? null : String(r[c.key]))))),
    [data, query, columns],
  );
  const sort = useSort(filtered, (r, key) => {
    const v = r[key];
    return typeof v === "boolean" ? String(v) : v;
  });
  const totalPages = Math.max(1, Math.ceil(sort.sorted.length / PAGE_SIZE));
  const pageRows = sort.sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totals = useMemo(() => {
    const out: Record<string, number> = {};
    for (const c of columns) if (c.total) out[c.key] = Math.round(filtered.reduce((s, r) => s + Number(r[c.key] ?? 0), 0) * 100) / 100;
    return out;
  }, [columns, filtered]);
  const hasTotals = columns.some((c) => c.total);

  const openLink = (col: CatalogColumn, row: CatalogRow) => {
    const id = row[col.linkKey ?? col.key];
    if (!id || typeof id !== "string") return;
    const kind = (row[`${col.key}__kind`] as string | undefined) ?? col.link;
    if (kind === "job") navigate(`/jobs/${id}`);
    else if (kind === "invoice") navigate(`/invoicing/${id}`);
    else if (kind === "estimate") navigate(`/invoicing/estimates/${id}`);
    else if (kind === "customer") navigate(`/customers/${id}`);
    else if (kind === "pos") setOpenOrderId(id);
  };

  const exportCsv = () => {
    const headers = columns.map((c) => t(c.label));
    const rows = sort.sorted.map((r) => Object.fromEntries(columns.map((c, i) => [headers[i], c.type === "money" || c.type === "hours" || c.type === "number" || c.type === "percent" ? (r[c.key] ?? "") : format(c, r[c.key])])));
    downloadCsv(`${reportId}-${start}-to-${end}.csv`, toCsv(rows, headers));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 print:hidden">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
          <Input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder={t("Search this report...")} className="pl-9 h-10 bg-white border-[#E2E8F0]" />
        </div>
        <Button variant="outline" className="h-10 gap-2 border-[#E2E8F0]" disabled={!data} onClick={exportCsv}>
          <Download className="w-4 h-4" /> {t("Export")}
        </Button>
        <Button variant="outline" className="h-10 gap-2 border-[#E2E8F0]" disabled={!data} onClick={() => window.print()}>
          <Printer className="w-4 h-4" /> {t("Print")}
        </Button>
      </div>
      <h2 className="hidden print:block text-lg font-semibold text-[#0F172A]">{t(title)} — {fmtDate(start)} – {fmtDate(end)}</h2>

      {loading && <div className="text-center py-8 text-[#64748B]">{t("Loading...")}</div>}
      {!loading && error && <div className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]">{t("Could not load this report.")} {error}</div>}

      {!loading && data && (
        <>
          {data.note && <p className="text-xs text-[#64748B]">{t(data.note)}</p>}
          {data.summary && data.summary.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {data.summary.map((s) => (
                <div key={s.label} className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm px-4 py-3">
                  <p className="text-xs text-[#64748B]">{t(s.label)}</p>
                  <p className="text-lg font-semibold text-[#0F172A]">{typeof s.value === "number" ? format({ key: "", label: "", type: s.type }, s.value) : s.value}</p>
                </div>
              ))}
            </div>
          )}
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    {columns.map((c) => (
                      <SortTh key={c.key} label={t(c.label)} sortKey={c.key} active={sort.sortKey} dir={sort.sortDir} onClick={sort.toggleSort} align={isNumeric(c.type) ? "right" : "left"} />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((r, i) => (
                    <tr key={i} className={`border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] ${r._emphasis ? "bg-[#F8FAFC] font-semibold" : ""}`}>
                      {columns.map((c) => {
                        const text = format(c, r[c.key]);
                        const linkable = c.link && r[c.linkKey ?? c.key];
                        const negative = isNumeric(c.type) && Number(r[c.key]) < 0;
                        return (
                          <td key={c.key} className={`py-2.5 px-4 ${isNumeric(c.type) ? "text-right tabular-nums" : ""} ${negative ? "text-[#DC2626]" : "text-[#0F172A]"} ${statusTone(text)}`}>
                            {linkable ? (
                              <button className="text-[#0891B2] hover:underline text-left" onClick={() => openLink(c, r)}>{text}</button>
                            ) : text}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={Math.max(1, columns.length)} className="py-8 text-center text-[#64748B]">{t("Nothing to show for this date range")}</td></tr>
                  )}
                </tbody>
                {hasTotals && filtered.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-[#E2E8F0] bg-[#F8FAFC] font-semibold">
                      {columns.map((c, i) => (
                        <td key={c.key} className={`py-2.5 px-4 ${isNumeric(c.type) ? "text-right tabular-nums" : ""}`}>
                          {c.total ? format(c, totals[c.key]) : i === 0 ? t("Total") : ""}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            {sort.sorted.length > PAGE_SIZE && (
              <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#E2E8F0] text-sm print:hidden">
                <p className="text-[#64748B] text-xs">
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sort.sorted.length)} {t("of")} {sort.sorted.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="h-7 text-xs border-[#E2E8F0]" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t("Previous")}</Button>
                  <span className="text-[#64748B] text-xs">{t("Page")} {page} {t("of")} {totalPages}</span>
                  <Button variant="outline" size="sm" className="h-7 text-xs border-[#E2E8F0]" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>{t("Next")}</Button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
      <ReceiptDialog orderId={openOrderId} onClose={() => setOpenOrderId(null)} />
    </div>
  );
}

// Dispatch Risk Board's status words get a color so jeopardy rows stand out.
function statusTone(text: string) {
  if (text === "In jeopardy" || text === "En riesgo") return "!text-[#DC2626] font-medium";
  if (text === "Waiting on PO" || text === "Esperando OC") return "!text-[#D97706] font-medium";
  return "";
}
