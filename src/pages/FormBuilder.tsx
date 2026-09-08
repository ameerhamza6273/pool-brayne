import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, FileStack, Eye, EyeOff, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formTemplatesApi, type FormTemplate, type FormField, type FormFieldType } from "@/lib/api/formTemplates";
import { jobTypes } from "@/lib/data";

const fieldTypeLabels: Record<FormFieldType, string> = {
  text: "Short Text",
  textarea: "Long Text",
  number: "Number",
  select: "Dropdown",
  checkbox: "Checklist Item",
  yesno: "Yes / No",
  photo: "Photo",
};

const emptyField = (): FormField => ({ id: `field_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, label: "", type: "text" });

// Client SMS 2026-09-06: "something he can create his own forms... nothing crazy... need to be
// able to edit, create, and tag to a job". This is where templates get created/edited; tagging
// to a job happens on JobDetail (any template can be added to any job, plus each template can
// optionally suggest itself for a job type via `appliesTo`).
export default function FormBuilder() {
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FormTemplate | null>(null);
  const [draft, setDraft] = useState({ name: "", description: "", appliesTo: "any", customerVisible: false });
  const [fields, setFields] = useState<FormField[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setTemplates(await formTemplatesApi.list());
    setIsLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = () => {
    setEditing(null);
    setDraft({ name: "", description: "", appliesTo: "any", customerVisible: false });
    setFields([emptyField()]);
    setOpen(true);
  };

  const openEdit = (t: FormTemplate) => {
    setEditing(t);
    setDraft({ name: t.name, description: t.description ?? "", appliesTo: t.applies_to ?? "any", customerVisible: t.customer_visible });
    setFields(t.fields.length > 0 ? t.fields : [emptyField()]);
    setOpen(true);
  };

  const updateField = (idx: number, patch: Partial<FormField>) => {
    setFields((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  };

  const handleSave = async () => {
    if (!draft.name.trim()) return;
    setSaving(true);
    const cleanFields = fields.filter((f) => f.label.trim());
    const data = {
      name: draft.name,
      description: draft.description || null,
      appliesTo: draft.appliesTo === "any" ? null : draft.appliesTo,
      customerVisible: draft.customerVisible,
      fields: cleanFields,
    };
    try {
      if (editing) await formTemplatesApi.update(editing.id, data);
      else await formTemplatesApi.create(data);
      setOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await formTemplatesApi.remove(id);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Form Builder</h1>
          <p className="text-sm text-[#64748B] mt-0.5">Create and edit your own service forms — tag them to any job.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#0891B2] hover:bg-[#0E7490] text-white gap-2 h-10" onClick={openNew}>
              <Plus className="w-4 h-4" /> New Form
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl lg:max-w-3xl w-[90vw] max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? "Edit Form" : "New Form"}</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div><Label>Form Name</Label><Input className="mt-1" placeholder="e.g. Salt System Inspection" value={draft.name} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))} /></div>
              <div><Label>Description (optional)</Label><Input className="mt-1" value={draft.description} onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Suggest for Job Type</Label>
                  <Select value={draft.appliesTo} onValueChange={(v) => setDraft((p) => ({ ...p, appliesTo: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any job type</SelectItem>
                      {jobTypes.map((t) => <SelectItem key={t.id} value={t.label}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 mt-6">
                  <Switch id="customer-visible" checked={draft.customerVisible} onCheckedChange={(v) => setDraft((p) => ({ ...p, customerVisible: v }))} />
                  <Label htmlFor="customer-visible" className="cursor-pointer">Customers can view submitted copies</Label>
                </div>
              </div>

              <div className="border-t border-[#E2E8F0] pt-4">
                <Label>Fields</Label>
                <div className="space-y-2 mt-2">
                  {fields.map((f, idx) => (
                    <div key={f.id} className="border border-[#E2E8F0] rounded-lg p-3 space-y-2 bg-[#F8FAFC]">
                      <div className="flex items-center gap-2">
                        <Input placeholder="Field label" className="h-8 text-sm flex-1" value={f.label} onChange={(e) => updateField(idx, { label: e.target.value })} />
                        <Select value={f.type} onValueChange={(v) => updateField(idx, { type: v as FormFieldType })}>
                          <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {(Object.keys(fieldTypeLabels) as FormFieldType[]).map((t) => <SelectItem key={t} value={t}>{fieldTypeLabels[t]}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-[#DC2626] shrink-0" onClick={() => setFields((prev) => prev.filter((_, i) => i !== idx))}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      {f.type === "select" && (
                        <Input
                          placeholder="Options, comma separated (e.g. Truck Supply, Customer Supply)"
                          className="h-8 text-xs"
                          value={(f.options ?? []).join(", ")}
                          onChange={(e) => updateField(idx, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                        />
                      )}
                      <Input
                        placeholder="Help text (optional, e.g. 'Ideal range: 7.2-7.8')"
                        className="h-8 text-xs"
                        value={f.helpText ?? ""}
                        onChange={(e) => updateField(idx, { helpText: e.target.value })}
                      />
                    </div>
                  ))}
                </div>
                <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 border-[#E2E8F0] mt-2" onClick={() => setFields((prev) => [...prev, emptyField()])}>
                  <Plus className="w-3.5 h-3.5" /> Add Field
                </Button>
              </div>

              <Button className="w-full bg-[#0891B2] hover:bg-[#0E7490] text-white" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : editing ? "Save Changes" : "Create Form"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading && <div className="text-center py-8 text-[#64748B]">Loading forms...</div>}

      {!isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <div key={t.id} className="bg-white rounded-xl p-4 border border-[#E2E8F0] shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg bg-[#0891B2]/10 flex items-center justify-center shrink-0">
                    <FileStack className="w-4.5 h-4.5 text-[#0891B2]" />
                  </div>
                  <div>
                    <p className="font-semibold text-[#0F172A]">{t.name}</p>
                    <p className="text-xs text-[#64748B]">{t.fields.length} field{t.fields.length === 1 ? "" : "s"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(t)} className="text-[#64748B] hover:text-[#0891B2] p-1"><Pencil className="w-3.5 h-3.5" /></button>
                  {!t.is_builtin && (
                    <button onClick={() => handleDelete(t.id)} className="text-[#64748B] hover:text-[#DC2626] p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {t.applies_to && <Badge className="bg-[#0891B2]/10 text-[#0891B2] text-[10px] px-1.5 py-0">{t.applies_to}</Badge>}
                <Badge className={`text-[10px] px-1.5 py-0 gap-1 ${t.customer_visible ? "bg-[#16A34A]/10 text-[#16A34A]" : "bg-[#F1F5F9] text-[#64748B]"}`}>
                  {t.customer_visible ? <Eye className="w-2.5 h-2.5" /> : <EyeOff className="w-2.5 h-2.5" />}
                  {t.customer_visible ? "Customer visible" : "Internal only"}
                </Badge>
              </div>
            </div>
          ))}
          {templates.length === 0 && <div className="col-span-full text-center py-12 text-[#64748B]">No forms yet — create your first one.</div>}
        </div>
      )}
    </div>
  );
}
