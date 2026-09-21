import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Phone, BookUser, Search } from "lucide-react";
import { matchesQuery } from "@/lib/search";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { directoryApi, type DirectoryContact } from "@/lib/api/directory";
import { formatPhoneInput } from "@/lib/phone";
import { useLanguage } from "@/lib/language-context";
import ViewToggle, { useViewMode } from "@/components/ViewToggle";

// Client request 2026-09-02: a field Directory of sales-rep names/phone numbers for techs to
// look up on the road.
export default function Directory() {
  const { t } = useLanguage();
  const [contacts, setContacts] = useState<DirectoryContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useViewMode("directory");
  const [newContact, setNewContact] = useState({ name: "", role: "", phone: "" });

  const load = useCallback(async () => {
    setIsLoading(true);
    setContacts(await directoryApi.list());
    setIsLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async () => {
    if (!newContact.name) return;
    await directoryApi.create({ name: newContact.name, role: newContact.role || null, phone: newContact.phone || null });
    setNewContact({ name: "", role: "", phone: "" });
    setAddOpen(false);
    load();
  };

  const handleDelete = async (id: string) => {
    await directoryApi.remove(id);
    setContacts((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">{t("Directory")}</h1>
          <p className="text-sm text-[#64748B] mt-0.5">{t("Sales rep contacts for techs to use in the field.")}</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#0891B2] hover:bg-[#0E7490] text-white gap-2 h-10"><Plus className="w-4 h-4" /> {t("Add Contact")}</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{t("Add Directory Contact")}</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div><Label>{t("Name")}</Label><Input className="mt-1" value={newContact.name} onChange={(e) => setNewContact((p) => ({ ...p, name: e.target.value }))} /></div>
              <div><Label>{t("Role")}</Label><Input className="mt-1" placeholder={t("e.g. Sales Rep")} value={newContact.role} onChange={(e) => setNewContact((p) => ({ ...p, role: e.target.value }))} /></div>
              <div><Label>{t("Phone")}</Label><Input className="mt-1" value={newContact.phone} onChange={(e) => setNewContact((p) => ({ ...p, phone: formatPhoneInput(e.target.value) }))} /></div>
              <Button className="w-full bg-[#0891B2] text-white" onClick={handleAdd}>{t("Save Contact")}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Client SMS 2026-09-21: Directory needs a search field. */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
          <Input placeholder={t("Search name, role, or phone...")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-10 bg-white border-[#E2E8F0]" />
        </div>
        <ViewToggle mode={viewMode} onChange={setViewMode} />
      </div>

      {isLoading && <div className="text-center py-8 text-[#64748B]">{t("Loading directory...")}</div>}

      {!isLoading && viewMode === "table" && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Name")}</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Role")}</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Phone")}</th>
                  <th className="w-10 py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {contacts.filter((c) => matchesQuery(search, [c.name, c.role, c.phone])).map((c) => (
                  <tr key={c.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]">
                    <td className="py-3 px-4 font-medium text-[#0F172A]">{c.name}</td>
                    <td className="py-3 px-4 text-[#64748B]">{c.role ?? "—"}</td>
                    <td className="py-3 px-4">
                      {c.phone ? <a href={`tel:${c.phone}`} className="text-[#0891B2] hover:underline">{c.phone}</a> : <span className="text-[#64748B]">—</span>}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button className="text-[#64748B] hover:text-[#DC2626]" onClick={() => handleDelete(c.id)}><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
                {contacts.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-[#64748B]">{t("No directory contacts yet")}</td></tr>}
                {contacts.length > 0 && !contacts.some((c) => matchesQuery(search, [c.name, c.role, c.phone])) && (
                  <tr><td colSpan={4} className="py-8 text-center text-[#64748B]">{t("No contacts match your search")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!isLoading && viewMode === "cards" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {contacts.filter((c) => matchesQuery(search, [c.name, c.role, c.phone])).map((c) => (
            <div key={c.id} className="bg-white rounded-xl p-4 border border-[#E2E8F0] shadow-sm flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#0891B2]/10 flex items-center justify-center shrink-0">
                <BookUser className="w-5 h-5 text-[#0891B2]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[#0F172A]">{c.name}</p>
                {c.role && <p className="text-xs text-[#64748B]">{c.role}</p>}
                {c.phone && (
                  <a href={`tel:${c.phone}`} className="text-sm text-[#0891B2] flex items-center gap-1.5 mt-1 hover:underline">
                    <Phone className="w-3.5 h-3.5" /> {c.phone}
                  </a>
                )}
              </div>
              <button className="text-[#64748B] hover:text-[#DC2626]" onClick={() => handleDelete(c.id)}>
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {contacts.length === 0 && (
            <div className="col-span-full text-center py-12 text-[#64748B]">{t("No directory contacts yet")}</div>
          )}
          {contacts.length > 0 && !contacts.some((c) => matchesQuery(search, [c.name, c.role, c.phone])) && (
            <div className="col-span-full text-center py-12 text-[#64748B]">{t("No contacts match your search")}</div>
          )}
        </div>
      )}
    </div>
  );
}
