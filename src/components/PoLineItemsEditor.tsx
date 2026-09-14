import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/SearchableSelect";
import { useLanguage } from "@/lib/language-context";
import type { ItemWithStock, PoLineItemInput } from "@/lib/api/inventory";

const emptyLine = (): PoLineItemInput => ({ description: "", sku: "", quantity: 1, unitCost: 0 });

export function newPoLineItem() {
  return emptyLine();
}

// Client feedback 2026-09-11: "I cannot add any products" to a PO -- a product picker + editable
// line items, mirroring LineItemsEditor's pattern but purchasing-side (one unit cost, no
// separate customer price).
export default function PoLineItemsEditor({
  items,
  onChange,
  inventoryItems,
}: {
  items: PoLineItemInput[];
  onChange: (items: PoLineItemInput[]) => void;
  inventoryItems: ItemWithStock[];
}) {
  const { t } = useLanguage();
  const update = (index: number, patch: Partial<PoLineItemInput>) => {
    onChange(items.map((li, i) => (i === index ? { ...li, ...patch } : li)));
  };

  const applyInventoryPick = (index: number, itemId: string) => {
    const picked = inventoryItems.find((i) => i.id === itemId);
    if (!picked) return;
    update(index, { description: picked.name, sku: picked.sku, unitCost: picked.unit_cost });
  };

  const addLine = () => onChange([...items, emptyLine()]);
  const removeLine = (index: number) => onChange(items.filter((_, i) => i !== index));

  const total = items.reduce((sum, li) => sum + li.quantity * li.unitCost, 0);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {items.map((li, idx) => (
          <div key={idx} className="border border-[#E2E8F0] rounded-lg p-3 space-y-2 bg-[#F8FAFC]">
            <div className="flex items-center gap-2">
              {inventoryItems.length > 0 && (
                <div className="flex-1">
                  <SearchableSelect
                    className="h-8 text-xs"
                    value=""
                    onChange={(v) => applyInventoryPick(idx, v)}
                    placeholder={t("Pick from inventory (optional)")}
                    searchPlaceholder={t("Search item #, SKU, name, or description...")}
                    emptyText={t("No matching items.")}
                    options={inventoryItems.map((inv) => ({
                      value: inv.id,
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
            <Input placeholder={t("Description")} value={li.description} onChange={(e) => update(idx, { description: e.target.value })} className="h-8 text-sm" />
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-[#64748B]">{t("SKU")}</label>
                <Input value={li.sku ?? ""} onChange={(e) => update(idx, { sku: e.target.value })} className="h-8 text-sm" />
              </div>
              <div>
                <label className="text-[10px] text-[#64748B]">{t("Qty")}</label>
                <Input type="number" value={li.quantity} onChange={(e) => update(idx, { quantity: parseFloat(e.target.value) || 0 })} className="h-8 text-sm" />
              </div>
              <div>
                <label className="text-[10px] text-[#64748B]">{t("Unit Cost")}</label>
                <Input type="number" value={li.unitCost} onChange={(e) => update(idx, { unitCost: parseFloat(e.target.value) || 0 })} className="h-8 text-sm" />
              </div>
            </div>
            <p className="text-right text-xs font-medium text-[#0F172A]">{t("Amount")}: ${(li.quantity * li.unitCost).toFixed(2)}</p>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 border-[#E2E8F0]" onClick={addLine}>
        <Plus className="w-3.5 h-3.5" /> {t("Add Product")}
      </Button>
      {items.length > 0 && (
        <p className="text-right text-sm font-semibold text-[#0F172A]">{t("PO Total")}: ${total.toFixed(2)}</p>
      )}
    </div>
  );
}
