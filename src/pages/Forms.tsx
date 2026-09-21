import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FileStack, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { matchesQuery } from "@/lib/search";
import ViewToggle, { useViewMode } from "@/components/ViewToggle";
import { jobsApi, type JobForm } from "@/lib/api/jobs";
import { useLanguage } from "@/lib/language-context";

// Sidebar restructure (client PDF 2026-09-06, "Employee section > Forms") — every submitted
// form (built-in or custom, via the Form Builder) across the whole tenant. Job-scoped and
// customer-scoped views of the same data live on JobDetail and CustomerDetail respectively.
export default function Forms() {
  const { t } = useLanguage();
  const [forms, setForms] = useState<(JobForm & { job_type: string | null; customer_name: string | null })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useViewMode("forms");
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
        <h1 className="text-2xl font-bold text-[#0F172A]">{t("Forms")}</h1>
        <p className="text-sm text-[#64748B] mt-0.5">{t("Every submitted service form across all jobs.")}</p>
      </div>

      {/* Client SMS 2026-09-21: Forms needs a search field. */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
          <Input placeholder={t("Search form, customer, job type, or submitter...")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-10 bg-white border-[#E2E8F0]" />
        </div>
        <ViewToggle mode={viewMode} onChange={setViewMode} />
      </div>

      {isLoading && <div className="text-center py-8 text-[#64748B]">{t("Loading forms...")}</div>}

      {!isLoading && viewMode === "table" && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Form")}</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Customer")}</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Job Type")}</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Submitted")}</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Submitted By")}</th>
                </tr>
              </thead>
              <tbody>
                {forms.filter((f) => matchesQuery(search, [f.template_name, f.type, f.customer_name, f.job_type, f.submitted_by_name])).map((f) => (
                  <tr key={f.id} onClick={() => navigate(`/jobs/${f.job_id}`)} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] cursor-pointer">
                    <td className="py-3 px-4 font-medium text-[#0F172A]">{f.template_name ?? f.type}</td>
                    <td className="py-3 px-4 text-[#64748B]">{f.customer_name ?? "—"}</td>
                    <td className="py-3 px-4 text-[#64748B]">{f.job_type ?? t("Job")}</td>
                    <td className="py-3 px-4 text-[#64748B]">{new Date(f.submitted_at).toLocaleString()}</td>
                    <td className="py-3 px-4 text-[#64748B]">{f.submitted_by_name ?? t("Unknown")}</td>
                  </tr>
                ))}
                {forms.length === 0 && <tr><td colSpan={5} className="py-10 text-center text-[#64748B]">{t("No forms submitted yet.")}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!isLoading && viewMode === "cards" && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm divide-y divide-[#F1F5F9]">
          {forms.filter((f) => matchesQuery(search, [f.template_name, f.type, f.customer_name, f.job_type, f.submitted_by_name])).map((f) => (
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
                <p className="text-xs text-[#64748B]">{f.job_type ?? t("Job")} · {new Date(f.submitted_at).toLocaleString()} · {f.submitted_by_name ?? t("Unknown")}</p>
              </div>
            </button>
          ))}
          {forms.length === 0 && <div className="text-center py-12 text-[#64748B]">{t("No forms submitted yet.")}</div>}
        </div>
      )}
    </div>
  );
}
