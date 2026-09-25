import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { timesheetsApi } from "@/lib/api/timesheets";
import { useLanguage } from "@/lib/language-context";

// Client SMS 2026-09-25: employees make requests (time off, a missed punch / time correction, ...) that the
// office approves or denies on the Timesheets page.
export const REQUEST_TYPES = ["Time Off", "Sick Day", "Time Correction", "Other"];

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function TimeRequestDialog({
  open, onClose, onSaved, employees,
}: {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  // Office only: make the request on someone's behalf. Omitted = the signed-in person.
  employees?: { id: string; name: string }[];
}) {
  const { t } = useLanguage();
  const [employeeId, setEmployeeId] = useState("");
  const [type, setType] = useState(REQUEST_TYPES[0]);
  const [startDate, setStartDate] = useState(todayKey());
  const [endDate, setEndDate] = useState("");
  const [hours, setHours] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setEmployeeId(""); setType(REQUEST_TYPES[0]); setStartDate(todayKey()); setEndDate(""); setHours(""); setNotes(""); setError(null);
  }, [open]);

  const save = async () => {
    if (!startDate) { setError(t("Pick a date")); return; }
    if (endDate && endDate < startDate) { setError(t("The end date is before the start date")); return; }
    setSaving(true);
    setError(null);
    try {
      await timesheetsApi.addRequest({
        employeeId: employeeId || undefined, requestType: type, startDate, endDate: endDate || null,
        hours: hours ? Number(hours) : null, notes: notes.trim() || null,
      });
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the request");
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{t("Make a Request")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {employees && employees.length > 0 && (
            <div>
              <Label>{t("For")}</Label>
              <Select value={employeeId || "__me__"} onValueChange={(v) => setEmployeeId(v === "__me__" ? "" : v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__me__">{t("Myself")}</SelectItem>
                  {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>{t("Type")}</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{REQUEST_TYPES.map((r) => <SelectItem key={r} value={r}>{t(r)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>{t("From")}</Label><Input type="date" className="mt-1" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
            <div><Label>{t("To (optional)")}</Label><Input type="date" className="mt-1" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
          </div>
          <div><Label>{t("Hours (optional)")}</Label><Input type="number" min={0} step={0.25} className="mt-1" value={hours} onChange={(e) => setHours(e.target.value)} /></div>
          <div>
            <Label>{t("Notes")}</Label>
            <Textarea
              className="mt-1 min-h-[80px]"
              placeholder={type === "Time Correction" ? t("e.g. Forgot to clock out Tuesday — left at 4:30 PM") : t("Anything the office should know")}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-[#DC2626]">{t(error)}</p>}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>{t("Cancel")}</Button>
            <Button className="bg-[#0891B2] hover:bg-[#0E7490] text-white" disabled={saving} onClick={save}>{saving ? t("Saving...") : t("Send Request")}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
