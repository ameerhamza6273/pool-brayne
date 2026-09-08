import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/SearchableSelect";
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
  const removeLine = (index: number) => onChange(items.filter((_, i) => i !== index));

  const subtotal = items.reduce((sum, li) => sum + li.quantity * li.rate, 0);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {items.map((li, idx) => (
          <div key={idx} className="border border-[#E2E8F0] rounded-lg p-3 space-y-2 bg-[#F8FAFC]">
            <div className="flex items-center gap-2">
              <Select value={li.itemType ?? "material"} onValueChange={(v) => update(idx, { itemType: v as "material" | "labor" })}>
                <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="material">Material</SelectItem>
                  <SelectItem value="labor">Labor</SelectItem>
                </SelectContent>
              </Select>
              {inventoryItems.length > 0 && (
                <div className="flex-1">
                  <SearchableSelect
                    className="h-8 text-xs"
                    value=""
                    onChange={(v) => applyInventoryPick(idx, v)}
                    placeholder="Pick from inventory (optional)"
                    searchPlaceholder="Search item #, SKU, name, or description..."
                    emptyText="No matching items."
                    options={inventoryItems.map((inv) => ({
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
            <Input placeholder="Description" value={li.description} onChange={(e) => update(idx, { description: e.target.value })} className="h-8 text-sm" />
            <Input
              placeholder="Detail line (optional) — model #, part #, specs shown under the description"
              value={li.notes ?? ""}
              onChange={(e) => update(idx, { notes: e.target.value })}
              className="h-8 text-xs text-[#64748B]"
            />
            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="text-[10px] text-[#64748B]">SKU</label>
                <Input value={li.sku ?? ""} onChange={(e) => update(idx, { sku: e.target.value })} className="h-8 text-sm" />
              </div>
              <div>
                <label className="text-[10px] text-[#64748B]">Qty</label>
                <Input type="number" value={li.quantity} onChange={(e) => update(idx, { quantity: parseFloat(e.target.value) || 0 })} className="h-8 text-sm" />
              </div>
              <div>
                <label className="text-[10px] text-[#64748B]">Cost (internal)</label>
                <Input type="number" value={li.cost ?? 0} onChange={(e) => update(idx, { cost: parseFloat(e.target.value) || 0 })} className="h-8 text-sm" />
              </div>
              <div>
                <label className="text-[10px] text-[#64748B]">Price</label>
                <Input type="number" value={li.rate} onChange={(e) => update(idx, { rate: parseFloat(e.target.value) || 0 })} className="h-8 text-sm" />
              </div>
            </div>
            <p className="text-right text-xs font-medium text-[#0F172A]">Amount: ${(li.quantity * li.rate).toFixed(2)}</p>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 border-[#E2E8F0]" onClick={addLine}>
        <Plus className="w-3.5 h-3.5" /> Add Line Item
      </Button>
      {items.length > 0 && (
        <p className="text-right text-sm font-semibold text-[#0F172A]">Line Items Subtotal: ${subtotal.toFixed(2)}</p>
      )}
    </div>
  );
}
