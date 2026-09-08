import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FileStack } from "lucide-react";
import { jobsApi, type JobForm } from "@/lib/api/jobs";

// Sidebar restructure (client PDF 2026-09-06, "Employee section > Forms") — every submitted
// form (built-in or custom, via the Form Builder) across the whole tenant. Job-scoped and
// customer-scoped views of the same data live on JobDetail and CustomerDetail respectively.
export default function Forms() {
  const [forms, setForms] = useState<(JobForm & { job_type: string | null; customer_name: string | null })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    jobsApi.getAllForms().then((data) => {
      setForms(data ?? []);
      setIsLoading(false);
    });
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-[#0F172A]">Forms</h1>
        <p className="text-sm text-[#64748B] mt-0.5">Every submitted service form across all jobs.</p>
      </div>

      {isLoading && <div className="text-center py-8 text-[#64748B]">Loading forms...</div>}

      {!isLoading && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm divide-y divide-[#F1F5F9]">
          {forms.map((f) => (
            <button
              key={f.id}
              onClick={() => navigate(`/jobs/${f.job_id}`)}
              className="w-full flex items-center gap-3 p-4 text-left hover:bg-[#F8FAFC] transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-[#0891B2]/10 flex items-center justify-center shrink-0">
                <FileStack className="w-4.5 h-4.5 text-[#0891B2]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#0F172A]">{f.template_name ?? f.type} {f.customer_name ? `— ${f.customer_name}` : ""}</p>
                <p className="text-xs text-[#64748B]">{f.job_type ?? "Job"} · {new Date(f.submitted_at).toLocaleString()} · {f.submitted_by_name ?? "Unknown"}</p>
              </div>
            </button>
          ))}
          {forms.length === 0 && <div className="text-center py-12 text-[#64748B]">No forms submitted yet.</div>}
        </div>
      )}
    </div>
  );
}
