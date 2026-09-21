import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Factory, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { inventoryApi } from "@/lib/api/inventory";
import { useLanguage } from "@/lib/language-context";
import ViewToggle, { useViewMode } from "@/components/ViewToggle";

// Sidebar restructure (client PDF 2026-09-06, "Data > Manufacture list") — distinct
// manufacturers already recorded on inventory items, with a count each; clicking one jumps to
// the Catalog filtered to that manufacturer's items via a search-box prefill.
export default function Manufacturers() {
  const [manufacturers, setManufacturers] = useState<{ manufacturer: string; item_count: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useViewMode("manufacturers");
  const navigate = useNavigate();
  const { t } = useLanguage();

  useEffect(() => {
    inventoryApi.manufacturers().then((data) => {
      setManufacturers(data ?? []);
      setIsLoading(false);
    });
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-[#0F172A]">{t("Manufacturers")}</h1>
        <p className="text-sm text-[#64748B] mt-0.5">{t("Distinct manufacturers recorded across your inventory catalog.")}</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
          <Input placeholder={t("Search manufacturer...")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-10 bg-white border-[#E2E8F0]" />
        </div>
        <ViewToggle mode={viewMode} onChange={setViewMode} />
      </div>

      {isLoading && <div className="text-center py-8 text-[#64748B]">{t("Loading...")}</div>}

      {!isLoading && viewMode === "table" && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Manufacturer")}</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Items")}</th>
                </tr>
              </thead>
              <tbody>
                {manufacturers.filter((m) => m.manufacturer.toLowerCase().includes(search.toLowerCase())).map((m) => (
                  <tr
                    key={m.manufacturer}
                    onClick={() => navigate(`/inventory?search=${encodeURIComponent(m.manufacturer)}`)}
                    className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] cursor-pointer"
                  >
                    <td className="py-3 px-4 font-medium text-[#0F172A]">{m.manufacturer}</td>
                    <td className="py-3 px-4 text-right text-[#64748B]">{m.item_count}</td>
                  </tr>
                ))}
                {manufacturers.length === 0 && (
                  <tr><td colSpan={2} className="py-8 text-center text-[#64748B]">{t("No manufacturers recorded yet.")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!isLoading && viewMode === "cards" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {manufacturers.filter((m) => m.manufacturer.toLowerCase().includes(search.toLowerCase())).map((m) => (
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
                <p className="text-xs text-[#64748B]">{m.item_count} {m.item_count === 1 ? t("item") : t("items")}</p>
              </div>
            </button>
          ))}
          {manufacturers.length === 0 && (
            <div className="col-span-full text-center py-12 text-[#64748B]">{t("No manufacturers recorded yet.")}</div>
          )}
        </div>
      )}
    </div>
  );
}
