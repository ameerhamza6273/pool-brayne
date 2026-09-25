import { useState } from "react";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import NumberField from "@/components/NumberField";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/SearchableSelect";
import { useLanguage } from "@/lib/language-context";
import { isLaborCategory } from "@/lib/labor";
import type { LineItemInput } from "@/lib/api/invoicing";
import type { ItemWithStock } from "@/lib/api/inventory";

export type DraftLineItem = LineItemInput;

const emptyLine = (): DraftLineItem => ({ description: "", sku: "", itemType: "material", quantity: 1, cost: 0, rate: 0, notes: "" });

export function newDraftLineItem() {
  return emptyLine();
}

export default function LineItemsEditor({
  items,
  onChange,
  inventoryItems,
}: {
  items: DraftLineItem[];
  onChange: (items: DraftLineItem[]) => void;
  inventoryItems: ItemWithStock[];
}) {
  const { t } = useLanguage();
  // Client SMS 2026-09-25: the same Category / Manufacturer dropdowns as Point of Sale to narrow the
  // inventory picker, per line. Cleared when lines are moved or removed (they're keyed by position).
  const [filters, setFilters] = useState<Record<number, { category: string; manufacturer: string }>>({});
  const filterOf = (idx: number) => filters[idx] ?? { category: "All", manufacturer: "All" };
  const setFilter = (idx: number, patch: Partial<{ category: string; manufacturer: string }>) =>
    setFilters((prev) => ({ ...prev, [idx]: { ...filterOf(idx), ...patch } }));
  // Client SMS 2026-09-25: move line items up / down by drag and drop (grip on the left of each line).
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const moveLine = (from: number, to: number) => {
    if (from === to) return;
    const next = [...items];
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row);
    setFilters({});
    onChange(next);
  };
  const update = (index: number, patch: Partial<DraftLineItem>) => {
    onChange(items.map((li, i) => (i === index ? { ...li, ...patch } : li)));
  };

  const applyInventoryPick = (index: number, itemId: string) => {
    const picked = inventoryItems.find((i) => i.id === itemId);
    if (!picked) return;
    // Client sample estimate PDF (2026-09-06): line items show a subtitle under the description
    // with model/part detail (e.g. "260K BTU Natural Gas, Versaflo, Copper Hx... — JNDJXIQ260NK")
    // -- pre-fill it from the inventory item's long description, still freely editable.
    update(index, { description: picked.name, sku: picked.sku, cost: picked.unit_cost, rate: picked.price ?? picked.unit_cost, notes: picked.long_description ?? "" });
  };

  const addLine = () => onChange([...items, emptyLine()]);
  const removeLine = (index: number) => { setFilters({}); onChange(items.filter((_, i) => i !== index)); };

  const subtotal = items.reduce((sum, li) => sum + li.quantity * li.rate, 0);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {items.map((li, idx) => (
          <div
            key={idx}
            onDragOver={(e) => { if (dragIdx === null) return; e.preventDefault(); setOverIdx(idx); }}
            onDrop={(e) => { if (dragIdx === null) return; e.preventDefault(); moveLine(dragIdx, idx); setDragIdx(null); setOverIdx(null); }}
            className={`border rounded-lg p-3 space-y-2 ${dragIdx === idx ? "opacity-50" : ""} ${overIdx === idx && dragIdx !== null && dragIdx !== idx ? "border-[#0891B2] bg-[#0891B2]/5" : "border-[#E2E8F0] bg-[#F8FAFC]"}`}
          >
            <div className="flex items-center gap-2">
              {items.length > 1 && (
                <span
                  draggable
                  onDragStart={(e) => { setDragIdx(idx); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(idx)); }}
                  onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
                  className="cursor-grab active:cursor-grabbing text-[#94A3B8] hover:text-[#0891B2] shrink-0"
                  title={t("Drag to move this line up or down")}
                >
                  <GripVertical className="w-4 h-4" />
                </span>
              )}
              <Select value={li.itemType ?? "material"} onValueChange={(v) => update(idx, { itemType: v as "material" | "labor" })}>
                <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="material">{t("Material")}</SelectItem>
                  <SelectItem value="labor">{t("Labor")}</SelectItem>
                </SelectContent>
              </Select>
              {inventoryItems.length > 0 && (
                <div className="flex-1">
                  <SearchableSelect
                    className="h-8 text-xs"
                    value=""
                    onChange={(v) => applyInventoryPick(idx, v)}
                    placeholder={t("Pick from inventory (optional)")}
                    searchPlaceholder={t("Search item #, SKU, name, or description...")}
                    emptyText={t("No matching items.")}
                    // Client meeting 2026-09: "making sure the labor is linked to our labor SKUs
                    // and materials are linked to our material SKUs". Client SMS 2026-09-21: the
                    // 67 imported labor SKUs are category "Labor" (not "Services"), so they never
                    // showed under Labor -- isLaborCategory covers both.
                    options={inventoryItems
                      .filter((inv) => (li.itemType === "labor" ? isLaborCategory(inv.category) : !isLaborCategory(inv.category)))
                      .filter((inv) => filterOf(idx).category === "All" || inv.category === filterOf(idx).category)
                      .filter((inv) => filterOf(idx).manufacturer === "All" || inv.manufacturer === filterOf(idx).manufacturer)
                      .map((inv) => ({
                      value: inv.id,
                      // Client SMS 2026-09-04 (staff, "Michael"): "typing our item number,
                      // nothing was populating" -- item_number wasn't in the searchable text at
                      // all before, only SKU/name/description were.
                      label: `${inv.item_number ?? inv.sku} · ${inv.sku} — ${inv.name}`,
                      sublabel: [inv.long_description, inv.manufacturer].filter(Boolean).join(" · ") || undefined,
                    }))}
                  />
                </div>
              )}
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-[#DC2626] shrink-0" onClick={() => removeLine(idx)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            {inventoryItems.length > 0 && (() => {
              const pool = inventoryItems.filter((inv) => (li.itemType === "labor" ? isLaborCategory(inv.category) : !isLaborCategory(inv.category)));
              const cats = Array.from(new Set(pool.map((inv) => inv.category).filter(Boolean))).sort();
              const mans = Array.from(new Set(pool.filter((inv) => filterOf(idx).category === "All" || inv.category === filterOf(idx).category).map((inv) => inv.manufacturer).filter((m): m is string => Boolean(m)))).sort();
              return (
                <div className="grid grid-cols-2 gap-2">
                  <Select value={filterOf(idx).category} onValueChange={(v) => setFilter(idx, { category: v, manufacturer: "All" })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={t("Category")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">{t("All categories")}</SelectItem>
                      {cats.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={filterOf(idx).manufacturer} onValueChange={(v) => setFilter(idx, { manufacturer: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={t("Manufacturer")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">{t("All manufacturers")}</SelectItem>
                      {mans.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              );
            })()}
            <Input placeholder={t("Description")} value={li.description} onChange={(e) => update(idx, { description: e.target.value })} className="h-8 text-sm" />
            {/* Client SMS 2026-09-25: "a notes section under each item ... explain the item or type in a serial
                number" -- the existing per-line detail line, now a multi-line Notes box (same field, still shown
                under the item on the estimate / invoice). */}
            <Textarea
              placeholder={t("Notes (optional) — explain the item, serial #, model #, specs. Shown under the item.")}
              value={li.notes ?? ""}
              onChange={(e) => update(idx, { notes: e.target.value })}
              rows={2}
              className="min-h-[52px] text-xs text-[#475569] bg-white"
            />
            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="text-[10px] text-[#64748B]">{t("SKU")}</label>
                <Input value={li.sku ?? ""} onChange={(e) => update(idx, { sku: e.target.value })} className="h-8 text-sm" />
              </div>
              <div>
                <label className="text-[10px] text-[#64748B]">{t("Qty")}</label>
                <Input type="number" value={li.quantity} onChange={(e) => update(idx, { quantity: parseFloat(e.target.value) || 0 })} className="h-8 text-sm" />
              </div>
              <div>
                <label className="text-[10px] text-[#64748B]">{t("Cost (internal)")}</label>
                <NumberField value={li.cost ?? 0} onValueChange={(n) => update(idx, { cost: n })} className="h-8 text-sm" />
              </div>
              <div>
                <label className="text-[10px] text-[#64748B]">{t("Price")}</label>
                <NumberField value={li.rate} onValueChange={(n) => update(idx, { rate: n })} className="h-8 text-sm" />
              </div>
            </div>
            <p className="text-right text-xs font-medium text-[#0F172A]">{t("Amount")}: ${(li.quantity * li.rate).toFixed(2)}</p>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 border-[#E2E8F0]" onClick={addLine}>
        <Plus className="w-3.5 h-3.5" /> {t("Add Line Item")}
      </Button>
      {items.length > 0 && (
        <p className="text-right text-sm font-semibold text-[#0F172A]">{t("Line Items Subtotal")}: ${subtotal.toFixed(2)}</p>
      )}
    </div>
  );
}
