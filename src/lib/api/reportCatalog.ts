import { api } from "@/lib/apiClient";

// Generic table reports from the ServiceWorks-style report catalog (backend routes/reportCatalog.ts).
export type CatalogColType = "text" | "money" | "number" | "hours" | "percent" | "date";
export type CatalogLinkKind = "job" | "invoice" | "estimate" | "customer" | "pos";
export type CatalogColumn = {
  key: string; label: string; type?: CatalogColType; total?: boolean;
  link?: CatalogLinkKind; linkKey?: string; translate?: boolean;
};
export type CatalogRow = Record<string, string | number | boolean | null>;
export type CatalogReportData = {
  columns: CatalogColumn[];
  rows: CatalogRow[];
  summary?: { label: string; value: number | string; type?: CatalogColType }[];
  note?: string;
};

export const reportCatalogApi = {
  get: (id: string, start: string, end: string) =>
    api.get<CatalogReportData>(`/api/reports/catalog/${id}?start=${start}&end=${end}&tz=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`),
};
