import { useState, useEffect, useCallback } from "react";
import { Upload, Trash2, FileText, BookOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { libraryApi, type LibraryDocument } from "@/lib/api/library";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

// Sidebar restructure (client PDF 2026-09-06, "Employee section > Library") — a generic
// tenant document repository (SOPs, price sheets, training material), reusing the same
// job-attachments storage bucket under a `library/` sub-path (its RLS only checks the
// tenant_id path segment, same established pattern as tasks/customer-photos/estimate-docs).
export default function Library() {
  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [category, setCategory] = useState("");
  const [uploading, setUploading] = useState(false);
  const { tenantId } = useAuth();

  const load = useCallback(async () => {
    setIsLoading(true);
    setDocuments(await libraryApi.list());
    setIsLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tenantId) return;
    setUploading(true);
    try {
      const path = `${tenantId}/library/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("job-attachments").upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from("job-attachments").getPublicUrl(path);
      await libraryApi.add({ name: file.name, category: category || null, url: data.publicUrl, filename: file.name });
      load();
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    await libraryApi.remove(id);
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Library</h1>
          <p className="text-sm text-[#64748B] mt-0.5">Company documents — SOPs, price sheets, training material.</p>
        </div>
        <div className="flex gap-2">
          <Input placeholder="Category (optional)" className="w-40" value={category} onChange={(e) => setCategory(e.target.value)} />
          <label className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-[#0891B2] hover:bg-[#0E7490] text-white text-sm font-medium cursor-pointer">
            <Upload className="w-4 h-4" /> {uploading ? "Uploading..." : "Upload"}
            <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>
      </div>

      {isLoading && <div className="text-center py-8 text-[#64748B]">Loading library...</div>}

      {!isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((d) => (
            <div key={d.id} className="bg-white rounded-xl p-4 border border-[#E2E8F0] shadow-sm flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#0891B2]/10 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-[#0891B2]" />
              </div>
              <div className="flex-1 min-w-0">
                <a href={d.url} target="_blank" rel="noreferrer" className="font-semibold text-[#0891B2] hover:underline break-words">{d.name}</a>
                {d.category && <p className="text-xs text-[#64748B] mt-0.5">{d.category}</p>}
                <p className="text-xs text-[#94A3B8] mt-0.5">{d.uploaded_by_name ?? "Unknown"} · {new Date(d.created_at).toLocaleDateString()}</p>
              </div>
              <button className="text-[#64748B] hover:text-[#DC2626]" onClick={() => handleDelete(d.id)}>
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {documents.length === 0 && (
            <div className="col-span-full text-center py-12 text-[#64748B]">
              <BookOpen className="w-8 h-8 mx-auto mb-2 text-[#CBD5E1]" />
              No documents in the library yet.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
