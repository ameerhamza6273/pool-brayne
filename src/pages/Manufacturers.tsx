import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Factory } from "lucide-react";
import { inventoryApi } from "@/lib/api/inventory";

// Sidebar restructure (client PDF 2026-09-06, "Data > Manufacture list") — distinct
// manufacturers already recorded on inventory items, with a count each; clicking one jumps to
// the Catalog filtered to that manufacturer's items via a search-box prefill.
export default function Manufacturers() {
  const [manufacturers, setManufacturers] = useState<{ manufacturer: string; item_count: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    inventoryApi.manufacturers().then((data) => {
      setManufacturers(data ?? []);
      setIsLoading(false);
    });
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-[#0F172A]">Manufacturers</h1>
        <p className="text-sm text-[#64748B] mt-0.5">Distinct manufacturers recorded across your inventory catalog.</p>
      </div>

      {isLoading && <div className="text-center py-8 text-[#64748B]">Loading...</div>}

      {!isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {manufacturers.map((m) => (
            <button
              key={m.manufacturer}
              onClick={() => navigate(`/inventory?search=${encodeURIComponent(m.manufacturer)}`)}
              className="bg-white rounded-xl p-4 border border-[#E2E8F0] shadow-sm flex items-center gap-3 text-left hover:border-[#0891B2] transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-[#0891B2]/10 flex items-center justify-center shrink-0">
                <Factory className="w-5 h-5 text-[#0891B2]" />
              </div>
              <div>
                <p className="font-semibold text-[#0F172A]">{m.manufacturer}</p>
                <p className="text-xs text-[#64748B]">{m.item_count} item{m.item_count === 1 ? "" : "s"}</p>
              </div>
            </button>
          ))}
          {manufacturers.length === 0 && (
            <div className="col-span-full text-center py-12 text-[#64748B]">No manufacturers recorded yet.</div>
          )}
        </div>
      )}
    </div>
  );
}
