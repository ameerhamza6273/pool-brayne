// Small dependency-free CSV helpers for Data > Import / Export.

export function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = Array.isArray(v) ? v.join("; ") : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.join(","), ...rows.map((r) => columns.map((c) => esc(r[c])).join(","))].join("\r\n");
}

export function downloadCsv(filename: string, csv: string) {
  // BOM so Excel opens UTF-8 (accents, etc.) correctly.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Column headers are matched loosely: "Unit Cost", "unit-cost" and "unit_cost" are the same column.
export const normalizeHeader = (h: string) => h.replace(/^﻿/, "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { record.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      record.push(field); field = "";
      if (record.some((c) => c.trim() !== "")) records.push(record);
      record = [];
    } else field += ch;
  }
  record.push(field);
  if (record.some((c) => c.trim() !== "")) records.push(record);

  if (records.length === 0) return { headers: [], rows: [] };
  const headers = records[0].map(normalizeHeader);
  const rows = records.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => { if (h) obj[h] = (r[idx] ?? "").trim(); });
    return obj;
  });
  return { headers, rows };
}
