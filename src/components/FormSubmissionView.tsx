import { CheckCircle2, Circle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/lib/language-context";
import type { FormTemplate } from "@/lib/api/formTemplates";
import type { JobForm } from "@/lib/api/jobs";

// Client video 2026-09-29: "checked all these off... shows under submitted forms, but this is not
// clickable, nor can I open and preview each form. I wrote notes, and they're not visible." —
// DynamicForm only ever renders blank (never seeded from a past submission) and "Submitted Forms"
// only offered "Copy Customer Link", no way to see what was actually filled in. This is a
// read-only replay of one job_forms row against its template's field definitions.
export default function FormSubmissionView({
  template,
  form,
  open,
  onOpenChange,
}: {
  template: FormTemplate | null;
  form: JobForm | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useLanguage();
  if (!form) return null;

  const fields = template?.fields ?? [];
  const checkboxFields = fields.filter((f) => f.type === "checkbox");
  const otherFields = fields.filter((f) => f.type !== "checkbox");
  const data = form.data ?? {};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t(form.template_name ?? form.type)}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-[#64748B] -mt-2">
          {new Date(form.submitted_at).toLocaleString()} &middot; {form.submitted_by_name ?? t("Unknown")}
        </p>

        {!template && (
          <p className="text-sm text-[#64748B]">{t("The original form was deleted — showing raw submitted answers.")}</p>
        )}

        {checkboxFields.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {checkboxFields.map((f) => {
              const checked = !!data[f.id];
              return (
                <div key={f.id} className={`flex items-center gap-2.5 p-2.5 rounded-lg border ${checked ? "border-[#16A34A] bg-[#16A34A]/5" : "border-[#E2E8F0] bg-white"}`}>
                  {checked ? <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" /> : <Circle className="w-4 h-4 text-[#CBD5E1] shrink-0" />}
                  <span className={`text-sm ${checked ? "text-[#0F172A] font-medium" : "text-[#64748B]"}`}>{t(f.label)}</span>
                </div>
              );
            })}
          </div>
        )}

        {otherFields.map((f) => {
          const v = data[f.id];
          if (f.type === "photo") {
            const urls = (v as string[] | undefined) ?? [];
            if (urls.length === 0) return null;
            return (
              <div key={f.id}>
                <p className="text-xs font-medium text-[#0F172A] mb-1">{t(f.label)}</p>
                <div className="grid grid-cols-4 gap-2">
                  {urls.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noreferrer" className="aspect-square rounded-lg overflow-hidden bg-[#0891B2]/10 block">
                      <img src={url} alt={f.label} className="w-full h-full object-cover" />
                    </a>
                  ))}
                </div>
              </div>
            );
          }
          if (v == null || String(v).trim() === "") return null;
          return (
            <div key={f.id}>
              <p className="text-xs font-medium text-[#0F172A]">{t(f.label)}</p>
              <p className="text-sm text-[#64748B] whitespace-pre-wrap">{t(String(v))}</p>
            </div>
          );
        })}

        {/* Raw fallback — no template found (deleted since submission) or template has no fields
            matching the saved keys, but the row still has real data. */}
        {(!template || fields.length === 0) && Object.keys(data).length > 0 && (
          <div className="space-y-2">
            {Object.entries(data).map(([k, v]) => (
              Array.isArray(v) ? null : (
                <div key={k}>
                  <p className="text-xs font-medium text-[#0F172A]">{k}</p>
                  <p className="text-sm text-[#64748B] whitespace-pre-wrap">{String(v)}</p>
                </div>
              )
            ))}
          </div>
        )}

        {form.notes && (
          <div>
            <p className="text-xs font-medium text-[#0F172A]">{t("Notes")}</p>
            <p className="text-sm text-[#64748B] whitespace-pre-wrap">{form.notes}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
