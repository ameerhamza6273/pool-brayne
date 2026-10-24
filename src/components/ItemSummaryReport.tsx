import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ReceiptDialog from "@/components/ReceiptDialog";
import { type ItemMovementRow } from "@/lib/api/reports";
import { receiptNumber } from "@/lib/api/pos";
import { useLanguage } from "@/lib/language-context";

// Client video 2026-10-18 + screenshots of their old QuickBooks POS "Item Summary": "I would like the quantity to be the..."
export type ItemSummaryRow = {
  itemId: string; itemNumber: string | null; item: string; sku: string; category: string;
  qtySold: number; extPrice: number; extCost: number; writtenOff: number; transactions: number;
};

type SortKey = keyof ItemSummaryRow;

export function summarizeItems(rows: ItemMovementRow[]): ItemSummaryRow[] {
  const byItem = new Map<string, ItemSummaryRow>();
  for (const m of rows) {
    let r = byItem.get(m.item_id);
    if (!r) {
      r = { itemId: m.item_id, itemNumber: m.item_number, item: m.item, sku: m.sku, category: m.category, qtySold: 0, extPrice: 0, extCost: 0, writtenOff: 0, transactions: 0 };
      byItem.set(m.item_id, r);
    }
    if (m.ref_type === "writeoff") {
      r.writtenOff += Number(m.qty);
      continue;
    }
    r.qtySold += Number(m.qty);
    r.extPrice += Number(m.total_price ?? 0);
    r.extCost += Number(m.total_cost ?? 0);
    r.transactions += 1;
  }
  return [...byItem.values()];
}

const money = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ItemSummaryReport({ rows, summary }: { rows: ItemMovementRow[]; summary: ItemSummaryRow[] }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "qtySold", dir: "desc" });
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...summary].sort((a, b) => {
      const va = a[sort.key], vb = b[sort.key];
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va ?? "").localeCompare(String(vb ?? ""), undefined, { numeric: true, sensitivity: "base" });
      return cmp * dir;
    });
  }, [summary, sort]);
  const toggleSort = (key: SortKey, numeric: boolean) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: numeric ? "desc" : "asc" }));

  const openItem = summary.find((s) => s.itemId === openItemId) ?? null;
  const transactions = useMemo(
    () => rows.filter((m) => m.item_id === openItemId && m.ref_type !== "writeoff").sort((a, b) => String(b.movement_date).localeCompare(String(a.movement_date))),
    [rows, openItemId],
  );
  const refLabel = (m: ItemMovementRow) => (m.ref_type === "pos" ? receiptNumber(m.ref_id ?? "", m.ref_number) : m.ref_number || `JOB-${(m.ref_id ?? "").slice(0, 8).toUpperCase()}`);

  const th = (key: SortKey, label: string, numeric = false) => (
    <th
      className={`py-3 px-4 text-xs font-semibold text-[#64748B] uppercase cursor-pointer select-none hover:text-[#0891B2] whitespace-nowrap ${numeric ? "text-right" : "text-left"}`}
      onClick={() => toggleSort(key, numeric)}
    >
      <span className="inline-flex items-center gap-1">
        {t(label)}{sort.key === key && <span className="text-[10px]">{sort.dir === "asc" ? "▲" : "▼"}</span>}
      </span>
    </th>
  );
  const totalQty = summary.reduce((s, r) => s + r.qtySold, 0);
  const totalPrice = summary.reduce((s, r) => s + r.extPrice, 0);
  const totalCost = summary.reduce((s, r) => s + r.extCost, 0);

  return (
    <>
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                {th("item", "Item")}
                {th("itemNumber", "Item #")}
                {th("qtySold", "Qty Sold", true)}
                {th("extPrice", "Ext Price", true)}
                {th("extCost", "Ext Cost", true)}
                {th("sku", "SKU")}
                {th("category", "Category")}
                {th("transactions", "Transactions", true)}
                {th("writtenOff", "Written Off", true)}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.itemId} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] cursor-pointer" onClick={() => setOpenItemId(r.itemId)}>
                  <td className="py-2.5 px-4 font-medium text-[#0891B2]">{r.item}</td>
                  <td className="py-2.5 px-4 text-[#64748B]">{r.itemNumber ?? "—"}</td>
                  <td className="py-2.5 px-4 text-right font-semibold text-[#0F172A]">{r.qtySold}</td>
                  <td className="py-2.5 px-4 text-right text-[#0F172A]">{money(r.extPrice)}</td>
                  <td className="py-2.5 px-4 text-right text-[#64748B]">{money(r.extCost)}</td>
                  <td className="py-2.5 px-4 text-[#64748B]">{r.sku}</td>
                  <td className="py-2.5 px-4 text-[#64748B]">{t(r.category)}</td>
                  <td className="py-2.5 px-4 text-right text-[#64748B]">{r.transactions}</td>
                  <td className="py-2.5 px-4 text-right text-[#64748B]">{r.writtenOff || "—"}</td>
                </tr>
              ))}
              {summary.length === 0 && <tr><td colSpan={9} className="py-8 text-center text-[#64748B]">{t("No movement in this date range")}</td></tr>}
            </tbody>
            {summary.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-[#0891B2] bg-[#E0F2FE]">
                  <td colSpan={2} className="py-2.5 px-4 font-bold text-[#0F172A]">{t("Total")}</td>
                  <td className="py-2.5 px-4 text-right font-bold text-[#0F172A]">{totalQty}</td>
                  <td className="py-2.5 px-4 text-right font-bold text-[#0F172A]">{money(totalPrice)}</td>
                  <td className="py-2.5 px-4 text-right font-semibold text-[#64748B]">{money(totalCost)}</td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <Dialog open={!!openItem} onOpenChange={(o) => !o && setOpenItemId(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{openItem?.item}</DialogTitle>
          </DialogHeader>
          {openItem && (
            <p className="text-sm text-[#64748B]">
              {t("Item #")} {openItem.itemNumber ?? "—"} · {t("Qty Sold")}: <span className="font-semibold text-[#0F172A]">{openItem.qtySold}</span> · {money(openItem.extPrice)}
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs font-semibold text-[#64748B] uppercase">
                  <th className="text-left py-2 px-3">{t("Customer")}</th>
                  <th className="text-left py-2 px-3">{t("Receipt / Job #")}</th>
                  <th className="text-left py-2 px-3">{t("Date")}</th>
                  <th className="text-left py-2 px-3">{t("Type")}</th>
                  <th className="text-right py-2 px-3">{t("Qty")}</th>
                  <th className="text-right py-2 px-3">{t("Total")}</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((m, i) => (
                  <tr key={i} className="border-b border-[#F1F5F9] last:border-0">
                    <td className="py-2 px-3 text-[#0F172A]">{m.customer_name ?? t("Walk-in")}</td>
                    <td className="py-2 px-3">
                      <button
                        className="text-[#0891B2] hover:underline"
                        onClick={() => (m.ref_type === "pos" ? setOpenOrderId(m.ref_id) : m.ref_id && navigate(`/jobs/${m.ref_id}`))}
                      >
                        {refLabel(m)}
                      </button>
                    </td>
                    <td className="py-2 px-3 text-[#64748B]">{m.movement_date}</td>
                    <td className="py-2 px-3 text-[#64748B]">{t(m.movement_type)}</td>
                    <td className="py-2 px-3 text-right text-[#0F172A]">{m.qty}</td>
                    <td className="py-2 px-3 text-right text-[#0F172A]">{m.total_price != null ? money(Number(m.total_price)) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
      <ReceiptDialog orderId={openOrderId} onClose={() => setOpenOrderId(null)} />
    </>
  );
}
