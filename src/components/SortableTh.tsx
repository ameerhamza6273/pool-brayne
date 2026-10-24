import { useState } from "react";

// Client meeting 2026-09: "a way to sort these reports by clicking higher to lower" (built for Reports first); client video
export type TableSort<T> = { sorted: T[]; sortKey: string | null; sortDir: "asc" | "desc"; toggleSort: (key: string) => void };

const asNumber = (v: string | number) => (typeof v === "number" ? v : v.trim() !== "" && /^-?[\d,]*\.?\d+$/.test(v.trim()) ? Number(v.replace(/,/g, "")) : NaN);

export function useSort<T>(rows: T[], getValue: (row: T, key: string) => string | number | null | undefined): TableSort<T> {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const sorted = sortKey
    ? [...rows].sort((a, b) => {
        const av = getValue(a, sortKey);
        const bv = getValue(b, sortKey);
        if (av == null || av === "") return 1;
        if (bv == null || bv === "") return -1;
        const an = asNumber(av), bn = asNumber(bv);
        const cmp = !Number.isNaN(an) && !Number.isNaN(bn) ? an - bn : String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" });
        return sortDir === "asc" ? cmp : -cmp;
      })
    : rows;
  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };
  return { sorted, sortKey, sortDir, toggleSort };
}

export function SortTh({ label, sortKey, active, dir, onClick, align = "left" }: {
  label: string; sortKey: string; active: string | null; dir: "asc" | "desc";
  onClick: (key: string) => void; align?: "left" | "right" | "center";
}) {
  const isActive = active === sortKey;
  return (
    <th
      className={`py-3 px-4 text-xs font-semibold text-[#64748B] uppercase cursor-pointer select-none hover:text-[#0891B2] ${align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"}`}
      onClick={() => onClick(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive && <span className="text-[10px]">{dir === "asc" ? "▲" : "▼"}</span>}
      </span>
    </th>
  );
}

// Shorthand for a table's header row: `const th = sortHeader(sort, t); th("number", "Invoice #")`.
export function sortHeader<T>(sort: TableSort<T>, t: (s: string) => string) {
  return (sortKey: string, label: string, align: "left" | "right" | "center" = "left") => (
    <SortTh label={t(label)} sortKey={sortKey} active={sort.sortKey} dir={sort.sortDir} onClick={sort.toggleSort} align={align} />
  );
}
