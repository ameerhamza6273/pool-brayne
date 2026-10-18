import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState, useCallback, useRef } from "react";
import {
  Phone, MessageSquare, Mail, ArrowLeft, MapPin,
  Wrench, FileText, Camera, Plus, Bell, CheckCircle2, Pencil, X, Trash2, Printer, ExternalLink,
} from "lucide-react";
import ReceiptDialog from "@/components/ReceiptDialog";
import InvoicePreviewDialog from "@/components/InvoicePreviewDialog";
import FormSubmissionView from "@/components/FormSubmissionView";
import { formTemplatesApi, type FormTemplate } from "@/lib/api/formTemplates";
import type { JobForm } from "@/lib/api/jobs";
import { receiptNumber } from "@/lib/api/pos";
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
import { jobStatusDisplayLabel } from "@/lib/data";
import { reportsApi, type CustomerReminder } from "@/lib/api/reports";
import ReminderLabelSelect from "@/components/ReminderLabelSelect";
import { supabase } from "@/lib/supabase";
import { useAuth, isFieldOnlyRole } from "@/lib/auth-context";
import { formatPhoneInput } from "@/lib/phone";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { geocodeAddress, geocodeApproximate } from "@/lib/geocode";
import { useLanguage } from "@/lib/language-context";
import type { Database } from "@/lib/database.types";
import { useConfirm } from "@/components/ConfirmDialog";

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
  // Client SMS 2026-10-15: "need to link to customer invoices from the accounts outstanding
  // report" -- lets a link open straight to this tab instead of always landing on Service History.
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") ?? "history";
  const { user, tenantId, role } = useAuth();
  // Client video 2026-10-15: a technician granted "Customer Lookup" (Settings > Team) can look up a
  // customer's history, notes, invoices, photos and add notes/photos, but not edit or delete the
  // record itself, and links into pages a field login can't open (jobs, full invoice) are hidden.
  const readOnly = isFieldOnlyRole(role);
  const { t } = useLanguage();
  const confirm = useConfirm();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [history, setHistory] = useState<ServiceHistory[]>([]);
  const [notes, setNotes] = useState<CustomerNote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [photos, setPhotos] = useState<CustomerAttachment[]>([]);
  const [household, setHousehold] = useState<CustomerDetailBundle["household"]>([]);
  const [previousSales, setPreviousSales] = useState<PreviousSale[]>([]);
  // Client SMS 2026-09-25: click a previous sale -> receipt (notes, print / re-print).
  const [openSaleId, setOpenSaleId] = useState<string | null>(null);
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
  // Client report 2026-10-05: "Save Access Info button does not do anything" -- it actually saved
  // fine, it just gave zero feedback (no toast, no loading state), so a click looked like a no-op.
  const [savingGateCodes, setSavingGateCodes] = useState(false);
  const [gateCodesSavedAt, setGateCodesSavedAt] = useState<number | null>(null);
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [contactDraft, setContactDraft] = useState({ firstName: "", lastName: "", phone: "", email: "" });

  // Client request 2026-09-03: "Add plus icon to add more service reminders in the customer
  // profile" -- reuses the same customer_reminders system already built for the Reports page,
  // just surfaced directly here so staff don't have to leave the customer to add one.
  const [reminders, setReminders] = useState<CustomerReminder[]>([]);
  const [reminderTypeOpen, setReminderTypeOpen] = useState(false);
  const [reminderTypeDraft, setReminderTypeDraft] = useState({ label: "", frequencyMonths: "", nextDue: "" });
  // Client video 2026-10-06: "need to be a way to see or click on it here to see what this other
  // reminder is" -- the list only had Mark Done / Delete, no way to view or correct what was
  // actually saved. Clicking a row now reopens this same dialog pre-filled, editable.
  const [editingReminderId, setEditingReminderId] = useState<string | null>(null);

  // Client PDF 2026-09-06: "view all forms from previous jobs or maintenance jobs".
  const [serviceForms, setServiceForms] = useState<CustomerServiceForm[]>([]);
  // Client video 2026-10-15: past invoices and service forms open in a popup instead of
  // navigating away to the full invoice/job page.
  const [openInvoiceId, setOpenInvoiceId] = useState<string | null>(null);
  const [openForm, setOpenForm] = useState<CustomerServiceForm | null>(null);
  const [formTemplates, setFormTemplates] = useState<FormTemplate[] | null>(null);
  // Client video 2026-10-15: notes could be added but never edited or deleted.
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteText, setEditNoteText] = useState("");
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);

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

  // Client video 2026-10-16: "the map view section...we need [a real] map of the address" (it was
  // a static placeholder icon) + "when I try to click on the map...it does not load to a map, so I
  // can't get directions from my current location" -- real embedded map now, click opens Google
  // Maps directions (works from a phone's current location with no origin specified). Same
  // geocode-then-persist pattern Jobs.tsx's Map tab already uses.
  const [mapCoords, setMapCoords] = useState<{ lat: number; lng: number; approx: boolean } | null>(null);
  const [mapLoading, setMapLoading] = useState(false);
  useEffect(() => {
    if (!customer) { setMapCoords(null); return; }
    if (customer.lat != null && customer.lng != null) { setMapCoords({ lat: customer.lat, lng: customer.lng, approx: false }); return; }
    if (!customer.address) { setMapCoords(null); return; }
    let cancelled = false;
    setMapLoading(true);
    (async () => {
      const exact = await geocodeAddress(customer.address!);
      if (cancelled) return;
      if (exact) {
        setMapCoords({ ...exact, approx: false });
        customersApi.updateCoordinates(customer.id, exact.lat, exact.lng).catch(() => {});
      } else {
        const near = await geocodeApproximate(customer.address!);
        if (cancelled) return;
        setMapCoords(near ? { ...near, approx: true } : null);
      }
      setMapLoading(false);
    })();
    return () => { cancelled = true; };
  }, [customer?.id, customer?.address, customer?.lat, customer?.lng]);

  // Directions by address text (not the geocoded point) whenever the address exists: Google
  // resolves it more exactly than our free geocoder, and it's ready on a phone before any lookup.
  const mapsHref = customer?.address
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(customer.address)}`
    : mapCoords ? `https://www.google.com/maps/dir/?api=1&destination=${mapCoords.lat},${mapCoords.lng}` : undefined;

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
    if (editingReminderId) {
      await reportsApi.updateReminder(editingReminderId, {
        label: reminderTypeDraft.label,
        frequencyMonths: parseInt(reminderTypeDraft.frequencyMonths, 10),
        nextDue: reminderTypeDraft.nextDue,
      });
    } else {
      await reportsApi.addReminder({
        customerId: id,
        label: reminderTypeDraft.label,
        frequencyMonths: parseInt(reminderTypeDraft.frequencyMonths, 10),
        nextDue: reminderTypeDraft.nextDue,
      });
    }
    setReminderTypeDraft({ label: "", frequencyMonths: "", nextDue: "" });
    setEditingReminderId(null);
    setReminderTypeOpen(false);
    load();
  };

  const handleOpenReminderEdit = (r: CustomerReminder) => {
    setEditingReminderId(r.id);
    setReminderTypeDraft({ label: r.label, frequencyMonths: String(r.frequency_months), nextDue: r.next_due });
    setReminderTypeOpen(true);
  };

  const handleMarkReminderDone = async (reminderId: string) => {
    await reportsApi.markReminderDone(reminderId);
    load();
  };

  const handleDeleteReminder = async (reminderId: string) => {
    if (!(await confirm({ title: "Delete this reminder?", name: reminders.find((r) => r.id === reminderId)?.label }))) return;
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
      setQboError(err instanceof Error ? err.message : t("QuickBooks sync failed"));
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

  const updateGateDraft = (patch: Partial<typeof gateDraft>) => {
    setGateDraft((p) => ({ ...p, ...patch }));
    setGateCodesSavedAt(null);
  };

  const handleSaveGateCodes = async () => {
    if (!id) return;
    setSavingGateCodes(true);
    await customersApi.update(id, { gateCodes: { ...gateDraft } });
    setSavingGateCodes(false);
    setGateCodesSavedAt(Date.now());
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

  const handleSaveNoteEdit = async () => {
    if (!id || !editingNoteId || !editNoteText.trim()) return;
    const updated = await customersApi.updateNote(id, editingNoteId, editNoteText.trim());
    setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
    setEditingNoteId(null);
  };

  const handleDeleteNote = async () => {
    if (!id || !deleteNoteId) return;
    await customersApi.deleteNote(id, deleteNoteId);
    setNotes((prev) => prev.filter((n) => n.id !== deleteNoteId));
    setDeleteNoteId(null);
  };

  const openServiceForm = (f: CustomerServiceForm) => {
    setOpenForm(f);
    if (formTemplates === null) formTemplatesApi.list().then(setFormTemplates).catch(() => setFormTemplates([]));
  };

  const handleDeletePhoto = async (attachmentId: string, url: string) => {
    if (!(await confirm({ title: "Delete this photo?" }))) return;
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
    return <div className="text-center py-20 text-[#64748B]">{t("Loading customer...")}</div>;
  }

  if (!customer) {
    return (
      <div className="text-center py-20">
        <p className="text-[#64748B]">{t("Customer not found")}</p>
        <Button onClick={() => navigate("/customers")} className="mt-4 bg-[#0891B2] text-white">{t("Back to Customers")}</Button>
      </div>
    );
  }

  const initials = customer.name.split(" ").map((n) => n[0]).join("").slice(0, 2);
  const equipment = (customer.equipment ?? {}) as Record<string, string>;

  return (
    <div className="space-y-4">
      {/* Header -- client screenshot 2026-10-18 (phone): the action buttons ran off the right edge
          of the screen; they now wrap onto their own row under the name on narrow screens. */}
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => navigate("/customers")} className="p-2 rounded-lg hover:bg-[#F8FAFC] text-[#64748B]">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <h1 className="text-xl font-bold text-[#0F172A] break-words">{customer.name}</h1>
            <div className="flex gap-1">
              {customer.tags.map((tag) => (
                <Badge key={tag} className={`${tagColors[tag] || ""} text-[10px] px-1.5 py-0`}>{t(tag)}</Badge>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {!readOnly && (
            <Button size="sm" variant="outline" className="gap-1.5 h-9 border-[#E2E8F0] text-[#0F172A]" onClick={() => setEditOpen(true)}>
              <Pencil className="w-4 h-4" />
              <span className="hidden sm:inline">{t("Edit")}</span>
            </Button>
          )}
          {/* Client video 2026-10-06 (Dialpad): their Chrome CTI click-to-call extension detects
              real `tel:` links in the page, not JS button handlers -- a plain onClick with
              `window.location.href` was invisible to it even once their domain is whitelisted. */}
          {customer.phone ? (
            <Button asChild size="sm" className="bg-[#0891B2] hover:bg-[#0E7490] text-white gap-1.5 h-9">
              <a href={`tel:${customer.phone}`}>
                <Phone className="w-4 h-4" />
                <span className="hidden sm:inline">{t("Call")}</span>
              </a>
            </Button>
          ) : (
            <Button size="sm" className="bg-[#0891B2] hover:bg-[#0E7490] text-white gap-1.5 h-9" disabled>
              <Phone className="w-4 h-4" />
              <span className="hidden sm:inline">{t("Call")}</span>
            </Button>
          )}
          <Button
            size="sm"
            className="bg-[#0891B2] hover:bg-[#0E7490] text-white gap-1.5 h-9"
            disabled={!customer.phone}
            onClick={() => customer.phone && (window.location.href = `sms:${customer.phone}`)}
          >
            <MessageSquare className="w-4 h-4" />
            <span className="hidden sm:inline">{t("Text")}</span>
          </Button>
          <Button
            size="sm"
            className="bg-[#0891B2] hover:bg-[#0E7490] text-white gap-1.5 h-9"
            disabled={!customer.email}
            onClick={() => customer.email && (window.location.href = `mailto:${customer.email}`)}
          >
            <Mail className="w-4 h-4" />
            <span className="hidden sm:inline">{t("Email")}</span>
          </Button>
          {!readOnly && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 h-9 border-[#E2E8F0] text-[#0F172A]"
              onClick={handleSyncToQuickbooks}
              disabled={qboSyncing || !!customer.qbo_customer_id}
            >
              {customer.qbo_customer_id ? t("Synced to QuickBooks") : qboSyncing ? t("Syncing...") : t("Sync to QuickBooks")}
            </Button>
          )}
        </div>
      </div>
      {qboError && <div className="text-xs text-red-600">{qboError}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column */}
        <div className="space-y-4">
          {/* Contact Info */}
          <Card className="border-[#E2E8F0] shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-[#0F172A]">{t("Contact Info")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="flex items-center gap-3">
                <Avatar className="w-14 h-14">
                  <AvatarFallback className="bg-[#0891B2] text-white text-lg font-semibold">{initials}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-[#0F172A]">{customer.name}</p>
                  <p className="text-sm text-[#64748B]">{t(customer.type)}</p>
                </div>
              </div>
              <div className="space-y-2 text-sm min-w-0">
                <div className="flex items-center gap-2 text-[#64748B]">
                  <Phone className="w-4 h-4 shrink-0 text-[#0891B2]" />
                  <span>{customer.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-[#64748B]">
                  <Mail className="w-4 h-4 shrink-0 text-[#0891B2]" />
                  <span className="truncate">{customer.email}</span>
                </div>
                {/* Client video 2026-10-18 (phone): "when I try to click the little icon to the left
                    of the address, it doesn't take me there either" -- the pin + address now open
                    the same Google Maps directions as the map below. */}
                {mapsHref ? (
                  <a href={mapsHref} target="_blank" rel="noreferrer" className="flex items-start gap-2 text-[#64748B] hover:text-[#0891B2]">
                    <MapPin className="w-4 h-4 shrink-0 text-[#0891B2] mt-0.5" />
                    <span className="underline decoration-dotted underline-offset-2">{customer.address}</span>
                  </a>
                ) : (
                  <div className="flex items-start gap-2 text-[#64748B]">
                    <MapPin className="w-4 h-4 shrink-0 text-[#0891B2] mt-0.5" />
                    <span>{customer.address}</span>
                  </div>
                )}
              </div>
              <a
                href={mapsHref}
                target="_blank"
                rel="noreferrer"
                className={`relative h-32 rounded-lg bg-[#F1F5F9] overflow-hidden block ${!mapsHref ? "pointer-events-none" : ""}`}
                title={t("Get directions")}
              >
                {mapCoords ? (
                  <iframe
                    title="map"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${mapCoords.lng - 0.006}%2C${mapCoords.lat - 0.004}%2C${mapCoords.lng + 0.006}%2C${mapCoords.lat + 0.004}&layer=mapnik&marker=${mapCoords.lat}%2C${mapCoords.lng}`}
                    className="w-full h-full border-0 pointer-events-none"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center">
                      <MapPin className="w-6 h-6 text-[#0891B2] mx-auto mb-1" />
                      <p className="text-xs text-[#64748B]">{mapLoading ? t("Locating address...") : t("Map view")}</p>
                    </div>
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-black/55 text-white text-xs text-center py-1 flex items-center justify-center gap-1">
                  <MapPin className="w-3 h-3" /> {t("Get directions")}
                </div>
              </a>
            </CardContent>
          </Card>

          {/* Other Contacts at the same address (client 2026-09-02: renamed from "Also at This
              Address", positioned above Service Reminder, and now supports adding a contact). */}
          <Card className="border-[#E2E8F0] shadow-sm">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold text-[#0F172A]">{t("Other Contacts")}</CardTitle>
              {!readOnly && (
                <Button size="sm" variant="outline" className="h-7 gap-1 text-xs border-[#E2E8F0]" onClick={() => setAddContactOpen(true)}>
                  <Plus className="w-3.5 h-3.5" /> {t("Add")}
                </Button>
              )}
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
                <p className="text-sm text-[#64748B] py-1">{t("No other contacts at this address yet.")}</p>
              )}
            </CardContent>
          </Card>

          {/* Periodic Service Reminder */}
          <Card className="border-[#E2E8F0] shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-[#0F172A] flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#0891B2]" /> {t("Service Reminder")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-[#64748B] uppercase mb-1">{t("Next Due")}</p>
                  <Input
                    type="date"
                    className="h-9 text-sm"
                    value={reminderDraft.nextReminderDate}
                    onChange={(e) => setReminderDraft((p) => ({ ...p, nextReminderDate: e.target.value }))}
                  />
                </div>
                <div>
                  <p className="text-xs text-[#64748B] uppercase mb-1">{t("Repeat (months)")}</p>
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
                <p className="text-xs font-medium text-[#DC2626]">{t("Due now — service is overdue.")}</p>
              )}
              <div className={`flex gap-2 ${readOnly ? "hidden" : ""}`}>
                <Button size="sm" variant="outline" className="flex-1 h-8 border-[#E2E8F0]" onClick={handleSaveReminder}>{t("Save")}</Button>
                <Button size="sm" className="flex-1 h-8 bg-[#16A34A] hover:bg-[#15803D] text-white gap-1.5" onClick={handleMarkServiced} disabled={!reminderDraft.frequencyMonths}>
                  <CheckCircle2 className="w-3.5 h-3.5" /> {t("Mark Serviced")}
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
                <Bell className="w-4 h-4 text-[#0891B2]" /> {t("Other Reminders")}
              </CardTitle>
              <Button size="icon" variant="outline" className={`h-7 w-7 border-[#E2E8F0] ${readOnly ? "hidden" : ""}`} onClick={() => { setEditingReminderId(null); setReminderTypeDraft({ label: "", frequencyMonths: "", nextDue: "" }); setReminderTypeOpen(true); }}>
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {reminders.length === 0 && <p className="text-xs text-[#64748B]">{t("No additional reminders yet.")}</p>}
              {reminders.map((r) => {
                const overdue = new Date(r.next_due) <= new Date();
                return (
                  <button
                    key={r.id}
                    onClick={() => !readOnly && handleOpenReminderEdit(r)}
                    className={`w-full flex items-center justify-between rounded-lg border border-[#F1F5F9] px-3 py-2 text-left ${readOnly ? "cursor-default" : "hover:bg-[#F8FAFC]"}`}
                  >
                    <div>
                      <p className="text-sm font-medium text-[#0F172A]">{r.label}</p>
                      <p className={`text-xs ${overdue ? "text-[#DC2626] font-medium" : "text-[#64748B]"}`}>
                        {t("Due")} {r.next_due} · {t("every")} {r.frequency_months}{t("mo")}{overdue ? ` · ${t("overdue")}` : ""}
                      </p>
                    </div>
                    <div className={`flex items-center gap-1 ${readOnly ? "hidden" : ""}`}>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleMarkReminderDone(r.id); }}>
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleDeleteReminder(r.id); }}>
                        <Trash2 className="w-3.5 h-3.5 text-[#DC2626]" />
                      </Button>
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {/* Client PDF 2026-09-06: "add a button to view all forms from previous jobs or
              maintenance jobs (water testing and check list for maintenance with notes)". */}
          <Card className="border-[#E2E8F0] shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-[#0F172A] flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#0891B2]" /> {t("Service Forms")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0 max-h-80 overflow-y-auto">
              {serviceForms.length === 0 && <p className="text-xs text-[#64748B]">{t("No forms submitted yet.")}</p>}
              {serviceForms.map((f) => (
                <div key={f.id} className="flex items-center gap-1 rounded-lg border border-[#F1F5F9] hover:bg-[#F8FAFC]">
                  <button onClick={() => openServiceForm(f)} className="flex-1 min-w-0 text-left px-3 py-2">
                    <p className="text-xs font-semibold text-[#0891B2]">{new Date(f.submitted_at).toLocaleDateString()}</p>
                    <p className="text-sm font-medium text-[#0F172A] truncate">{t(f.template_name ?? f.type)}</p>
                    <p className="text-xs text-[#64748B] truncate">{f.job_type ? t(f.job_type) : t("Job")}</p>
                  </button>
                  {f.job_id && !readOnly && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 mr-1 shrink-0" title={t("Open Job")} onClick={() => navigate(`/jobs/${f.job_id}`)}>
                      <ExternalLink className="w-3.5 h-3.5 text-[#64748B]" />
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Dialog open={reminderTypeOpen} onOpenChange={(open) => { setReminderTypeOpen(open); if (!open) setEditingReminderId(null); }}>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editingReminderId ? t("Edit Reminder") : t("Add Reminder Type")}</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div><Label>{t("Label")}</Label><ReminderLabelSelect value={reminderTypeDraft.label} onChange={(label) => setReminderTypeDraft((p) => ({ ...p, label }))} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>{t("Frequency (months)")}</Label><Input type="number" className="mt-1" placeholder="e.g. 4" value={reminderTypeDraft.frequencyMonths} onChange={(e) => setReminderTypeDraft((p) => ({ ...p, frequencyMonths: e.target.value }))} /></div>
                  <div><Label>{t("Next Due")}</Label><Input type="date" className="mt-1" value={reminderTypeDraft.nextDue} onChange={(e) => setReminderTypeDraft((p) => ({ ...p, nextDue: e.target.value }))} /></div>
                </div>
                <Button className="w-full bg-[#0891B2] text-white" onClick={handleAddReminderType}>{t("Save")}</Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Equipment on File (client bug report 2026-09-02: editable via the header Edit button;
              client video 2026-10-16: "these are not clickable to edit in this screen...I'm not
              sure...or you go to the edit screen somewhere here" -- that button wasn't discoverable
              from this card at all, so a direct Edit button now lives right on it too). */}
          <Card className="border-[#E2E8F0] shadow-sm">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold text-[#0F172A]">{t("Equipment on File")}</CardTitle>
              {!readOnly && (
                <button className="text-[#64748B] hover:text-[#0891B2]" title={t("Edit")} onClick={() => setEditOpen(true)}>
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-[#64748B] uppercase">{t("Pump")}</p>
                  <p className="font-medium text-[#0F172A]">{equipment.pump || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-[#64748B] uppercase">{t("Heater")}</p>
                  <p className="font-medium text-[#0F172A]">{equipment.heater || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-[#64748B] uppercase">{t("Filter")}</p>
                  <p className="font-medium text-[#0F172A]">{equipment.filter || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-[#64748B] uppercase">{t("Salt System")}</p>
                  <p className="font-medium text-[#0F172A]">{equipment.salt || "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Gate Codes / Access Info */}
          <Card className="border-[#E2E8F0] shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-[#0F172A]">{t("Gate Codes & Access")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-[#64748B] uppercase mb-1">{t("Front Gate Code")}</p>
                  <Input placeholder="e.g. #1234" className="h-9 text-sm" value={gateDraft.frontGate} onChange={(e) => updateGateDraft({ frontGate: e.target.value })} />
                </div>
                <div>
                  <p className="text-xs text-[#64748B] uppercase mb-1">{t("House Gate Code")}</p>
                  <Input placeholder="e.g. #5678" className="h-9 text-sm" value={gateDraft.houseGate} onChange={(e) => updateGateDraft({ houseGate: e.target.value })} />
                </div>
                <div>
                  <p className="text-xs text-[#64748B] uppercase mb-1">{t("Padlock Code")}</p>
                  <Input placeholder="e.g. 0000" className="h-9 text-sm" value={gateDraft.padlock} onChange={(e) => updateGateDraft({ padlock: e.target.value })} />
                </div>
                <div>
                  <p className="text-xs text-[#64748B] uppercase mb-1">{t("Gated Subdivision Entrance")}</p>
                  <Select value={gateDraft.subdivisionEntrance} onValueChange={(v) => updateGateDraft({ subdivisionEntrance: v })}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("No gated subdivision")}</SelectItem>
                      <SelectItem value="call">{t("Call box at entrance")}</SelectItem>
                      <SelectItem value="code">{t("Keypad code at entrance")}</SelectItem>
                      <SelectItem value="remote">{t("Remote / transponder")}</SelectItem>
                      <SelectItem value="guard">{t("Guard / attendant")}</SelectItem>
                      <SelectItem value="open">{t("Open access (no code needed)")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <p className="text-xs text-[#64748B] uppercase mb-1">{t("Access Notes")}</p>
                <Textarea placeholder="e.g. Dog in backyard, key under mat, etc." className="text-sm" rows={2} value={gateDraft.notes} onChange={(e) => updateGateDraft({ notes: e.target.value })} />
              </div>
              <Button size="sm" variant="outline" className={`w-full h-8 border-[#E2E8F0] ${readOnly ? "hidden" : ""}`} disabled={savingGateCodes} onClick={handleSaveGateCodes}>
                {savingGateCodes ? t("Saving...") : t("Save Access Info")}
              </Button>
              {gateCodesSavedAt && (
                <p className="text-xs text-[#16A34A] flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> {t("Saved")}</p>
              )}
            </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-2">
          <Tabs defaultValue={initialTab} className="w-full">
            <TabsList className="bg-white border border-[#E2E8F0] w-full justify-start h-10 p-1 rounded-lg mb-4">
              <TabsTrigger value="history" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4">{t("Service History")}</TabsTrigger>
              <TabsTrigger value="notes" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4">{t("Notes")}</TabsTrigger>
              <TabsTrigger value="invoices" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4">{t("Invoices")}</TabsTrigger>
              <TabsTrigger value="previous-sales" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4">{t("Previous Sales")}</TabsTrigger>
            </TabsList>

            <TabsContent value="history" className="mt-0">
              <Card className="border-[#E2E8F0] shadow-sm">
                <CardContent className="p-0">
                  <div className="divide-y divide-[#F1F5F9]">
                    {/* Client SMS 2026-10-15: "job history links not active" -- these rows had no
                        onClick/Link at all, purely decorative. job_service_history.job_id (nullable,
                        older/historic rows may not have one) links straight to the real job. */}
                    {history.map((h) => (
                      <div
                        key={h.id}
                        onClick={() => h.job_id && !readOnly && navigate(`/jobs/${h.job_id}`)}
                        className={`p-4 flex items-center gap-4 ${h.job_id && !readOnly ? "cursor-pointer hover:bg-[#F8FAFC]" : ""}`}
                      >
                        <div className="w-12 h-12 rounded-lg bg-[#0891B2]/10 flex items-center justify-center shrink-0">
                          <Wrench className="w-5 h-5 text-[#0891B2]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={`font-medium ${h.job_id ? "text-[#0891B2] hover:underline" : "text-[#0F172A]"}`}>{h.type}</p>
                            <Badge className={`${statusColors[h.status] || ""} text-[10px] px-1.5 py-0`}>{t(jobStatusDisplayLabel(h.status))}</Badge>
                          </div>
                          <p className="text-sm text-[#64748B]">{h.service_date} &middot; {h.tech}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-semibold text-[#0F172A]">${h.amount}</p>
                        </div>
                      </div>
                    ))}
                    {history.length === 0 && (
                      <div className="p-8 text-center text-[#64748B]">{t("No service history yet")}</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notes" className="mt-0">
              <Card className="border-[#E2E8F0] shadow-sm">
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <Input placeholder={t("Add a note...")} className="flex-1" value={newNote} onChange={(e) => setNewNote(e.target.value)} />
                    <Button size="sm" className="bg-[#0891B2] text-white gap-1" onClick={handleAddNote}>
                      <Plus className="w-4 h-4" /> {t("Add")}
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {notes.map((n) => (
                      <div key={n.id} className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                        {editingNoteId === n.id ? (
                          <div className="space-y-2">
                            <Textarea value={editNoteText} onChange={(e) => setEditNoteText(e.target.value)} rows={3} autoFocus />
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="outline" onClick={() => setEditingNoteId(null)}>{t("Cancel")}</Button>
                              <Button size="sm" className="bg-[#0891B2] text-white" disabled={!editNoteText.trim()} onClick={handleSaveNoteEdit}>{t("Save")}</Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-2">
                            <p className="flex-1 text-sm text-[#0F172A] whitespace-pre-wrap">{n.text}</p>
                            <Button size="icon" variant="ghost" className={`h-7 w-7 shrink-0 ${readOnly ? "hidden" : ""}`} title={t("Edit note")} onClick={() => { setEditingNoteId(n.id); setEditNoteText(n.text); }}>
                              <Pencil className="w-3.5 h-3.5 text-[#64748B]" />
                            </Button>
                            <Button size="icon" variant="ghost" className={`h-7 w-7 shrink-0 ${readOnly ? "hidden" : ""}`} title={t("Delete note")} onClick={() => setDeleteNoteId(n.id)}>
                              <Trash2 className="w-3.5 h-3.5 text-[#DC2626]" />
                            </Button>
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-2 text-xs text-[#64748B]">
                          <span className="font-medium">{n.author}</span>
                          <span>&middot;</span>
                          <span>{n.created_at}</span>
                        </div>
                      </div>
                    ))}
                    {notes.length === 0 && (
                      <p className="text-center text-[#64748B] py-4">{t("No notes yet")}</p>
                    )}
                  </div>
                  {/* Photos */}
                  <div>
                    <p className="text-sm font-medium text-[#0F172A] mb-2 flex items-center gap-2">
                      <Camera className="w-4 h-4" /> {t("Photos")}
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
                            hidden={readOnly}
                            className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            title={t("Delete photo")}
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
                      <div key={inv.id} onClick={() => setOpenInvoiceId(inv.id)} className="p-4 flex items-center gap-4 cursor-pointer hover:bg-[#F8FAFC]">
                        <div className="w-12 h-12 rounded-lg bg-[#F1F5F9] flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5 text-[#0891B2]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-[#0F172A]">{inv.number}</p>
                            <Badge className={`${statusColors[inv.status] || ""} text-[10px] px-1.5 py-0`}>{t(inv.status)}</Badge>
                          </div>
                          <p className="text-sm text-[#64748B]">{t("Issued:")} {inv.issue_date}</p>
                          {inv.job_description && <p className="text-xs text-[#64748B] mt-0.5 truncate">{inv.job_description}</p>}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-semibold text-[#0F172A]">${inv.amount}</p>
                        </div>
                      </div>
                    ))}
                    {invoices.length === 0 && (
                      <div className="p-8 text-center text-[#64748B]">{t("No invoices yet")}</div>
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
                      <div
                        key={sale.id}
                        className="p-4 cursor-pointer hover:bg-[#F8FAFC]"
                        onClick={() => setOpenSaleId(sale.id)}
                        title={t("Open the receipt — add notes, print or re-print")}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-10 h-10 rounded-lg bg-[#F1F5F9] flex items-center justify-center shrink-0">
                              <FileText className="w-4 h-4 text-[#0891B2]" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-[#0F172A]">{new Date(sale.created_at).toLocaleDateString()}</p>
                              <p className="text-xs text-[#64748B]">{receiptNumber(sale.id, sale.number)} · {sale.payment_method || t("In-store sale")}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <p className="font-semibold text-[#0F172A]">${sale.total}</p>
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-[#0891B2]"><Printer className="w-3.5 h-3.5" /> {t("Receipt")}</span>
                          </div>
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
                      <div className="p-8 text-center text-[#64748B]">{t("No previous in-store sales yet")}</div>
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
            <CardTitle className="text-sm font-semibold text-[#0F172A]">{t("Customer Summary")}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-[#64748B] uppercase">{t("Lifetime Value")}</p>
                <p className="text-lg font-bold text-[#0F172A]">${customer.lifetime_value.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-[#64748B] uppercase">{t("Total Jobs")}</p>
                <p className="text-lg font-bold text-[#0F172A]">{history.length}</p>
              </div>
              <div>
                <p className="text-xs text-[#64748B] uppercase">{t("Customer Since")}</p>
                <p className="text-sm font-medium text-[#0F172A]">{customer.customer_since}</p>
              </div>
              <div>
                <p className="text-xs text-[#64748B] uppercase">{t("Last Contact")}</p>
                <p className="text-sm font-medium text-[#0F172A]">{customer.last_contact}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit Customer (client bug report 2026-09-02: previously no way to edit anything) */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t("Edit Customer")}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("First Name")}</Label><Input className="mt-1" value={editDraft.firstName} onChange={(e) => setEditDraft((p) => ({ ...p, firstName: e.target.value }))} /></div>
              <div><Label>{t("Last Name")}</Label><Input className="mt-1" value={editDraft.lastName} onChange={(e) => setEditDraft((p) => ({ ...p, lastName: e.target.value }))} /></div>
            </div>
            <div>
              <Label>{t("Type")}</Label>
              <Select value={editDraft.type} onValueChange={(v) => setEditDraft((p) => ({ ...p, type: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Residential">{t("Residential")}</SelectItem>
                  <SelectItem value="Commercial">{t("Commercial")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("Phone")}</Label><Input className="mt-1" value={editDraft.phone} onChange={(e) => setEditDraft((p) => ({ ...p, phone: formatPhoneInput(e.target.value) }))} /></div>
              <div><Label>{t("Email")}</Label><Input className="mt-1" value={editDraft.email} onChange={(e) => setEditDraft((p) => ({ ...p, email: e.target.value }))} /></div>
            </div>
            <div>
              <Label>{t("Address")}</Label>
              <AddressAutocomplete className="mt-1" value={editDraft.address} onChange={(address) => setEditDraft((p) => ({ ...p, address }))} />
            </div>
            <div>
              <p className="text-sm font-medium text-[#0F172A] mb-2">{t("Equipment on File")}</p>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">{t("Pump")}</Label><Input className="mt-1 h-9" value={editDraft.pump} onChange={(e) => setEditDraft((p) => ({ ...p, pump: e.target.value }))} /></div>
                <div><Label className="text-xs">{t("Heater")}</Label><Input className="mt-1 h-9" value={editDraft.heater} onChange={(e) => setEditDraft((p) => ({ ...p, heater: e.target.value }))} /></div>
                <div><Label className="text-xs">{t("Filter")}</Label><Input className="mt-1 h-9" value={editDraft.filter} onChange={(e) => setEditDraft((p) => ({ ...p, filter: e.target.value }))} /></div>
                <div><Label className="text-xs">{t("Salt System")}</Label><Input className="mt-1 h-9" value={editDraft.salt} onChange={(e) => setEditDraft((p) => ({ ...p, salt: e.target.value }))} /></div>
              </div>
            </div>
            <Button className="w-full bg-[#0891B2] text-white" onClick={handleSaveEdit}>{t("Save Changes")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Other Contact (client bug report 2026-09-02) */}
      <Dialog open={addContactOpen} onOpenChange={setAddContactOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t("Add Other Contact")}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("First Name")}</Label><Input className="mt-1" value={contactDraft.firstName} onChange={(e) => setContactDraft((p) => ({ ...p, firstName: e.target.value }))} /></div>
              <div><Label>{t("Last Name")}</Label><Input className="mt-1" value={contactDraft.lastName} onChange={(e) => setContactDraft((p) => ({ ...p, lastName: e.target.value }))} /></div>
            </div>
            <div><Label>{t("Phone")}</Label><Input className="mt-1" value={contactDraft.phone} onChange={(e) => setContactDraft((p) => ({ ...p, phone: formatPhoneInput(e.target.value) }))} /></div>
            <div><Label>{t("Email")}</Label><Input className="mt-1" value={contactDraft.email} onChange={(e) => setContactDraft((p) => ({ ...p, email: e.target.value }))} /></div>
            <p className="text-xs text-[#64748B]">{t("Shares this property's address with")} {customer.name}.</p>
            <Button className="w-full bg-[#0891B2] text-white" onClick={handleAddContact}>{t("Save Contact")}</Button>
          </div>
        </DialogContent>
      </Dialog>
      <ReceiptDialog orderId={openSaleId} onClose={() => setOpenSaleId(null)} />
      <InvoicePreviewDialog invoiceId={openInvoiceId} onClose={() => setOpenInvoiceId(null)} allowOpenFull={!readOnly} />
      <FormSubmissionView
        template={openForm ? (formTemplates ?? []).find((tpl) => tpl.id === openForm.template_id) ?? null : null}
        form={openForm as JobForm | null}
        open={openForm !== null}
        onOpenChange={(open) => { if (!open) setOpenForm(null); }}
      />
      <Dialog open={deleteNoteId !== null} onOpenChange={(open) => { if (!open) setDeleteNoteId(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("Delete this note?")}</DialogTitle></DialogHeader>
          <p className="text-sm text-[#64748B]">{t("This permanently removes the note from this customer.")}</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteNoteId(null)}>{t("Cancel")}</Button>
            <Button className="bg-[#DC2626] text-white hover:bg-[#B91C1C]" onClick={handleDeleteNote}>{t("Delete")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
