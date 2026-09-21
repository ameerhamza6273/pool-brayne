import { useState } from "react";
import { LayoutGrid, Table2 } from "lucide-react";
import { useLanguage } from "@/lib/language-context";

// Client SMS 2026-09-21: "grid view" (rows/columns) as the default on Directory, Library, Forms,
// Form Builder, Manufacturers and Campaigns, with the older card layout kept as a toggle. The
// choice is remembered per page in localStorage (a per-viewer convenience only).
export type ViewMode = "table" | "cards";

export function useViewMode(storageKey: string): [ViewMode, (m: ViewMode) => void] {
  const [mode, setModeState] = useState<ViewMode>(() => {
    try {
      const saved = localStorage.getItem(`view-mode:${storageKey}`);
      return saved === "cards" || saved === "table" ? saved : "table";
    } catch {
      return "table";
    }
  });
  const setMode = (m: ViewMode) => {
    setModeState(m);
    try { localStorage.setItem(`view-mode:${storageKey}`, m); } catch { /* storage unavailable */ }
  };
  return [mode, setMode];
}

export default function ViewToggle({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  const { t } = useLanguage();
  const base = "p-1.5 rounded";
  return (
    <div className="flex items-center gap-1 border border-[#E2E8F0] rounded-lg p-1 shrink-0 bg-white">
      <button type="button" onClick={() => onChange("table")} title={t("Grid view")} className={`${base} ${mode === "table" ? "bg-[#0891B2]/10 text-[#0891B2]" : "text-[#64748B] hover:bg-[#F8FAFC]"}`}>
        <Table2 className="w-4 h-4" />
      </button>
      <button type="button" onClick={() => onChange("cards")} title={t("Card view")} className={`${base} ${mode === "cards" ? "bg-[#0891B2]/10 text-[#0891B2]" : "text-[#64748B] hover:bg-[#F8FAFC]"}`}>
        <LayoutGrid className="w-4 h-4" />
      </button>
    </div>
  );
}
