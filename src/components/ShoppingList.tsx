import { useState } from "react";
import { ShoppingCart, CheckCircle2, Circle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ShoppingItem = {
  id: string;
  name: string;
  checked: boolean;
  category: "chemicals" | "equipment" | "tools" | "misc";
};

const initialItems: ShoppingItem[] = [
  { id: "1", name: "Chlorine tablets (3-inch)", checked: true, category: "chemicals" },
  { id: "2", name: "Muriatic acid (2 gal)", checked: false, category: "chemicals" },
  { id: "3", name: "Sodium bicarbonate (25 lb)", checked: false, category: "chemicals" },
  { id: "4", name: "Filter cartridges (2)", checked: true, category: "equipment" },
  { id: "5", name: "Salt cell cleaner", checked: false, category: "chemicals" },
  { id: "6", name: "Pool brush replacement", checked: false, category: "tools" },
  { id: "7", name: "Skimmer nets (2)", checked: false, category: "tools" },
  { id: "8", name: "Test kit refills", checked: true, category: "misc" },
  { id: "9", name: "DE powder (25 lb)", checked: false, category: "chemicals" },
  { id: "10", name: "Backwash hose (50 ft)", checked: false, category: "equipment" },
];

const categoryColor = {
  chemicals: "bg-[#0891B2]/10 text-[#0891B2]",
  equipment: "bg-[#F59E0B]/10 text-[#F59E0B]",
  tools: "bg-[#16A34A]/10 text-[#16A34A]",
  misc: "bg-[#94A3B8]/10 text-[#64748B]",
};

export default function ShoppingList() {
  const [items, setItems] = useState<ShoppingItem[]>(initialItems);
  const [newItem, setNewItem] = useState("");

  const toggle = (id: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, checked: !item.checked } : item));
  };

  const addItem = () => {
    if (!newItem.trim()) return;
    setItems(prev => [...prev, { id: Date.now().toString(), name: newItem, checked: false, category: "misc" }]);
    setNewItem("");
  };

  const completed = items.filter(i => i.checked).length;

  return (
    <Card className="border-[#E2E8F0] shadow-sm">
      <CardHeader className="pb-3 flex items-center justify-between">
        <CardTitle className="text-sm font-semibold text-[#0F172A] flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-[#0891B2]" />
          Daily Shopping List
        </CardTitle>
        <span className="text-xs text-[#64748B]">{completed}/{items.length} items</span>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="Add item..."
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addItem()}
            className="h-9 text-sm"
          />
          <Button size="sm" onClick={addItem} className="bg-[#0891B2] hover:bg-[#0E7490] text-white h-9 px-4">
            Add
          </Button>
        </div>

        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => toggle(item.id)}
              className={`w-full flex items-center gap-2.5 p-2.5 rounded-lg border text-left transition-colors ${
                item.checked
                  ? "border-[#16A34A] bg-[#16A34A]/5"
                  : "border-[#E2E8F0] bg-white hover:bg-[#F8FAFC]"
              }`}
            >
              {item.checked ? (
                <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-[#CBD5E1] shrink-0" />
              )}
              <span className={`text-sm flex-1 ${item.checked ? "text-[#64748B] line-through" : "text-[#0F172A]"}`}>
                {item.name}
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${categoryColor[item.category]}`}>
                {item.category}
              </span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
