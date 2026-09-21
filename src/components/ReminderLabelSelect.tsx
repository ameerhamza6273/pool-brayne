import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConfigLists } from "@/hooks/use-config-lists";
import { useLanguage } from "@/lib/language-context";

// Client SMS 2026-09-21: the reminder "Label" was a free-text box; they want a dropdown of labels
// (Filter cleaning, Salt cell cleaning, Sand change, Anode replacement, ...) that they can add to.
// The list is the tenant's `reminder_types` config list (also editable in Settings > Job Settings);
// "Add new label..." at the bottom adds to it right here without leaving the dialog.
const ADD_NEW = "__add_new__";

export default function ReminderLabelSelect({ value, onChange }: { value: string; onChange: (label: string) => void }) {
  const { t } = useLanguage();
  const { lists, addItem } = useConfigLists();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const labels = lists.reminder_types.map((i) => i.label);
  // A reminder created before this list existed may carry free text that isn't in it -- keep it selectable.
  const options = value && !labels.includes(value) ? [value, ...labels] : labels;

  const submit = async () => {
    const label = draft.trim();
    if (!label) return;
    const existing = labels.find((l) => l.toLowerCase() === label.toLowerCase());
    setSaving(true);
    try {
      if (!existing) await addItem("reminder_types", label);
      onChange(existing ?? label);
      setAdding(false);
      setDraft("");
    } finally {
      setSaving(false);
    }
  };

  if (adding) {
    // Swaps in for the dropdown (same row, same height) so the dialog never changes size.
    return (
      <div className="mt-1 flex gap-2">
        <Input
          autoFocus
          placeholder={t("New label, e.g. Heater Inspection")}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); submit(); }
            if (e.key === "Escape") { e.stopPropagation(); setAdding(false); setDraft(""); }
          }}
        />
        <Button type="button" className="bg-[#0891B2] hover:bg-[#0E7490] text-white" disabled={saving || !draft.trim()} onClick={submit}>{t("Add")}</Button>
        <Button type="button" variant="outline" className="border-[#E2E8F0]" onClick={() => { setAdding(false); setDraft(""); }}>{t("Cancel")}</Button>
      </div>
    );
  }

  return (
    <div className="mt-1">
      <Select
        value={value || undefined}
        onValueChange={(v) => {
          if (v === ADD_NEW) setAdding(true);
          else onChange(v);
        }}
      >
        <SelectTrigger><SelectValue placeholder={t("Select a reminder type")} /></SelectTrigger>
        <SelectContent className="max-h-72">
          {options.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
          <SelectItem value={ADD_NEW}>+ {t("Add new label...")}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
