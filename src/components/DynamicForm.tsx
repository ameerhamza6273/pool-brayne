import { useState } from "react";
import { CheckCircle2, Circle, Upload, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FormTemplate } from "@/lib/api/formTemplates";

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
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  const setValue = (id: string, v: unknown) => setValues((p) => ({ ...p, [id]: v }));

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
        <CardTitle className="text-sm font-semibold text-[#0F172A]">{template.name}</CardTitle>
        {template.description && <p className="text-xs text-[#64748B]">{template.description}</p>}
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {checkboxFields.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {checkboxFields.map((f) => {
              const checked = !!values[f.id];
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setValue(f.id, !checked)}
                  className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-left transition-colors ${
                    checked ? "border-[#16A34A] bg-[#16A34A]/5" : "border-[#E2E8F0] bg-white hover:bg-[#F8FAFC]"
                  }`}
                >
                  {checked ? <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" /> : <Circle className="w-4 h-4 text-[#CBD5E1] shrink-0" />}
                  <span className={`text-sm ${checked ? "text-[#0F172A] font-medium" : "text-[#64748B]"}`}>{f.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {otherFields.map((f) => (
          <div key={f.id}>
            <label className="text-xs font-medium text-[#0F172A]">{f.label}</label>
            {f.helpText && <p className="text-[10px] text-[#94A3B8] mb-1">{f.helpText}</p>}
            <div className="mt-1">
              {f.type === "text" && <Input value={(values[f.id] as string) ?? ""} onChange={(e) => setValue(f.id, e.target.value)} className="h-9" />}
              {f.type === "number" && <Input type="number" value={(values[f.id] as string) ?? ""} onChange={(e) => setValue(f.id, e.target.value)} className="h-9" />}
              {f.type === "textarea" && <Textarea value={(values[f.id] as string) ?? ""} onChange={(e) => setValue(f.id, e.target.value)} rows={3} className="text-sm" />}
              {f.type === "select" && (
                <Select value={(values[f.id] as string) ?? undefined} onValueChange={(v) => setValue(f.id, v)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>{(f.options ?? []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
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
                      {opt}
                    </button>
                  ))}
                </div>
              )}
              {f.type === "photo" && (
                <div className="space-y-2">
                  {onUploadPhoto ? (
                    <label className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-[#E2E8F0] text-sm text-[#0F172A] cursor-pointer hover:bg-[#F8FAFC] w-fit">
                      <Upload className="w-3.5 h-3.5" />
                      {uploadingField === f.id ? "Uploading..." : "Add Photo"}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoSelect(f.id, e)} disabled={uploadingField === f.id} />
                    </label>
                  ) : (
                    <p className="text-xs text-[#94A3B8]">Photo upload not available here.</p>
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

        <div className="flex items-center justify-between pt-2">
          {checkboxFields.length > 0 && (
            <p className="text-xs text-[#64748B]">{completedCount} of {checkboxFields.length} items completed</p>
          )}
          <Button
            size="sm"
            className={`gap-2 ml-auto text-white ${saved ? "bg-[#16A34A] hover:bg-[#15803D]" : "bg-[#0891B2] hover:bg-[#0E7490]"}`}
            onClick={handleSave}
            disabled={saving}
          >
            <CheckCircle2 className="w-4 h-4" /> {saved ? "Saved!" : saving ? "Saving..." : "Save Form"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
