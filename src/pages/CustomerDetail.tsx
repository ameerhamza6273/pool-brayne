import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback, useRef } from "react";
import {
  Phone, MessageSquare, Mail, ArrowLeft, MapPin,
  Wrench, FileText, Camera, Plus, Bell, CheckCircle2, Pencil, X, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { customersApi, type CustomerAttachment, type CustomerDetailBundle, type PreviousSale, type CustomerServiceForm } from "@/lib/api/customers";
import { reportsApi, type CustomerReminder } from "@/lib/api/reports";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { formatPhoneInput } from "@/lib/phone";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import type { Database } from "@/lib/database.types";

type Customer = Database["public"]["Tables"]["customers"]["Row"];
type ServiceHistory = Database["public"]["Tables"]["job_service_history"]["Row"];
type CustomerNote = Database["public"]["Tables"]["customer_notes"]["Row"];
type Invoice = Database["public"]["Tables"]["invoices"]["Row"];

const tagColors: Record<string, string> = {
  Residential: "bg-[#0891B2]/10 text-[#0891B2]",
  Commercial: "bg-[#F59E0B]/10 text-[#F59E0B]",
  VIP: "bg-[#16A34A]/10 text-[#16A34A]",
  Lapsed: "bg-[#DC2626]/10 text-[#DC2626]",
  Seasonal: "bg-[#8B5CF6]/10 text-[#8B5CF6]",
};

const statusColors: Record<string, string> = {
  Completed: "bg-[#16A34A]/10 text-[#16A34A]",
  Paid: "bg-[#16A34A]/10 text-[#16A34A]",
  Sent: "bg-[#0891B2]/10 text-[#0891B2]",
  Draft: "bg-[#F59E0B]/10 text-[#F59E0B]",
  Overdue: "bg-[#DC2626]/10 text-[#DC2626]",
};

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, tenantId } = useAuth();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [history, setHistory] = useState<ServiceHistory[]>([]);
  const [notes, setNotes] = useState<CustomerNote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [photos, setPhotos] = useState<CustomerAttachment[]>([]);
  const [household, setHousehold] = useState<CustomerDetailBundle["household"]>([]);
  const [previousSales, setPreviousSales] = useState<PreviousSale[]>([]);
  const [photoDragOver, setPhotoDragOver] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [reminderDraft, setReminderDraft] = useState({ nextReminderDate: "", frequencyMonths: "" });
  const [qboSyncing, setQboSyncing] = useState(false);
  const [qboError, setQboError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Client bug report 2026-09-02: no way to edit the customer profile, add Other Contacts, or
  // edit Equipment on File — all three are now real (Gate Codes below were rendered but never
  // wired up to save at all, that's fixed here too).
  const [editOpen, setEditOpen] = useState(false);
  const [editDraft, setEditDraft] = useState({ firstName: "", lastName: "", type: "Residential", phone: "", email: "", address: "", pump: "", heater: "", filter: "", salt: "" });
  const [gateDraft, setGateDraft] = useState({ frontGate: "", houseGate: "", padlock: "", subdivisionEntrance: "none", notes: "" });
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [contactDraft, setContactDraft] = useState({ firstName: "", lastName: "", phone: "", email: "" });

  // Client request 2026-09-03: "Add plus icon to add more service reminders in the customer
  // profile" -- reuses the same customer_reminders system already built for the Reports page,
  // just surfaced directly here so staff don't have to leave the customer to add one.
  const [reminders, setReminders] = useState<CustomerReminder[]>([]);
  const [reminderTypeOpen, setReminderTypeOpen] = useState(false);
  const [reminderTypeDraft, setReminderTypeDraft] = useState({ label: "", frequencyMonths: "", nextDue: "" });

  // Client PDF 2026-09-06: "view all forms from previous jobs or maintenance jobs".
  const [serviceForms, setServiceForms] = useState<CustomerServiceForm[]>([]);

  const load = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const bundle = await customersApi.detail(id);
      setCustomer(bundle.customer);
      setReminderDraft({
        nextReminderDate: bundle.customer.next_reminder_date ?? "",
        frequencyMonths: bundle.customer.reminder_frequency_months ? String(bundle.customer.reminder_frequency_months) : "",
      });
      setHistory(bundle.history);
      setNotes(bundle.notes);
      setInvoices(bundle.invoices);
      setHousehold(bundle.household);
      setPreviousSales(bundle.previousSales);
      const allReminders = await reportsApi.reminders();
      setReminders(allReminders.filter((r) => r.customer_id === id));
      const eq = (bundle.customer.equipment ?? {}) as Record<string, string>;
      const gc = (bundle.customer.gate_codes ?? {}) as Record<string, string>;
      const [fallbackFirst, ...fallbackRest] = bundle.customer.name.split(" ");
      setEditDraft({
        firstName: bundle.customer.first_name ?? fallbackFirst ?? "",
        lastName: bundle.customer.last_name ?? fallbackRest.join(" "),
        type: bundle.customer.type,
        phone: bundle.customer.phone ?? "",
        email: bundle.customer.email ?? "",
        address: bundle.customer.address ?? "",
        pump: eq.pump ?? "",
        heater: eq.heater ?? "",
        filter: eq.filter ?? "",
        salt: eq.salt ?? "",
      });
      setGateDraft({
        frontGate: gc.frontGate ?? "",
        houseGate: gc.houseGate ?? "",
        padlock: gc.padlock ?? "",
        subdivisionEntrance: gc.subdivisionEntrance ?? "none",
        notes: gc.notes ?? "",
      });
      const attachments = await customersApi.getAttachments(id);
      setPhotos(attachments);
      setServiceForms(await customersApi.getForms(id));
    } catch {
      setCustomer(null);
    }
    setIsLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const uploadPhotos = async (files: FileList | File[]) => {
    if (!id) return;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      const path = `${tenantId}/${id}/photo-${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("customer-attachments").upload(path, file);
      if (error) continue;
      const { data } = supabase.storage.from("customer-attachments").getPublicUrl(path);
      const attachment = await customersApi.addAttachment(id, data.publicUrl);
      setPhotos((prev) => [...prev, attachment]);
    }
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    await uploadPhotos(e.target.files);
    e.target.value = "";
  };

  const handlePhotoDrop = async (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setPhotoDragOver(false);
    if (e.dataTransfer.files) await uploadPhotos(e.dataTransfer.files);
  };

  const handleAddNote = async () => {
    if (!id || !newNote.trim()) return;
    await customersApi.addNote(id, { text: newNote.trim(), author: user?.name ?? "You" });
    setNewNote("");
    load();
  };

  // Client request 2026-08-28: periodic service reminder (repeat jobs 2-3x/year, e.g. "next
  // service due in 4 months"), so office staff can see who's coming due without a separate
  // notification/SMS channel — nothing sends automatically since none is wired up yet.
  const handleSaveReminder = async () => {
    if (!id) return;
    await customersApi.updateReminder(
      id,
      reminderDraft.nextReminderDate || null,
      reminderDraft.frequencyMonths ? parseInt(reminderDraft.frequencyMonths, 10) : null,
    );
    load();
  };

  const handleMarkServiced = async () => {
    if (!id || !reminderDraft.frequencyMonths) return;
    const next = new Date();
    next.setMonth(next.getMonth() + parseInt(reminderDraft.frequencyMonths, 10));
    const nextDate = next.toISOString().slice(0, 10);
    await customersApi.updateReminder(id, nextDate, parseInt(reminderDraft.frequencyMonths, 10));
    setReminderDraft((p) => ({ ...p, nextReminderDate: nextDate }));
    load();
  };

  const handleAddReminderType = async () => {
    if (!id || !reminderTypeDraft.label || !reminderTypeDraft.frequencyMonths || !reminderTypeDraft.nextDue) return;
    await reportsApi.addReminder({
      customerId: id,
      label: reminderTypeDraft.label,
      frequencyMonths: parseInt(reminderTypeDraft.frequencyMonths, 10),
      nextDue: reminderTypeDraft.nextDue,
    });
    setReminderTypeDraft({ label: "", frequencyMonths: "", nextDue: "" });
    setReminderTypeOpen(false);
    load();
  };

  const handleMarkReminderDone = async (reminderId: string) => {
    await reportsApi.markReminderDone(reminderId);
    load();
  };

  const handleDeleteReminder = async (reminderId: string) => {
    await reportsApi.deleteReminder(reminderId);
    load();
  };

  const handleSyncToQuickbooks = async () => {
    if (!id) return;
    setQboSyncing(true);
    setQboError(null);
    try {
      await customersApi.syncToQuickbooks(id);
      await load();
    } catch (err) {
      setQboError(err instanceof Error ? err.message : "QuickBooks sync failed");
    }
    setQboSyncing(false);
  };

  const handleSaveEdit = async () => {
    if (!id) return;
    await customersApi.update(id, {
      firstName: editDraft.firstName,
      lastName: editDraft.lastName,
      type: editDraft.type,
      phone: editDraft.phone || null,
      email: editDraft.email || null,
      address: editDraft.address || null,
      equipment: { pump: editDraft.pump, heater: editDraft.heater, filter: editDraft.filter, salt: editDraft.salt },
    });
    setEditOpen(false);
    load();
  };

  const handleSaveGateCodes = async () => {
    if (!id) return;
    await customersApi.update(id, { gateCodes: { ...gateDraft } });
  };

  const handleAddContact = async () => {
    if (!id || !contactDraft.firstName || !contactDraft.lastName) return;
    await customersApi.addHouseholdMember(id, {
      firstName: contactDraft.firstName,
      lastName: contactDraft.lastName,
      phone: contactDraft.phone || null,
      email: contactDraft.email || null,
    });
    setContactDraft({ firstName: "", lastName: "", phone: "", email: "" });
    setAddContactOpen(false);
    load();
  };

  const handleDeletePhoto = async (attachmentId: string, url: string) => {
    if (!id) return;
    const marker = "/customer-attachments/";
    const idx = url.indexOf(marker);
    if (idx !== -1) {
      const path = url.slice(idx + marker.length);
      await supabase.storage.from("customer-attachments").remove([path]);
    }
    await customersApi.deleteAttachment(id, attachmentId);
    setPhotos((prev) => prev.filter((p) => p.id !== attachmentId));
  };

  if (isLoading) {
    return <div className="text-center py-20 text-[#64748B]">Loading customer...</div>;
  }

  if (!customer) {
    return (
      <div className="text-center py-20">
        <p className="text-[#64748B]">Customer not found</p>
        <Button onClick={() => navigate("/customers")} className="mt-4 bg-[#0891B2] text-white">Back to Customers</Button>
      </div>
    );
  }

  const initials = customer.name.split(" ").map((n) => n[0]).join("").slice(0, 2);
  const equipment = (customer.equipment ?? {}) as Record<string, string>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/customers")} className="p-2 rounded-lg hover:bg-[#F8FAFC] text-[#64748B]">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <h1 className="text-xl font-bold text-[#0F172A]">{customer.name}</h1>
            <div className="flex gap-1">
              {customer.tags.map((tag) => (
                <Badge key={tag} className={`${tagColors[tag] || ""} text-[10px] px-1.5 py-0`}>{tag}</Badge>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 h-9 border-[#E2E8F0] text-[#0F172A]" onClick={() => setEditOpen(true)}>
            <Pencil className="w-4 h-4" />
            <span className="hidden sm:inline">Edit</span>
          </Button>
          <Button
            size="sm"
            className="bg-[#0891B2] hover:bg-[#0E7490] text-white gap-1.5 h-9"
            disabled={!customer.phone}
            onClick={() => customer.phone && (window.location.href = `tel:${customer.phone}`)}
          >
            <Phone className="w-4 h-4" />
            <span className="hidden sm:inline">Call</span>
          </Button>
          <Button
            size="sm"
            className="bg-[#0891B2] hover:bg-[#0E7490] text-white gap-1.5 h-9"
            disabled={!customer.phone}
            onClick={() => customer.phone && (window.location.href = `sms:${customer.phone}`)}
          >
            <MessageSquare className="w-4 h-4" />
            <span className="hidden sm:inline">Text</span>
          </Button>
          <Button
            size="sm"
            className="bg-[#0891B2] hover:bg-[#0E7490] text-white gap-1.5 h-9"
            disabled={!customer.email}
            onClick={() => customer.email && (window.location.href = `mailto:${customer.email}`)}
          >
            <Mail className="w-4 h-4" />
            <span className="hidden sm:inline">Email</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 h-9 border-[#E2E8F0] text-[#0F172A]"
            onClick={handleSyncToQuickbooks}
            disabled={qboSyncing || !!customer.qbo_customer_id}
          >
            {customer.qbo_customer_id ? "Synced to QuickBooks" : qboSyncing ? "Syncing..." : "Sync to QuickBooks"}
          </Button>
        </div>
      </div>
      {qboError && <div className="text-xs text-red-600">{qboError}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column */}
        <div className="space-y-4">
          {/* Contact Info */}
          <Card className="border-[#E2E8F0] shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-[#0F172A]">Contact Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="flex items-center gap-3">
                <Avatar className="w-14 h-14">
                  <AvatarFallback className="bg-[#0891B2] text-white text-lg font-semibold">{initials}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-[#0F172A]">{customer.name}</p>
                  <p className="text-sm text-[#64748B]">{customer.type}</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-[#64748B]">
                  <Phone className="w-4 h-4 shrink-0 text-[#0891B2]" />
                  <span>{customer.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-[#64748B]">
                  <Mail className="w-4 h-4 shrink-0 text-[#0891B2]" />
                  <span className="truncate">{customer.email}</span>
                </div>
                <div className="flex items-start gap-2 text-[#64748B]">
                  <MapPin className="w-4 h-4 shrink-0 text-[#0891B2] mt-0.5" />
                  <span>{customer.address}</span>
                </div>
              </div>
              {/* Map placeholder */}
              <div className="h-32 rounded-lg bg-[#F1F5F9] flex items-center justify-center">
                <div className="text-center">
                  <MapPin className="w-6 h-6 text-[#0891B2] mx-auto mb-1" />
                  <p className="text-xs text-[#64748B]">Map view</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Other Contacts at the same address (client 2026-09-02: renamed from "Also at This
              Address", positioned above Service Reminder, and now supports adding a contact). */}
          <Card className="border-[#E2E8F0] shadow-sm">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold text-[#0F172A]">Other Contacts</CardTitle>
              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs border-[#E2E8F0]" onClick={() => setAddContactOpen(true)}>
                <Plus className="w-3.5 h-3.5" /> Add
              </Button>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {household.map((h) => (
                <button
                  key={h.id}
                  className="w-full text-left p-2.5 rounded-lg bg-[#F8FAFC] hover:bg-[#F1F5F9] flex items-center justify-between"
                  onClick={() => navigate(`/customers/${h.id}`)}
                >
                  <div>
                    <p className="text-sm font-medium text-[#0F172A]">{h.name}</p>
                    <p className="text-xs text-[#64748B]">{h.phone || h.email || ""}</p>
                  </div>
                </button>
              ))}
              {household.length === 0 && (
                <p className="text-sm text-[#64748B] py-1">No other contacts at this address yet.</p>
              )}
            </CardContent>
          </Card>

          {/* Periodic Service Reminder */}
          <Card className="border-[#E2E8F0] shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-[#0F172A] flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#0891B2]" /> Service Reminder
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-[#64748B] uppercase mb-1">Next Due</p>
                  <Input
                    type="date"
                    className="h-9 text-sm"
                    value={reminderDraft.nextReminderDate}
                    onChange={(e) => setReminderDraft((p) => ({ ...p, nextReminderDate: e.target.value }))}
                  />
                </div>
                <div>
                  <p className="text-xs text-[#64748B] uppercase mb-1">Repeat (months)</p>
                  <Input
                    type="number"
                    placeholder="e.g. 4"
                    className="h-9 text-sm"
                    value={reminderDraft.frequencyMonths}
                    onChange={(e) => setReminderDraft((p) => ({ ...p, frequencyMonths: e.target.value }))}
                  />
                </div>
              </div>
              {customer.next_reminder_date && new Date(customer.next_reminder_date) <= new Date() && (
                <p className="text-xs font-medium text-[#DC2626]">Due now — service is overdue.</p>
              )}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1 h-8 border-[#E2E8F0]" onClick={handleSaveReminder}>Save</Button>
                <Button size="sm" className="flex-1 h-8 bg-[#16A34A] hover:bg-[#15803D] text-white gap-1.5" onClick={handleMarkServiced} disabled={!reminderDraft.frequencyMonths}>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Mark Serviced
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Client request 2026-09-03: "Add plus icon to add more service reminders" — several
              named reminder types per customer (Filter Cleaning every 4mo, Salt Cell every 6mo,
              etc.), distinct from the single reminder above. */}
          <Card className="border-[#E2E8F0] shadow-sm">
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-semibold text-[#0F172A] flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#0891B2]" /> Other Reminders
              </CardTitle>
              <Button size="icon" variant="outline" className="h-7 w-7 border-[#E2E8F0]" onClick={() => setReminderTypeOpen(true)}>
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {reminders.length === 0 && <p className="text-xs text-[#64748B]">No additional reminders yet.</p>}
              {reminders.map((r) => {
                const overdue = new Date(r.next_due) <= new Date();
                return (
                  <div key={r.id} className="flex items-center justify-between rounded-lg border border-[#F1F5F9] px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-[#0F172A]">{r.label}</p>
                      <p className={`text-xs ${overdue ? "text-[#DC2626] font-medium" : "text-[#64748B]"}`}>
                        Due {r.next_due} · every {r.frequency_months}mo{overdue ? " · overdue" : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleMarkReminderDone(r.id)}>
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDeleteReminder(r.id)}>
                        <Trash2 className="w-3.5 h-3.5 text-[#DC2626]" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Client PDF 2026-09-06: "add a button to view all forms from previous jobs or
              maintenance jobs (water testing and check list for maintenance with notes)". */}
          <Card className="border-[#E2E8F0] shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-[#0F172A] flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#0891B2]" /> Service Forms
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {serviceForms.length === 0 && <p className="text-xs text-[#64748B]">No forms submitted yet.</p>}
              {serviceForms.map((f) => (
                <button
                  key={f.id}
                  onClick={() => navigate(`/jobs/${f.job_id}`)}
                  className="w-full text-left rounded-lg border border-[#F1F5F9] px-3 py-2 hover:bg-[#F8FAFC]"
                >
                  <p className="text-sm font-medium text-[#0F172A]">{f.template_name ?? f.type}</p>
                  <p className="text-xs text-[#64748B]">{f.job_type ?? "Job"} · {new Date(f.submitted_at).toLocaleDateString()}</p>
                </button>
              ))}
            </CardContent>
          </Card>

          <Dialog open={reminderTypeOpen} onOpenChange={setReminderTypeOpen}>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Add Reminder Type</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div><Label>Label</Label><Input className="mt-1" placeholder="e.g. Filter Cleaning" value={reminderTypeDraft.label} onChange={(e) => setReminderTypeDraft((p) => ({ ...p, label: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Frequency (months)</Label><Input type="number" className="mt-1" placeholder="e.g. 4" value={reminderTypeDraft.frequencyMonths} onChange={(e) => setReminderTypeDraft((p) => ({ ...p, frequencyMonths: e.target.value }))} /></div>
                  <div><Label>Next Due</Label><Input type="date" className="mt-1" value={reminderTypeDraft.nextDue} onChange={(e) => setReminderTypeDraft((p) => ({ ...p, nextDue: e.target.value }))} /></div>
                </div>
                <Button className="w-full bg-[#0891B2] text-white" onClick={handleAddReminderType}>Save</Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Equipment on File (client bug report 2026-09-02: now editable via the header Edit
              button) */}
          <Card className="border-[#E2E8F0] shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-[#0F172A]">Equipment on File</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-[#64748B] uppercase">Pump</p>
                  <p className="font-medium text-[#0F172A]">{equipment.pump || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-[#64748B] uppercase">Heater</p>
                  <p className="font-medium text-[#0F172A]">{equipment.heater || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-[#64748B] uppercase">Filter</p>
                  <p className="font-medium text-[#0F172A]">{equipment.filter || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-[#64748B] uppercase">Salt System</p>
                  <p className="font-medium text-[#0F172A]">{equipment.salt || "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Gate Codes / Access Info */}
          <Card className="border-[#E2E8F0] shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-[#0F172A]">Gate Codes & Access</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-[#64748B] uppercase mb-1">Front Gate Code</p>
                  <Input placeholder="e.g. #1234" className="h-9 text-sm" value={gateDraft.frontGate} onChange={(e) => setGateDraft((p) => ({ ...p, frontGate: e.target.value }))} />
                </div>
                <div>
                  <p className="text-xs text-[#64748B] uppercase mb-1">House Gate Code</p>
                  <Input placeholder="e.g. #5678" className="h-9 text-sm" value={gateDraft.houseGate} onChange={(e) => setGateDraft((p) => ({ ...p, houseGate: e.target.value }))} />
                </div>
                <div>
                  <p className="text-xs text-[#64748B] uppercase mb-1">Padlock Code</p>
                  <Input placeholder="e.g. 0000" className="h-9 text-sm" value={gateDraft.padlock} onChange={(e) => setGateDraft((p) => ({ ...p, padlock: e.target.value }))} />
                </div>
                <div>
                  <p className="text-xs text-[#64748B] uppercase mb-1">Gated Subdivision Entrance</p>
                  <Select value={gateDraft.subdivisionEntrance} onValueChange={(v) => setGateDraft((p) => ({ ...p, subdivisionEntrance: v }))}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No gated subdivision</SelectItem>
                      <SelectItem value="call">Call box at entrance</SelectItem>
                      <SelectItem value="code">Keypad code at entrance</SelectItem>
                      <SelectItem value="remote">Remote / transponder</SelectItem>
                      <SelectItem value="guard">Guard / attendant</SelectItem>
                      <SelectItem value="open">Open access (no code needed)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <p className="text-xs text-[#64748B] uppercase mb-1">Access Notes</p>
                <Textarea placeholder="e.g. Dog in backyard, key under mat, etc." className="text-sm" rows={2} value={gateDraft.notes} onChange={(e) => setGateDraft((p) => ({ ...p, notes: e.target.value }))} />
              </div>
              <Button size="sm" variant="outline" className="w-full h-8 border-[#E2E8F0]" onClick={handleSaveGateCodes}>Save Access Info</Button>
            </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-2">
          <Tabs defaultValue="history" className="w-full">
            <TabsList className="bg-white border border-[#E2E8F0] w-full justify-start h-10 p-1 rounded-lg mb-4">
              <TabsTrigger value="history" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4">Service History</TabsTrigger>
              <TabsTrigger value="notes" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4">Notes</TabsTrigger>
              <TabsTrigger value="invoices" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4">Invoices</TabsTrigger>
              <TabsTrigger value="previous-sales" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4">Previous Sales</TabsTrigger>
            </TabsList>

            <TabsContent value="history" className="mt-0">
              <Card className="border-[#E2E8F0] shadow-sm">
                <CardContent className="p-0">
                  <div className="divide-y divide-[#F1F5F9]">
                    {history.map((h) => (
                      <div key={h.id} className="p-4 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-[#0891B2]/10 flex items-center justify-center shrink-0">
                          <Wrench className="w-5 h-5 text-[#0891B2]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-[#0F172A]">{h.type}</p>
                            <Badge className={`${statusColors[h.status] || ""} text-[10px] px-1.5 py-0`}>{h.status}</Badge>
                          </div>
                          <p className="text-sm text-[#64748B]">{h.service_date} &middot; {h.tech}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-semibold text-[#0F172A]">${h.amount}</p>
                        </div>
                      </div>
                    ))}
                    {history.length === 0 && (
                      <div className="p-8 text-center text-[#64748B]">No service history yet</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notes" className="mt-0">
              <Card className="border-[#E2E8F0] shadow-sm">
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <Input placeholder="Add a note..." className="flex-1" value={newNote} onChange={(e) => setNewNote(e.target.value)} />
                    <Button size="sm" className="bg-[#0891B2] text-white gap-1" onClick={handleAddNote}>
                      <Plus className="w-4 h-4" /> Add
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {notes.map((n) => (
                      <div key={n.id} className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                        <p className="text-sm text-[#0F172A]">{n.text}</p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-[#64748B]">
                          <span className="font-medium">{n.author}</span>
                          <span>&middot;</span>
                          <span>{n.created_at}</span>
                        </div>
                      </div>
                    ))}
                    {notes.length === 0 && (
                      <p className="text-center text-[#64748B] py-4">No notes yet</p>
                    )}
                  </div>
                  {/* Photos */}
                  <div>
                    <p className="text-sm font-medium text-[#0F172A] mb-2 flex items-center gap-2">
                      <Camera className="w-4 h-4" /> Photos
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handlePhotoSelect}
                    />
                    <div className="grid grid-cols-4 gap-2">
                      {photos.map((photo) => (
                        <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden bg-[#F1F5F9] group">
                          <img src={photo.url} alt="Customer" className="w-full h-full object-cover" />
                          <button
                            onClick={() => handleDeletePhoto(photo.id, photo.url)}
                            className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Delete photo"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => { e.preventDefault(); setPhotoDragOver(true); }}
                        onDragLeave={() => setPhotoDragOver(false)}
                        onDrop={handlePhotoDrop}
                        className={`aspect-square rounded-lg border border-dashed flex items-center justify-center cursor-pointer transition-colors ${
                          photoDragOver ? "bg-[#0891B2]/10 border-[#0891B2]" : "bg-[#F1F5F9] border-[#E2E8F0] hover:bg-[#E2E8F0]"
                        }`}
                      >
                        <Plus className={`w-5 h-5 ${photoDragOver ? "text-[#0891B2]" : "text-[#64748B]"}`} />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="invoices" className="mt-0">
              <Card className="border-[#E2E8F0] shadow-sm">
                <CardContent className="p-0">
                  <div className="divide-y divide-[#F1F5F9]">
                    {invoices.map((inv) => (
                      <div key={inv.id} className="p-4 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-[#F1F5F9] flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5 text-[#0891B2]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-[#0F172A]">{inv.number}</p>
                            <Badge className={`${statusColors[inv.status] || ""} text-[10px] px-1.5 py-0`}>{inv.status}</Badge>
                          </div>
                          <p className="text-sm text-[#64748B]">Issued: {inv.issue_date}</p>
                          {inv.job_description && <p className="text-xs text-[#64748B] mt-0.5 truncate">{inv.job_description}</p>}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-semibold text-[#0F172A]">${inv.amount}</p>
                        </div>
                      </div>
                    ))}
                    {invoices.length === 0 && (
                      <div className="p-8 text-center text-[#64748B]">No invoices yet</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="previous-sales" className="mt-0">
              <Card className="border-[#E2E8F0] shadow-sm">
                <CardContent className="p-0">
                  <div className="divide-y divide-[#F1F5F9]">
                    {previousSales.map((sale) => (
                      <div key={sale.id} className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-10 h-10 rounded-lg bg-[#F1F5F9] flex items-center justify-center shrink-0">
                              <FileText className="w-4 h-4 text-[#0891B2]" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-[#0F172A]">{new Date(sale.created_at).toLocaleDateString()}</p>
                              <p className="text-xs text-[#64748B]">{sale.payment_method || "In-store sale"}</p>
                            </div>
                          </div>
                          <p className="font-semibold text-[#0F172A]">${sale.total}</p>
                        </div>
                        <div className="pl-12 space-y-1">
                          {sale.items.map((item) => (
                            <div key={item.id} className="flex items-center justify-between text-xs text-[#64748B]">
                              <span>{item.quantity} &times; {item.description}</span>
                              <span>${item.amount}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    {previousSales.length === 0 && (
                      <div className="p-8 text-center text-[#64748B]">No previous in-store sales yet</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Right Rail Summary - desktop */}
      <div className="lg:hidden mt-4">
        <Card className="border-[#E2E8F0] shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-[#0F172A]">Customer Summary</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-[#64748B] uppercase">Lifetime Value</p>
                <p className="text-lg font-bold text-[#0F172A]">${customer.lifetime_value.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-[#64748B] uppercase">Total Jobs</p>
                <p className="text-lg font-bold text-[#0F172A]">{history.length}</p>
              </div>
              <div>
                <p className="text-xs text-[#64748B] uppercase">Customer Since</p>
                <p className="text-sm font-medium text-[#0F172A]">{customer.customer_since}</p>
              </div>
              <div>
                <p className="text-xs text-[#64748B] uppercase">Last Contact</p>
                <p className="text-sm font-medium text-[#0F172A]">{customer.last_contact}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit Customer (client bug report 2026-09-02: previously no way to edit anything) */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Customer</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>First Name</Label><Input className="mt-1" value={editDraft.firstName} onChange={(e) => setEditDraft((p) => ({ ...p, firstName: e.target.value }))} /></div>
              <div><Label>Last Name</Label><Input className="mt-1" value={editDraft.lastName} onChange={(e) => setEditDraft((p) => ({ ...p, lastName: e.target.value }))} /></div>
            </div>
            <div>
              <Label>Type</Label>
              <Select value={editDraft.type} onValueChange={(v) => setEditDraft((p) => ({ ...p, type: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Residential">Residential</SelectItem>
                  <SelectItem value="Commercial">Commercial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Phone</Label><Input className="mt-1" value={editDraft.phone} onChange={(e) => setEditDraft((p) => ({ ...p, phone: formatPhoneInput(e.target.value) }))} /></div>
              <div><Label>Email</Label><Input className="mt-1" value={editDraft.email} onChange={(e) => setEditDraft((p) => ({ ...p, email: e.target.value }))} /></div>
            </div>
            <div>
              <Label>Address</Label>
              <AddressAutocomplete className="mt-1" value={editDraft.address} onChange={(address) => setEditDraft((p) => ({ ...p, address }))} />
            </div>
            <div>
              <p className="text-sm font-medium text-[#0F172A] mb-2">Equipment on File</p>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Pump</Label><Input className="mt-1 h-9" value={editDraft.pump} onChange={(e) => setEditDraft((p) => ({ ...p, pump: e.target.value }))} /></div>
                <div><Label className="text-xs">Heater</Label><Input className="mt-1 h-9" value={editDraft.heater} onChange={(e) => setEditDraft((p) => ({ ...p, heater: e.target.value }))} /></div>
                <div><Label className="text-xs">Filter</Label><Input className="mt-1 h-9" value={editDraft.filter} onChange={(e) => setEditDraft((p) => ({ ...p, filter: e.target.value }))} /></div>
                <div><Label className="text-xs">Salt System</Label><Input className="mt-1 h-9" value={editDraft.salt} onChange={(e) => setEditDraft((p) => ({ ...p, salt: e.target.value }))} /></div>
              </div>
            </div>
            <Button className="w-full bg-[#0891B2] text-white" onClick={handleSaveEdit}>Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Other Contact (client bug report 2026-09-02) */}
      <Dialog open={addContactOpen} onOpenChange={setAddContactOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add Other Contact</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>First Name</Label><Input className="mt-1" value={contactDraft.firstName} onChange={(e) => setContactDraft((p) => ({ ...p, firstName: e.target.value }))} /></div>
              <div><Label>Last Name</Label><Input className="mt-1" value={contactDraft.lastName} onChange={(e) => setContactDraft((p) => ({ ...p, lastName: e.target.value }))} /></div>
            </div>
            <div><Label>Phone</Label><Input className="mt-1" value={contactDraft.phone} onChange={(e) => setContactDraft((p) => ({ ...p, phone: formatPhoneInput(e.target.value) }))} /></div>
            <div><Label>Email</Label><Input className="mt-1" value={contactDraft.email} onChange={(e) => setContactDraft((p) => ({ ...p, email: e.target.value }))} /></div>
            <p className="text-xs text-[#64748B]">Shares this property's address with {customer.name}.</p>
            <Button className="w-full bg-[#0891B2] text-white" onClick={handleAddContact}>Save Contact</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
