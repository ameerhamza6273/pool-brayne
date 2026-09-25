import { useState } from "react";
import { FileText, Upload, FolderOpen, Pencil, Trash2, Check, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/SearchableSelect";
import { useLanguage } from "@/lib/language-context";
import { useConfigLists } from "@/hooks/use-config-lists";
import type { LibraryDocument } from "@/lib/api/library";

// Client video 2026-09-25: "Use file name" is the default -- the old default ("Sand Change Form", first of a
// hardcoded list) silently relabelled any other upload (e.g. "Curing Process"). Types now come from the
// tenant-editable Document List (Data > Document List).
const USE_FILE_NAME = "__file_name__";
const fileBaseName = (name: string) => name.replace(/\.[^.]+$/, "");

export type DocumentAttachment = { id: string; url: string; label: string | null; filename: string | null; created_at: string };

// Client request 2026-09-03: "Need a Document section to send to customers on an estimate / job
// (these documents can be attached to the estimate / job)" — a generic upload+list, reused on
// both JobDetail and EstimateDetail (each wires its own storage bucket path + API call).
// Client feedback 2026-09-11: "Make sure there is a link to select a document from the document
// folder in a drop down menu" -- these are typically the client's scope-of-work PDFs already
// sitting in the Library, so re-uploading them per estimate/job was the actual complaint.
// `libraryDocuments` + `onAttachExisting` are optional so callers that haven't loaded the
// library yet degrade to upload-only. `onRename` / `onDelete` (client video 2026-09-25) are optional
// too -- the Edit / Delete buttons only show where the caller wires them.
export default function DocumentsSection({
  documents,
  onUpload,
  uploading,
  libraryDocuments,
  onAttachExisting,
  onRename,
  onDelete,
  collapseWhenEmpty,
}: {
  documents: DocumentAttachment[];
  onUpload: (file: File, label: string) => Promise<void>;
  uploading?: boolean;
  libraryDocuments?: LibraryDocument[];
  onAttachExisting?: (doc: LibraryDocument) => Promise<void>;
  onRename?: (doc: DocumentAttachment, label: string) => Promise<void>;
  onDelete?: (doc: DocumentAttachment) => Promise<void>;
  // Client SMS 2026-09-25: "if a document is not selected do not show the document section" (estimate + job):
  // with no documents the card shrinks to one "Add document" button that opens it.
  collapseWhenEmpty?: boolean;
}) {
  const { t } = useLanguage();
  const { lists } = useConfigLists();
  const documentTypes = lists.document_types.map((i) => i.label);
  const [label, setLabel] = useState(USE_FILE_NAME);
  const [attaching, setAttaching] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<DocumentAttachment | null>(null);
  const [expanded, setExpanded] = useState(false);

  const handleSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await onUpload(file, label === USE_FILE_NAME ? fileBaseName(file.name) : label);
    e.target.value = "";
  };

  const handleAttachExisting = async (docId: string) => {
    const doc = libraryDocuments?.find((d) => d.id === docId);
    if (!doc || !onAttachExisting) return;
    setAttaching(true);
    try {
      await onAttachExisting(doc);
    } finally {
      setAttaching(false);
    }
  };

  const saveRename = async (doc: DocumentAttachment) => {
    if (!onRename || !editLabel.trim()) return;
    setSaving(true);
    try {
      await onRename(doc, editLabel.trim());
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!onDelete || !deleting) return;
    setSaving(true);
    try {
      await onDelete(deleting);
      setDeleting(null);
    } finally {
      setSaving(false);
    }
  };

  if (collapseWhenEmpty && documents.length === 0 && !expanded && !uploading && !attaching) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-[#CBD5E1] py-2.5 text-sm text-[#64748B] hover:border-[#0891B2] hover:text-[#0891B2] bg-white"
      >
        <FileText className="w-4 h-4" /> {t("Add document")}
      </button>
    );
  }

  return (
    <Card className="border-[#E2E8F0] shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-[#0F172A] flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#0891B2]" /> {t("Documents")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="flex gap-2">
          <Select value={label} onValueChange={setLabel}>
            <SelectTrigger className="h-9 flex-1 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={USE_FILE_NAME}>{t("Use file name")}</SelectItem>
              {documentTypes.map((l) => <SelectItem key={l} value={l}>{t(l)}</SelectItem>)}
            </SelectContent>
          </Select>
          <label className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-[#E2E8F0] text-sm text-[#0F172A] cursor-pointer hover:bg-[#F8FAFC]">
            <Upload className="w-3.5 h-3.5" />
            {uploading ? t("Uploading...") : t("Upload")}
            <input type="file" className="hidden" onChange={handleSelect} disabled={uploading} />
          </label>
        </div>
        {onAttachExisting && (
          <div>
            <p className="text-xs font-medium text-[#64748B] mb-1 flex items-center gap-1"><FolderOpen className="w-3.5 h-3.5" /> {t("Attach from Library")}</p>
            <SearchableSelect
              value=""
              onChange={handleAttachExisting}
              placeholder={attaching ? t("Attaching...") : t("Pick an existing document...")}
              searchPlaceholder={t("Search library documents...")}
              emptyText={t("No matching documents.")}
              options={(libraryDocuments ?? []).map((d) => ({ value: d.id, label: d.name, sublabel: d.category ?? undefined }))}
            />
          </div>
        )}
        {documents.length === 0 && <p className="text-xs text-[#64748B]">{t("No documents yet.")}</p>}
        {documents.map((d) =>
          editingId === d.id ? (
            <div key={d.id} className="flex items-center gap-1.5 rounded-lg border border-[#0891B2]/40 px-2 py-1.5">
              <Input
                autoFocus
                list="document-type-options"
                className="h-8 text-sm flex-1"
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveRename(d); if (e.key === "Escape") setEditingId(null); }}
              />
              <button className="p-1.5 rounded text-[#16A34A] hover:bg-[#16A34A]/10 disabled:opacity-50" title={t("Save")} disabled={saving || !editLabel.trim()} onClick={() => saveRename(d)}>
                <Check className="w-4 h-4" />
              </button>
              <button className="p-1.5 rounded text-[#64748B] hover:bg-[#F1F5F9]" title={t("Cancel")} onClick={() => setEditingId(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div key={d.id} className="flex items-center gap-1 rounded-lg border border-[#F1F5F9] hover:bg-[#F8FAFC]">
              <a href={d.url} target="_blank" rel="noreferrer" className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2">
                <FileText className="w-4 h-4 text-[#64748B] shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#0891B2] truncate">{d.label ?? t("Document")}</p>
                  {d.filename && <p className="text-xs text-[#64748B] truncate">{d.filename}</p>}
                </div>
              </a>
              {onRename && (
                <button className="p-1.5 rounded text-[#64748B] hover:text-[#0891B2] hover:bg-[#0891B2]/10 shrink-0" title={t("Edit name")} onClick={() => { setEditingId(d.id); setEditLabel(d.label ?? d.filename ?? ""); }}>
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
              {onDelete && (
                <button className="p-1.5 mr-1 rounded text-[#DC2626] hover:bg-[#DC2626]/10 shrink-0" title={t("Delete")} onClick={() => setDeleting(d)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ),
        )}
        <datalist id="document-type-options">
          {documentTypes.map((l) => <option key={l} value={l} />)}
        </datalist>
      </CardContent>
      <Dialog open={deleting !== null} onOpenChange={(o) => { if (!o) setDeleting(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{t("Remove document?")}</DialogTitle></DialogHeader>
          <p className="text-sm text-[#64748B]">
            {t("This removes the document from here. A copy saved in the Library is not affected.")}
          </p>
          <p className="text-sm font-medium text-[#0F172A] truncate">{deleting?.label ?? deleting?.filename}</p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setDeleting(null)}>{t("Cancel")}</Button>
            <Button className="bg-[#DC2626] hover:bg-[#B91C1C] text-white" disabled={saving} onClick={confirmDelete}>{t("Remove")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
