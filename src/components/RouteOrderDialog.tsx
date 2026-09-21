import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/lib/language-context";

// Client SMS 2026-09-21: "I would like to see standard time on all jobs ... to ensure these weekly routes
// maintain the same order they were created. If customer X is the first stop of the day on Monday for tech X,
// I want customer X to ALWAYS be the first stop." One tech's stops for one day: put them in order, pick a
// start time and minutes per stop, and every stop gets its time -- and so does its recurring series, so the
// same order repeats every week.

export interface RouteRow {
  key: string;
  jobId: string | null;
  recurringId: string | null;
  label: string;
  sub: string;
  time: string | null;
  // true when this stop already repeats (real job in a series, or a projected occurrence)
  repeats: boolean;
}

export interface RouteOrderItem { jobId: string | null; recurringId: string | null; time: string; repeatWeekly?: boolean }
export interface RouteOrderSummary { jobsTimed: number; seriesTimed: number; madeRecurring: number }

const pad = (n: number) => String(n).padStart(2, "0");
const toMin = (t: string) => { const [h, m] = t.split(":"); return Number(h) * 60 + Number(m || 0); };
const fromMin = (m: number) => { const c = Math.min(Math.max(m, 0), 23 * 60 + 59); return `${pad(Math.floor(c / 60))}:${pad(c % 60)}`; };
const fmt = (t: string) => { const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}:${pad(m)} ${h >= 12 ? "PM" : "AM"}`; };

export default function RouteOrderDialog({
  open, onClose, title, rows, onApply,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  rows: RouteRow[];
  onApply: (items: RouteOrderItem[]) => Promise<RouteOrderSummary>;
}) {
  const { t } = useLanguage();
  const [order, setOrder] = useState<RouteRow[]>([]);
  const [startTime, setStartTime] = useState("08:00");
  const [minutes, setMinutes] = useState("30");
  const [weekly, setWeekly] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<RouteOrderSummary | null>(null);
  const [error, setError] = useState("");

  // Start from the order the stops already run in (by time, then name), earliest existing time as the start.
  // Keyed on the set of stops (not the array identity) so a parent re-render doesn't wipe the user's ordering.
  const rowsKey = rows.map((r) => r.key).join(",");
  useEffect(() => {
    if (!open) return;
    const sorted = [...rows].sort((a, b) => {
      if (a.time && b.time) return a.time.localeCompare(b.time);
      if (a.time) return -1;
      if (b.time) return 1;
      return a.label.localeCompare(b.label);
    });
    setOrder(sorted);
    setStartTime(sorted.find((r) => r.time)?.time?.slice(0, 5) ?? "08:00");
    setMinutes("30");
    setWeekly(new Set());
    setDone(null);
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rowsKey]);

  const step = Math.max(5, parseInt(minutes, 10) || 30);
  const timeFor = (i: number) => fromMin(toMin(startTime) + i * step);

  const move = (i: number, dir: -1 | 1) => setOrder((prev) => {
    const j = i + dir;
    if (j < 0 || j >= prev.length) return prev;
    const next = [...prev];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  const toggleWeekly = (key: string) => setWeekly((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const apply = async () => {
    setSaving(true);
    setError("");
    try {
      setDone(await onApply(order.map((r, i) => ({ jobId: r.jobId, recurringId: r.recurringId, time: timeFor(i), repeatWeekly: weekly.has(r.key) }))));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the route order");
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[88vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{t("Route order")} — {title}</DialogTitle></DialogHeader>
        <p className="text-xs text-[#64748B]">
          {t("Put the stops in the order you want, then set the start time. Each stop gets its standard time, and repeating jobs keep that time every week, so the route stays in the same order.")}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>{t("First stop at")}</Label><Input type="time" className="mt-1" value={startTime} onChange={(e) => setStartTime(e.target.value || "08:00")} /></div>
          <div><Label>{t("Minutes per stop")}</Label><Input type="number" min={5} step={5} className="mt-1" value={minutes} onChange={(e) => setMinutes(e.target.value)} /></div>
        </div>

        <div className="border border-[#E2E8F0] rounded-lg divide-y divide-[#F1F5F9] max-h-[42vh] overflow-y-auto">
          {order.map((r, i) => (
            <div key={r.key} className="flex items-center gap-2 px-3 py-2">
              <span className="w-6 h-6 rounded-full bg-[#0891B2]/10 text-[#0891B2] text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#0F172A] truncate">{r.label}</p>
                <p className="text-[11px] text-[#64748B] truncate">{r.sub}{r.repeats ? ` · ${t("repeats")}` : ""}</p>
              </div>
              {!r.repeats && r.jobId && (
                <label className="flex items-center gap-1 text-[11px] text-[#64748B] cursor-pointer shrink-0" title={t("Make this job repeat every week at this time")}>
                  <input type="checkbox" checked={weekly.has(r.key)} onChange={() => toggleWeekly(r.key)} /> {t("Repeat weekly")}
                </label>
              )}
              <span className="text-xs font-semibold text-[#0F172A] w-16 text-right shrink-0">{fmt(timeFor(i))}</span>
              <div className="flex flex-col shrink-0">
                <button className="text-[#64748B] hover:text-[#0891B2] disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} title={t("Move up")}><ArrowUp className="w-3.5 h-3.5" /></button>
                <button className="text-[#64748B] hover:text-[#0891B2] disabled:opacity-30" disabled={i === order.length - 1} onClick={() => move(i, 1)} title={t("Move down")}><ArrowDown className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
          {order.length === 0 && <p className="text-sm text-[#64748B] text-center py-6">{t("No stops on this day.")}</p>}
        </div>

        {error && <p className="text-sm text-[#DC2626]">{error}</p>}
        {done && (
          <p className="text-sm text-[#16A34A]">
            {t("Saved")}: {done.jobsTimed} {t("jobs timed")}, {done.seriesTimed} {t("repeating series updated")}{done.madeRecurring > 0 ? `, ${done.madeRecurring} ${t("made weekly")}` : ""}.
          </p>
        )}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>{done ? t("Close") : t("Cancel")}</Button>
          {!done && <Button className="flex-1 bg-[#0891B2] hover:bg-[#0E7490] text-white" disabled={saving || order.length === 0} onClick={apply}>{saving ? t("Saving...") : t("Apply times")}</Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
