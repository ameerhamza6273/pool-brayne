import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Droplets } from "lucide-react";
import { publicFormsApi, type PublicForm as PublicFormBundle } from "@/lib/api/jobs";

// Client PDF 2026-09-05 (check list forms.pdf / inspection form.pdf): "make sure customers can
// see form" — same no-login pattern as the estimate approval page (PublicEstimate.tsx).
export default function PublicForm() {
  const { token } = useParams<{ token: string }>();
  const [bundle, setBundle] = useState<PublicFormBundle | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    publicFormsApi.get(token)
      .then(setBundle)
      .catch(() => setBundle(null))
      .finally(() => setIsLoading(false));
  }, [token]);

  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-[#64748B]">Loading form...</div>;
  if (!bundle) return <div className="min-h-screen flex items-center justify-center text-[#64748B]">Form not found.</div>;

  const { data, template } = bundle;

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#0891B2] flex items-center justify-center"><Droplets className="w-4 h-4 text-white" /></div>
          <span className="font-bold text-[#0C2A3A]">{template.name}</span>
        </div>

        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-6 lg:p-8 space-y-5">
          <div>
            <h1 className="text-xl font-bold text-[#0F172A]">{template.name}</h1>
            <p className="text-sm text-[#64748B]">
              {bundle.customers?.name ? `For ${bundle.customers.name} · ` : ""}
              Submitted {new Date(bundle.submitted_at).toLocaleDateString()}
            </p>
          </div>

          <div className="space-y-3">
            {template.fields.filter((f) => f.type !== "checkbox").map((f) => {
              const value = data[f.id];
              if (value === undefined || value === null || value === "") return null;
              return (
                <div key={f.id} className="border-b border-[#F1F5F9] pb-3">
                  <p className="text-xs font-semibold text-[#64748B] uppercase">{f.label}</p>
                  {f.type === "photo" && Array.isArray(value) ? (
                    <div className="grid grid-cols-3 gap-2 mt-1">
                      {(value as string[]).map((url, i) => (
                        <img key={i} src={url} alt={f.label} className="rounded-lg border border-[#E2E8F0] aspect-square object-cover" />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[#0F172A] mt-0.5">{String(value)}</p>
                  )}
                </div>
              );
            })}
            {template.fields.some((f) => f.type === "checkbox") && (
              <div>
                <p className="text-xs font-semibold text-[#64748B] uppercase mb-1.5">Checklist</p>
                <div className="space-y-1">
                  {template.fields.filter((f) => f.type === "checkbox").map((f) => (
                    <p key={f.id} className="text-sm flex items-center gap-2">
                      <span className={data[f.id] ? "text-[#16A34A]" : "text-[#CBD5E1]"}>{data[f.id] ? "✓" : "○"}</span>
                      <span className={data[f.id] ? "text-[#0F172A]" : "text-[#94A3B8]"}>{f.label}</span>
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
