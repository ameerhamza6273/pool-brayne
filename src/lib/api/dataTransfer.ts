import { api } from "@/lib/apiClient";

export type ImportResult = { created: number; updated: number; skipped: number; errors: string[] };

export const dataTransferApi = {
  importRows: (dataset: string, rows: Record<string, string>[]) =>
    api.post<ImportResult>(`/api/data/import/${dataset}`, { rows }),
};
