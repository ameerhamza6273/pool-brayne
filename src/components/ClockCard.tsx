import { useCallback, useEffect, useState } from "react";
import { Clock, CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { timesheetsApi, type TimeEntry } from "@/lib/api/timesheets";
import { useLanguage } from "@/lib/language-context";
import TimeRequestDialog from "@/components/TimeRequestDialog";

// Client SMS 2026-09-25: "enable clock-in / clock-out, make notes ... make requests". The old Clock In was a
// timer in the browser tab (gone on refresh, never saved until Clock Out). Now the punch is saved the moment
// you press it, survives refresh / switching phones, and shows on the Timesheets page right away.
// Used on Timesheets (office) and on the technician Field view (techs can only open /field).

const two = (n: number) => String(n).padStart(2, "0");
const fmtElapsed = (sec: number) => `${two(Math.floor(sec / 3600))}:${two(Math.floor((sec % 3600) / 60))}:${two(sec % 60)}`;

export default function ClockCard({ name, onChange, compact }: { name: string; onChange?: () => void; compact?: boolean }) {
  const { t, lang } = useLanguage();
  // Dates follow the chosen language (they used to always print in English).
  const locale = lang === "es" ? "es-US" : "en-US";
  const [open, setOpen] = useState<TimeEntry | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const r = await timesheetsApi.clockStatus();
      setOpen(r.open);
    } catch { /* shows as clocked out */ }
    setLoaded(true);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [open]);

  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      if (open) { await timesheetsApi.clockOutEntry(note.trim()); setOpen(null); }
      else setOpen(await timesheetsApi.clockIn(note.trim()));
      setNote("");
      onChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save");
      refresh();
    }
    setBusy(false);
  };

  const elapsed = open ? Math.max(0, Math.floor((now - new Date(open.clock_in).getTime()) / 1000)) : 0;

  return (
    <Card className="border-[#E2E8F0] shadow-sm">
      <CardContent className={compact ? "p-4" : "p-5"}>
        <div className={compact ? "flex flex-col md:flex-row md:items-center md:justify-between gap-3" : "flex flex-col sm:flex-row sm:items-center justify-between gap-4"}>
          <div className="flex items-center gap-4 min-w-0">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${open ? "bg-[#16A34A]/10" : "bg-[#F1F5F9]"}`}>
              <Clock className={`w-6 h-6 ${open ? "text-[#16A34A]" : "text-[#64748B]"}`} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#0F172A] truncate">{name}</p>
              {open ? (
                <>
                  <p className="text-xs text-[#64748B]">{t("Clocked in at")} {new Date(open.clock_in).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })}</p>
                  <p className="text-lg font-bold text-[#0891B2]">{fmtElapsed(elapsed)}</p>
                </>
              ) : (
                <p className="text-xs text-[#64748B]">{loaded ? t("Not clocked in") : t("Loading...")}</p>
              )}
            </div>
          </div>
          <div className={compact ? "grid grid-cols-2 gap-2 md:flex md:items-center md:shrink-0" : "flex flex-col sm:flex-row gap-2 sm:items-center"}>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={open ? t("Note for this shift (optional)") : t("Note (optional)")}
              className={compact ? "h-10 col-span-2 md:w-44" : "h-10 sm:w-56"}
            />
            <Button
              onClick={toggle}
              disabled={busy || !loaded}
              className={`h-10 px-6 font-semibold ${open ? "bg-[#DC2626] hover:bg-[#B91C1C] text-white" : "bg-[#16A34A] hover:bg-[#15803D] text-white"}`}
            >
              {busy ? t("Saving...") : open ? t("Clock Out") : t("Clock In")}
            </Button>
            <Button variant="outline" className="h-10 gap-1.5 border-[#E2E8F0]" onClick={() => setRequestOpen(true)}>
              <CalendarPlus className="w-4 h-4 text-[#0891B2]" /> {t("Make a Request")}
            </Button>
          </div>
        </div>
        {error && <p className="text-sm text-[#DC2626] mt-2">{t(error)}</p>}
      </CardContent>
      <TimeRequestDialog open={requestOpen} onClose={() => setRequestOpen(false)} onSaved={onChange} />
    </Card>
  );
}
