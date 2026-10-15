import { useEffect, useState } from "react";
import { settingsApi } from "@/lib/api/settings";

// Client text 2026-10-15: "Yes -- currently 7.75%, set up the default for now" -- confirmed real
// tenant sales tax rate (replaces a hardcoded 8.25% literal everywhere). Falls back to the
// tenant's default while the fetch resolves so nothing flashes a wrong number before it loads.
export const DEFAULT_TAX_RATE = 0.0775;

export function useTaxRate(): number {
  const [taxRate, setTaxRate] = useState(DEFAULT_TAX_RATE);
  useEffect(() => {
    settingsApi.getTaxRate().then((r) => setTaxRate(r.taxRate)).catch(() => {});
  }, []);
  return taxRate;
}
