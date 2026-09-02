import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Phone, BookUser } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { directoryApi, type DirectoryContact } from "@/lib/api/directory";
import { formatPhoneInput } from "@/lib/phone";

// Client request 2026-09-02: a field Directory of sales-rep names/phone numbers for techs to
// look up on the road.
export default function Directory() {
  const [contacts, setContacts] = useState<DirectoryContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
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
          <h1 className="text-2xl font-bold text-[#0F172A]">Directory</h1>
          <p className="text-sm text-[#64748B] mt-0.5">Sales rep contacts for techs to use in the field.</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#0891B2] hover:bg-[#0E7490] text-white gap-2 h-10"><Plus className="w-4 h-4" /> Add Contact</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Directory Contact</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div><Label>Name</Label><Input className="mt-1" value={newContact.name} onChange={(e) => setNewContact((p) => ({ ...p, name: e.target.value }))} /></div>
              <div><Label>Role</Label><Input className="mt-1" placeholder="e.g. Sales Rep" value={newContact.role} onChange={(e) => setNewContact((p) => ({ ...p, role: e.target.value }))} /></div>
              <div><Label>Phone</Label><Input className="mt-1" value={newContact.phone} onChange={(e) => setNewContact((p) => ({ ...p, phone: formatPhoneInput(e.target.value) }))} /></div>
              <Button className="w-full bg-[#0891B2] text-white" onClick={handleAdd}>Save Contact</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading && <div className="text-center py-8 text-[#64748B]">Loading directory...</div>}

      {!isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {contacts.map((c) => (
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
            <div className="col-span-full text-center py-12 text-[#64748B]">No directory contacts yet</div>
          )}
        </div>
      )}
    </div>
  );
}
