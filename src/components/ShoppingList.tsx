import { useState, useEffect, useCallback } from "react";
import { ShoppingCart, CheckCircle2, Circle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { inventoryApi } from "@/lib/api/inventory";

type ShoppingItem = {
  id: string;
  name: string;
  current: number;
  threshold: number;
  checked: boolean;
};

export default function ShoppingList() {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadLowStock = useCallback(async () => {
    setIsLoading(true);
    const data = await inventoryApi.lowStock();
    setItems(data.map((i) => ({ ...i, checked: false })));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadLowStock();
  }, [loadLowStock]);

  const toggle = (id: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item)));
  };

  const completed = items.filter((i) => i.checked).length;

  return (
    <Card className="border-[#E2E8F0] shadow-sm">
      <CardHeader className="pb-3 flex items-center justify-between">
        <CardTitle className="text-sm font-semibold text-[#0F172A] flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-[#0891B2]" />
          Restock List
        </CardTitle>
        <span className="text-xs text-[#64748B]">{completed}/{items.length} ordered</span>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {isLoading && <p className="text-xs text-[#64748B] text-center py-4">Loading...</p>}
        {!isLoading && items.length === 0 && (
          <p className="text-xs text-[#64748B] text-center py-4">Nothing below reorder threshold</p>
        )}
        {!isLoading && items.length > 0 && (
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
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F59E0B]/10 text-[#F59E0B]">
                {item.current}/{item.threshold}
              </span>
            </button>
          ))}
        </div>
        )}
      </CardContent>
    </Card>
  );
}
