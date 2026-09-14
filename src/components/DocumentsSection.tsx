import { useState } from "react";
import { FileText, Upload, FolderOpen } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchableSelect } from "@/components/SearchableSelect";
import { useLanguage } from "@/lib/language-context";
import type { LibraryDocument } from "@/lib/api/library";

const DOCUMENT_LABELS = ["Sand Change Form", "Automation Checklist", "Weekly Service Form", "Other"];

export type DocumentAttachment = { id: string; url: string; label: string | null; filename: string | null; created_at: string };

// Client request 2026-09-03: "Need a Document section to send to customers on an estimate / job
// (these documents can be attached to the estimate / job)" — a generic upload+list, reused on
// both JobDetail and EstimateDetail (each wires its own storage bucket path + API call).
// Client feedback 2026-09-11: "Make sure there is a link to select a document from the document
// folder in a drop down menu" -- these are typically the client's scope-of-work PDFs already
// sitting in the Library, so re-uploading them per estimate/job was the actual complaint.
// `libraryDocuments` + `onAttachExisting` are optional so callers that haven't loaded the
// library yet degrade to upload-only.
export default function DocumentsSection({
  documents,
  onUpload,
  uploading,
  libraryDocuments,
  onAttachExisting,
}: {
  documents: DocumentAttachment[];
  onUpload: (file: File, label: string) => Promise<void>;
  uploading?: boolean;
  libraryDocuments?: LibraryDocument[];
  onAttachExisting?: (doc: LibraryDocument) => Promise<void>;
}) {
  const { t } = useLanguage();
  const [label, setLabel] = useState(DOCUMENT_LABELS[0]);
  const [attaching, setAttaching] = useState(false);

  const handleSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await onUpload(file, label);
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
              {DOCUMENT_LABELS.map((l) => <SelectItem key={l} value={l}>{t(l)}</SelectItem>)}
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
        {documents.map((d) => (
          <a
            key={d.id}
            href={d.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-lg border border-[#F1F5F9] px-3 py-2 hover:bg-[#F8FAFC]"
          >
            <FileText className="w-4 h-4 text-[#64748B] shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#0891B2] truncate">{d.label ?? t("Document")}</p>
              {d.filename && <p className="text-xs text-[#64748B] truncate">{d.filename}</p>}
            </div>
          </a>
        ))}
      </CardContent>
    </Card>
  );
}
