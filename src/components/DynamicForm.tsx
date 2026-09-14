import { useState } from "react";
import { CheckCircle2, Circle, Upload, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/lib/language-context";
import type { FormTemplate, FormField } from "@/lib/api/formTemplates";

// Client SMS 2026-09-06: "something he can create his own forms... need to be able to edit,
// create, and tag to a job". Renders whatever fields a form_templates row defines -- this is
// what replaced the 3 previously-hardcoded checklist components (now seeded as real, editable
// templates using this same renderer).
export default function DynamicForm({
  template,
  onSave,
  onUploadPhoto,
}: {
  template: FormTemplate;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  onUploadPhoto?: (file: File) => Promise<string>;
}) {
  const { t } = useLanguage();
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [missingFields, setMissingFields] = useState<Set<string>>(new Set());

  const setValue = (id: string, v: unknown) => {
    setValues((p) => ({ ...p, [id]: v }));
    setMissingFields((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  // Client meeting 2026-09: individual fields (not just the whole form) can be marked mandatory.
  const isFieldEmpty = (f: FormField) => {
    const v = values[f.id];
    if (f.type === "checkbox" || f.type === "yesno") return !v;
    if (f.type === "photo") return !((v as string[] | undefined)?.length);
    return v == null || String(v).trim() === "";
  };

  const handlePhotoSelect = async (fieldId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUploadPhoto) return;
    setUploadingField(fieldId);
    try {
      const url = await onUploadPhoto(file);
      const existing = (values[fieldId] as string[] | undefined) ?? [];
      setValue(fieldId, [...existing, url]);
    } finally {
      setUploadingField(null);
      e.target.value = "";
    }
  };

  const handleSave = async () => {
    const missing = new Set(template.fields.filter((f) => f.required && isFieldEmpty(f)).map((f) => f.id));
    if (missing.size > 0) {
      setMissingFields(missing);
      return;
    }
    setSaving(true);
    try {
      await onSave(values);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const checkboxFields = template.fields.filter((f) => f.type === "checkbox");
  const otherFields = template.fields.filter((f) => f.type !== "checkbox");
  const completedCount = checkboxFields.filter((f) => values[f.id]).length;

  return (
    <Card className="border-[#E2E8F0] shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-[#0F172A]">{t(template.name)}</CardTitle>
        {template.description && <p className="text-xs text-[#64748B]">{t(template.description)}</p>}
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {checkboxFields.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {checkboxFields.map((f) => {
              const checked = !!values[f.id];
              const missing = missingFields.has(f.id);
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setValue(f.id, !checked)}
                  className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-left transition-colors ${
                    checked ? "border-[#16A34A] bg-[#16A34A]/5" : missing ? "border-[#DC2626] bg-[#DC2626]/5" : "border-[#E2E8F0] bg-white hover:bg-[#F8FAFC]"
                  }`}
                >
                  {checked ? <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" /> : <Circle className="w-4 h-4 text-[#CBD5E1] shrink-0" />}
                  <span className={`text-sm ${checked ? "text-[#0F172A] font-medium" : "text-[#64748B]"}`}>{t(f.label)}{f.required && <span className="text-[#DC2626]"> *</span>}</span>
                </button>
              );
            })}
          </div>
        )}

        {otherFields.map((f) => (
          <div key={f.id}>
            <label className="text-xs font-medium text-[#0F172A]">{t(f.label)}{f.required && <span className="text-[#DC2626]"> *</span>}</label>
            {f.helpText && <p className="text-[10px] text-[#94A3B8] mb-1">{t(f.helpText)}</p>}
            {missingFields.has(f.id) && <p className="text-[10px] text-[#DC2626] mb-1">{t("This field is required")}</p>}
            <div className={`mt-1 ${missingFields.has(f.id) ? "rounded-lg ring-1 ring-[#DC2626]" : ""}`}>
              {f.type === "text" && <Input value={(values[f.id] as string) ?? ""} onChange={(e) => setValue(f.id, e.target.value)} className="h-9" />}
              {f.type === "number" && <Input type="number" value={(values[f.id] as string) ?? ""} onChange={(e) => setValue(f.id, e.target.value)} className="h-9" />}
              {f.type === "textarea" && <Textarea value={(values[f.id] as string) ?? ""} onChange={(e) => setValue(f.id, e.target.value)} rows={3} className="text-sm" />}
              {f.type === "select" && (
                <Select value={(values[f.id] as string) ?? undefined} onValueChange={(v) => setValue(f.id, v)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder={t("Select...")} /></SelectTrigger>
                  <SelectContent>{(f.options ?? []).map((o) => <SelectItem key={o} value={o}>{t(o)}</SelectItem>)}</SelectContent>
                </Select>
              )}
              {f.type === "yesno" && (
                <div className="flex gap-2">
                  {(["Yes", "No"] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setValue(f.id, opt)}
                      className={`h-9 px-4 rounded-lg border text-sm font-medium ${values[f.id] === opt ? "bg-[#0891B2] text-white border-[#0891B2]" : "border-[#E2E8F0] text-[#64748B]"}`}
                    >
                      {t(opt)}
                    </button>
                  ))}
                </div>
              )}
              {f.type === "photo" && (
                <div className="space-y-2">
                  {onUploadPhoto ? (
                    <label className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-[#E2E8F0] text-sm text-[#0F172A] cursor-pointer hover:bg-[#F8FAFC] w-fit">
                      <Upload className="w-3.5 h-3.5" />
                      {uploadingField === f.id ? t("Uploading...") : t("Add Photo")}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoSelect(f.id, e)} disabled={uploadingField === f.id} />
                    </label>
                  ) : (
                    <p className="text-xs text-[#94A3B8]">{t("Photo upload not available here.")}</p>
                  )}
                  {((values[f.id] as string[] | undefined) ?? []).length > 0 && (
                    <div className="grid grid-cols-4 gap-2">
                      {(values[f.id] as string[]).map((url, i) => (
                        <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-[#E2E8F0]">
                          <img src={url} alt="Upload" className="w-full h-full object-cover" />
                          <button
                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center"
                            onClick={() => setValue(f.id, (values[f.id] as string[]).filter((_, idx) => idx !== i))}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {missingFields.size > 0 && (
          <p className="text-xs text-[#DC2626]">{t("Please fill in every mandatory field before saving.")}</p>
        )}
        <div className="flex items-center justify-between pt-2">
          {checkboxFields.length > 0 && (
            <p className="text-xs text-[#64748B]">{completedCount} {t("of")} {checkboxFields.length} {t("items completed")}</p>
          )}
          <Button
            size="sm"
            className={`gap-2 ml-auto text-white ${saved ? "bg-[#16A34A] hover:bg-[#15803D]" : "bg-[#0891B2] hover:bg-[#0E7490]"}`}
            onClick={handleSave}
            disabled={saving}
          >
            <CheckCircle2 className="w-4 h-4" /> {saved ? t("Saved!") : saving ? t("Saving...") : t("Save Form")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
