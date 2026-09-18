import { useCallback, useEffect, useState } from "react";
import { configListsApi, type ConfigLists, type ConfigListKey, type ConfigListItem } from "@/lib/api/configLists";
import {
  jobTypes as staticJobTypes, jobStatuses as staticJobStatuses, estimateStatuses as staticEstimateStatuses,
  callTypes as staticCallTypes, callSources as staticCallSources,
  rescheduleTypes as staticRescheduleTypes, cancellationReasons as staticCancellationReasons,
} from "@/lib/data";

const slugify = (label: string) => label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "item";
const asItems = (labels: string[]): ConfigListItem[] => labels.map((label) => ({ id: slugify(label), label, color: null }));

// Client PDF 2026-09-18: these lists moved from static src/lib/data.ts arrays to a DB-backed,
// per-tenant, Settings-editable table (`tenant_config_lists`, see backend/src/routes/settings.ts).
// Fallback below is only what renders before the first fetch resolves, so nothing flashes empty.
const FALLBACK: ConfigLists = {
  job_types: staticJobTypes,
  job_statuses: staticJobStatuses,
  estimate_statuses: staticEstimateStatuses,
  call_types: asItems(staticCallTypes),
  call_sources: asItems(staticCallSources),
  reschedule_types: asItems(staticRescheduleTypes),
  cancellation_reasons: asItems(staticCancellationReasons),
};

export function useConfigLists() {
  const [lists, setLists] = useState<ConfigLists>(FALLBACK);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await configListsApi.all();
      setLists(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addItem = useCallback(async (key: ConfigListKey, label: string, color?: string) => {
    const item = await configListsApi.add(key, label, color);
    setLists((prev) => ({ ...prev, [key]: [...prev[key], item] }));
  }, []);

  const removeItem = useCallback(async (key: ConfigListKey, itemId: string) => {
    await configListsApi.remove(key, itemId);
    setLists((prev) => ({ ...prev, [key]: prev[key].filter((i) => i.id !== itemId) }));
  }, []);

  return { lists, loading, addItem, removeItem, refresh };
}
