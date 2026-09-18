import { useState, useEffect, useCallback } from "react";
import { Upload, Trash2, FileText, BookOpen, Search, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { libraryApi, type LibraryDocument } from "@/lib/api/library";
import { libraryCategories, libraryManufacturers } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { matchesQuery } from "@/lib/search";

// Sidebar restructure (client PDF 2026-09-06, "Employee section > Library") — a generic
// tenant document repository (SOPs, price sheets, training material), reusing the same
// job-attachments storage bucket under a `library/` sub-path (its RLS only checks the
// tenant_id path segment, same established pattern as tasks/customer-photos/estimate-docs).
//
// Client meeting 2026-09: category + manufacturer need to be dropdowns (not free text) so they
// match the same vocabulary used in Inventory/POS, and every PDF can be tagged after the fact,
// not just at upload time.
export default function Library() {
  const { t } = useLanguage();
  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Client excel sheet 2026-09-18: Library's category/manufacturer lists are its own fixed
  // vocabulary now, not shared with Inventory's product taxonomy (see src/lib/data.ts).
  const categories = libraryCategories;
  const manufacturers = libraryManufacturers;
  const [uploadCategory, setUploadCategory] = useState("");
  const [uploadManufacturer, setUploadManufacturer] = useState("");
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [manufacturerFilter, setManufacturerFilter] = useState("All");
  const [tagging, setTagging] = useState<LibraryDocument | null>(null);
  const [tagDraft, setTagDraft] = useState({ category: "", manufacturer: "" });
  const { tenantId } = useAuth();

  const load = useCallback(async () => {
    setIsLoading(true);
    const docs = await libraryApi.list();
    setDocuments(docs);
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
      await libraryApi.add({ name: file.name, category: uploadCategory || null, manufacturer: uploadManufacturer || null, url: data.publicUrl, filename: file.name });
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

  const openTagDialog = (d: LibraryDocument) => {
    setTagging(d);
    setTagDraft({ category: d.category ?? "", manufacturer: d.manufacturer ?? "" });
  };

  const handleSaveTags = async () => {
    if (!tagging) return;
    await libraryApi.update(tagging.id, { category: tagDraft.category || null, manufacturer: tagDraft.manufacturer || null });
    setTagging(null);
    load();
  };

  const filtered = documents.filter((d) => {
    const matchesSearch = matchesQuery(search, [d.name, d.category, d.manufacturer]);
    const matchesCategory = categoryFilter === "All" || d.category === categoryFilter;
    const matchesManufacturer = manufacturerFilter === "All" || d.manufacturer === manufacturerFilter;
    return matchesSearch && matchesCategory && matchesManufacturer;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">{t("Library")}</h1>
          <p className="text-sm text-[#64748B] mt-0.5">{t("Company documents — SOPs, price sheets, training material.")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={uploadCategory || "none"} onValueChange={(v) => setUploadCategory(v === "none" ? "" : v)}>
            <SelectTrigger className="h-10 w-40 bg-white border-[#E2E8F0]"><SelectValue placeholder={t("Category")} /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="none">{t("No category")}</SelectItem>
              {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={uploadManufacturer || "none"} onValueChange={(v) => setUploadManufacturer(v === "none" ? "" : v)}>
            <SelectTrigger className="h-10 w-40 bg-white border-[#E2E8F0]"><SelectValue placeholder={t("Manufacturer")} /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="none">{t("No manufacturer")}</SelectItem>
              {manufacturers.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <label className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-[#0891B2] hover:bg-[#0E7490] text-white text-sm font-medium cursor-pointer">
            <Upload className="w-4 h-4" /> {uploading ? t("Uploading...") : t("Upload")}
            <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
          <Input placeholder={t("Search document name, category, or manufacturer...")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-10 bg-white border-[#E2E8F0]" />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="h-10 w-40 bg-white border-[#E2E8F0]"><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="All">{t("All Categories")}</SelectItem>
            {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={manufacturerFilter} onValueChange={setManufacturerFilter}>
          <SelectTrigger className="h-10 w-40 bg-white border-[#E2E8F0]"><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="All">{t("All Manufacturers")}</SelectItem>
            {manufacturers.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading && <div className="text-center py-8 text-[#64748B]">{t("Loading library...")}</div>}

      {!isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((d) => (
            <div key={d.id} className="bg-white rounded-xl p-4 border border-[#E2E8F0] shadow-sm flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#0891B2]/10 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-[#0891B2]" />
              </div>
              <div className="flex-1 min-w-0">
                <a href={d.url} target="_blank" rel="noreferrer" className="font-semibold text-[#0891B2] hover:underline break-words">{d.name}</a>
                <div className="flex flex-wrap gap-1 mt-1">
                  {d.category && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F1F5F9] text-[#64748B]">{d.category}</span>}
                  {d.manufacturer && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F1F5F9] text-[#64748B]">{d.manufacturer}</span>}
                </div>
                <p className="text-xs text-[#94A3B8] mt-0.5">{d.uploaded_by_name ?? t("Unknown")} · {new Date(d.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex flex-col gap-2 items-center shrink-0">
                <button className="text-[#64748B] hover:text-[#0891B2]" title={t("Edit category / manufacturer")} onClick={() => openTagDialog(d)}>
                  <Pencil className="w-4 h-4" />
                </button>
                <button className="text-[#64748B] hover:text-[#DC2626]" onClick={() => handleDelete(d.id)}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12 text-[#64748B]">
              <BookOpen className="w-8 h-8 mx-auto mb-2 text-[#CBD5E1]" />
              {t("No documents in the library yet.")}
            </div>
          )}
        </div>
      )}

      <Dialog open={!!tagging} onOpenChange={(open) => !open && setTagging(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("Tag Document")}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>{t("Category")}</Label>
              <Select value={tagDraft.category || "none"} onValueChange={(v) => setTagDraft((p) => ({ ...p, category: v === "none" ? "" : v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="none">{t("No category")}</SelectItem>
                  {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("Manufacturer")}</Label>
              <Select value={tagDraft.manufacturer || "none"} onValueChange={(v) => setTagDraft((p) => ({ ...p, manufacturer: v === "none" ? "" : v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="none">{t("No manufacturer")}</SelectItem>
                  {manufacturers.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full bg-[#0891B2] text-white" onClick={handleSaveTags}>{t("Save")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
