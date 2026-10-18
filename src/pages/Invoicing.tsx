import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, Plus, BookOpen, CreditCard, Repeat, CheckCircle2, Clock, AlertTriangle, FileText, ArrowRight, Copy, Layers, ClipboardList, Camera, X, Pencil, Bell, Phone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { matchesQuery } from "@/lib/search";
import { useSort, sortHeader } from "@/components/SortableTh";
import { customerOption } from "@/lib/customer-options";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { invoicingApi, type Estimate, type EstimateTemplate } from "@/lib/api/invoicing";
import { reportsApi, type CustomerReminder } from "@/lib/api/reports";
import ReminderLabelSelect from "@/components/ReminderLabelSelect";
import { customersApi } from "@/lib/api/customers";
import { inventoryApi, type ItemWithStock } from "@/lib/api/inventory";
import { settingsApi } from "@/lib/api/settings";
import { jobsApi } from "@/lib/api/jobs";
import { tasksApi, type FreeformTask } from "@/lib/api/tasks";
import { profilesApi } from "@/lib/api/profiles";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { SearchableSelect } from "@/components/SearchableSelect";
import CardPaymentForm from "@/components/CardPaymentForm";
import LineItemsEditor, { type DraftLineItem } from "@/components/LineItemsEditor";
import { useLanguage } from "@/lib/language-context";
import type { Database } from "@/lib/database.types";
import { useConfirm } from "@/components/ConfirmDialog";
import InvoicePreviewDialog from "@/components/InvoicePreviewDialog";

// `total` (materials taxed at the tenant's real tax rate, labor untaxed, added by the backend list endpoint) matches
// what InvoiceDetail.tsx itself displays -- the raw `amount` column is pre-tax, see invoicing.ts.
type Invoice = Database["public"]["Tables"]["invoices"]["Row"] & { customers: { name: string } | null; total?: number };
type UninvoicedJob = Database["public"]["Tables"]["jobs"]["Row"];
type RecurringBilling = Database["public"]["Tables"]["recurring_billing"]["Row"] & { customers: { name: string } | null };
type Payment = Database["public"]["Tables"]["payments"]["Row"] & { invoices: { number: string } | null; customers: { name: string } | null };
type Customer = { id: string; name: string; email: string | null; phone: string | null; address: string | null };

const statusColors: Record<string, string> = {
  Draft: "bg-[#F59E0B]/10 text-[#F59E0B]",
  Open: "bg-[#6366F1]/10 text-[#6366F1]",
  Sent: "bg-[#0891B2]/10 text-[#0891B2]",
  Paid: "bg-[#16A34A]/10 text-[#16A34A]",
  Overdue: "bg-[#DC2626]/10 text-[#DC2626]",
  Accepted: "bg-[#16A34A]/10 text-[#16A34A]",
  Declined: "bg-[#DC2626]/10 text-[#DC2626]",
  "Written Off": "bg-[#64748B]/10 text-[#64748B]",
};

const paymentMethods: Record<string, { icon: typeof CreditCard; label: string }> = {
  Card: { icon: CreditCard, label: "Card" },
  ACH: { icon: FileText, label: "ACH" },
};

const daysBetween = (a: string, b: string) => Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86400000);
// QA sweep 2026-09-30 follow-up: `total` (materials * (1 + tax rate) + labor) is a floating-point result --
// plain toLocaleString() shows up to 3 fraction digits by default, so a value like 4216.3149999998
// rendered as "$4,216.315" instead of "$4,216.32". Every money amount in this file should go
// through this instead of calling toLocaleString() directly.
const money = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Invoicing() {
  const { t } = useLanguage();
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const [paymentSearch, setPaymentSearch] = useState("");
  // Client video 2026-10-18: search box on every Invoicing tab ("a search field for a customer name
  // or estimate number") + every column sortable.
  const [estimateSearch, setEstimateSearch] = useState("");
  const [reminderSearch, setReminderSearch] = useState("");
  const [taskSearch, setTaskSearch] = useState("");
  const [recurringSearch, setRecurringSearch] = useState("");
  const [newInvoiceOpen, setNewInvoiceOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [recurringBilling, setRecurringBilling] = useState<RecurringBilling[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [newInvoice, setNewInvoice] = useState({ customerId: "", issueDate: "", dueDate: "", amount: "", downPayment: "", jobDescription: "" });
  const [newInvoiceLines, setNewInvoiceLines] = useState<DraftLineItem[]>([]);
  // Client PDF 2026-09-06: "down payment section: put '%' or '$' symbol, make 50% the default".
  const [newInvoiceDownPaymentMode, setNewInvoiceDownPaymentMode] = useState<"percent" | "fixed">("percent");
  const [newEstimateDownPaymentMode, setNewEstimateDownPaymentMode] = useState<"percent" | "fixed">("percent");
  const [qboConnected, setQboConnected] = useState(false);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [inventoryItems, setInventoryItems] = useState<ItemWithStock[]>([]);
  const [newEstimateOpen, setNewEstimateOpen] = useState(false);
  const [newEstimate, setNewEstimate] = useState({ customerId: "", issueDate: "", expiryDate: "", amount: "", downPayment: "50", jobDescription: "" });
  const [newEstimateLines, setNewEstimateLines] = useState<DraftLineItem[]>([]);
  const [estimateTemplates, setEstimateTemplates] = useState<EstimateTemplate[]>([]);
  const [searchParams] = useSearchParams();
  // Client SMS 2026-09-09: Vendor Bills moved out of this page to Inventory > Vendor Tools
  // (under Purchase Orders) -- "vendor-bills" is no longer a tab here.
  const validTabs = ["all", "estimates", "other-reminders", "tasks", "recurring", "payments"];
  const [activeTab, setActiveTab] = useState(() => {
    const tab = searchParams.get("tab");
    return tab && validTabs.includes(tab) ? tab : "all";
  });
  const [bulkOpen, setBulkOpen] = useState(false);
  // Client video 2026-10-18: "Combine completed jobs ... does not do anything" -- nothing showed
  // until From and To were both typed. Prefilled with the last 90 days.
  const [bulkForm, setBulkForm] = useState(() => {
    const end = new Date();
    const start = new Date(end.getTime() - 90 * 86400000);
    const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { customerId: "", start: key(start), end: key(end) };
  });
  const [bulkJobs, setBulkJobs] = useState<UninvoicedJob[]>([]);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  // Client request 2026-09-02: a second Bulk Invoice mode — combine several of a customer's
  // already-open invoices and collect payment on all of them at once (card on file, manual
  // check, or email the customer), distinct from the original "combine completed jobs" mode.
  const [bulkTab, setBulkTab] = useState<"jobs" | "invoices">("invoices");
  const [bulkInvoiceCustomerId, setBulkInvoiceCustomerId] = useState("");
  const [bulkInvoiceSelected, setBulkInvoiceSelected] = useState<Set<string>>(new Set());
  const [bulkPayMethod, setBulkPayMethod] = useState<"Card" | "Check" | "Email">("Card");
  const [bulkCheckNumber, setBulkCheckNumber] = useState("");
  const [bulkCollecting, setBulkCollecting] = useState(false);
  const navigate = useNavigate();
  const { tenantId } = useAuth();

  // Client request 2026-09-02: a freeform "Tasks" tab under Estimates — assign a
  // Renovation/Repair/Go-back task to a tech at a customer/address, with photos, notes, and a
  // date range, independent of the jobs/estimates pipelines.
  const [tasks, setTasks] = useState<FreeformTask[]>([]);
  const [techs, setTechs] = useState<{ id: string; name: string }[]>([]);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [newTask, setNewTask] = useState({ customerId: "", techId: "", address: "", email: "", type: "Repair", notes: "", startDate: "", endDate: "" });
  const [editTask, setEditTask] = useState<FreeformTask | null>(null);
  const [newTaskPhotos, setNewTaskPhotos] = useState<string[]>([]);
  const [taskPhotoUploading, setTaskPhotoUploading] = useState(false);

  // Client video 2026-10-06: "I would add another tab between estimates and tasks and put other
  // reminders right here" -- same customer_reminders data Reports > Reminders already shows, now
  // also here where staff work day-to-day; "other reminders will be the same thing as leads...
  // we have to call these people" -- each row gets a real tel: Call link.
  const [reminders, setReminders] = useState<CustomerReminder[]>([]);
  const [remindersRange, setRemindersRange] = useState<"30" | "60" | "90" | "all">("all");
  const [reminderOpen, setReminderOpen] = useState(false);
  const [editingReminderId, setEditingReminderId] = useState<string | null>(null);
  const [reminderDraft, setReminderDraft] = useState({ customerId: "", label: "", frequencyMonths: "", nextDue: "" });
  const localKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && validTabs.includes(tab)) setActiveTab(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const loadInvoicing = useCallback(async () => {
    setIsLoading(true);
    const [invoicesData, recurringData, paymentsData, customersData, settingsData, estimatesData, inventoryData, tasksData, techsData, templatesData, remindersData] = await Promise.all([
      invoicingApi.list(),
      invoicingApi.recurringBilling(),
      invoicingApi.payments(),
      customersApi.list(),
      settingsApi.all(),
      invoicingApi.estimates(),
      inventoryApi.summary(),
      tasksApi.list(),
      profilesApi.list(),
      invoicingApi.estimateTemplates(),
      reportsApi.reminders(),
    ]);
    setInvoices((invoicesData ?? []) as Invoice[]);
    setRecurringBilling((recurringData ?? []) as RecurringBilling[]);
    setPayments((paymentsData ?? []) as Payment[]);
    setCustomers(customersData ?? []);
    setQboConnected(settingsData.integrations.some((i) => i.provider === "quickbooks" && i.status === "Connected"));
    setEstimates((estimatesData ?? []) as Estimate[]);
    setInventoryItems(inventoryData?.items ?? []);
    setTasks(tasksData ?? []);
    setTechs((techsData ?? []).map((t) => ({ id: t.id, name: t.name })));
    setEstimateTemplates(templatesData ?? []);
    setReminders(remindersData ?? []);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadInvoicing();
  }, [loadInvoicing]);

  const newInvoiceSubtotal = newInvoiceLines.length > 0 ? newInvoiceLines.reduce((s, li) => s + li.quantity * li.rate, 0) : parseFloat(newInvoice.amount) || 0;
  const newEstimateSubtotal = newEstimateLines.length > 0 ? newEstimateLines.reduce((s, li) => s + li.quantity * li.rate, 0) : parseFloat(newEstimate.amount) || 0;
  const resolveDownPayment = (raw: string, mode: "percent" | "fixed", subtotal: number) => {
    const n = parseFloat(raw) || 0;
    return mode === "percent" ? (subtotal * n) / 100 : n;
  };

  const handleCreateInvoice = async () => {
    if (!newInvoice.customerId || !newInvoice.issueDate) return;
    // Client SMS 2026-10-16: "numbers only" -- the server now assigns a sequential INV-0001 (see
    // backend/src/lib/numbering.ts), replacing this date-based guess (the same duplicate-number
    // bug class already found and fixed once for PO numbers).
    await invoicingApi.create({
      customerId: newInvoice.customerId,
      issueDate: newInvoice.issueDate,
      dueDate: newInvoice.dueDate || null,
      amount: parseFloat(newInvoice.amount) || 0,
      status: "Draft",
      downPayment: resolveDownPayment(newInvoice.downPayment, newInvoiceDownPaymentMode, newInvoiceSubtotal),
      jobDescription: newInvoice.jobDescription || null,
      lineItems: newInvoiceLines.filter((li) => li.description.trim()),
    });
    setNewInvoice({ customerId: "", issueDate: "", dueDate: "", amount: "", downPayment: "", jobDescription: "" });
    setNewInvoiceLines([]);
    setNewInvoiceOpen(false);
    loadInvoicing();
  };

  // Client PDF 2026-09-06: when creating an estimate, default the issue date to today and
  // expiry to 30 days out (still editable) instead of leaving both blank.
  const openNewEstimateDialog = () => {
    const today = new Date().toISOString().slice(0, 10);
    const expiry = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    setNewEstimate({ customerId: "", issueDate: today, expiryDate: expiry, amount: "", downPayment: "50", jobDescription: "" });
    setNewEstimateLines([]);
    setNewEstimateDownPaymentMode("percent");
    setNewEstimateOpen(true);
  };

  const applyEstimateTemplate = (templateId: string) => {
    const tpl = estimateTemplates.find((t) => t.id === templateId);
    if (!tpl) return;
    setNewEstimateLines(tpl.line_items.map((li) => ({ ...li, sku: li.sku ?? "", notes: li.notes ?? "" })));
  };

  const [savingTemplate, setSavingTemplate] = useState(false);
  const handleSaveAsTemplate = async () => {
    const name = window.prompt("Template name (e.g. \"Heater Replacement\")");
    if (!name) return;
    const lineItems = newEstimateLines.filter((li) => li.description.trim());
    if (lineItems.length === 0) return;
    setSavingTemplate(true);
    await invoicingApi.createEstimateTemplate({ name, lineItems });
    const templates = await invoicingApi.estimateTemplates();
    setEstimateTemplates(templates ?? []);
    setSavingTemplate(false);
  };

  const handleCreateEstimate = async () => {
    if (!newEstimate.customerId || !newEstimate.issueDate) return;
    await invoicingApi.createEstimate({
      customerId: newEstimate.customerId,
      issueDate: newEstimate.issueDate,
      expiryDate: newEstimate.expiryDate || null,
      amount: parseFloat(newEstimate.amount) || 0,
      downPayment: resolveDownPayment(newEstimate.downPayment, newEstimateDownPaymentMode, newEstimateSubtotal),
      jobDescription: newEstimate.jobDescription || null,
      lineItems: newEstimateLines.filter((li) => li.description.trim()),
    });
    setNewEstimate({ customerId: "", issueDate: "", expiryDate: "", amount: "", downPayment: "50", jobDescription: "" });
    setNewEstimateLines([]);
    setNewEstimateOpen(false);
    loadInvoicing();
  };

  const remindersFiltered = remindersRange === "all"
    ? reminders
    : reminders.filter((r) => r.next_due <= localKey(new Date(Date.now() + Number(remindersRange) * 86400000)));

  const handleSaveReminder = async () => {
    if (!reminderDraft.label || !reminderDraft.frequencyMonths || !reminderDraft.nextDue) return;
    if (editingReminderId) {
      await reportsApi.updateReminder(editingReminderId, {
        label: reminderDraft.label,
        frequencyMonths: parseInt(reminderDraft.frequencyMonths, 10),
        nextDue: reminderDraft.nextDue,
      });
    } else {
      if (!reminderDraft.customerId) return;
      await reportsApi.addReminder({
        customerId: reminderDraft.customerId,
        label: reminderDraft.label,
        frequencyMonths: parseInt(reminderDraft.frequencyMonths, 10),
        nextDue: reminderDraft.nextDue,
      });
    }
    setReminderDraft({ customerId: "", label: "", frequencyMonths: "", nextDue: "" });
    setEditingReminderId(null);
    setReminderOpen(false);
    loadInvoicing();
  };

  const handleOpenReminderEdit = (r: CustomerReminder) => {
    setEditingReminderId(r.id);
    setReminderDraft({ customerId: r.customer_id, label: r.label, frequencyMonths: String(r.frequency_months), nextDue: r.next_due });
    setReminderOpen(true);
  };

  const handleMarkReminderDone = async (id: string) => {
    await reportsApi.markReminderDone(id);
    loadInvoicing();
  };

  const handleDeleteReminder = async (id: string) => {
    if (!(await confirm({ title: "Delete this reminder?", name: reminders.find((r) => r.id === id)?.label }))) return;
    await reportsApi.deleteReminder(id);
    loadInvoicing();
  };

  const handleConvertEstimate = async (id: string) => {
    const { invoiceId } = await invoicingApi.convertEstimateToInvoice(id);
    await loadInvoicing();
    navigate(`/invoicing/${invoiceId}`);
  };

  const handleTaskPhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    setTaskPhotoUploading(true);
    for (const file of Array.from(e.target.files)) {
      if (!file.type.startsWith("image/")) continue;
      const path = `${tenantId}/tasks/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("job-attachments").upload(path, file);
      if (error) continue;
      const { data } = supabase.storage.from("job-attachments").getPublicUrl(path);
      setNewTaskPhotos((prev) => [...prev, data.publicUrl]);
    }
    setTaskPhotoUploading(false);
    e.target.value = "";
  };

  const handleTaskStatusChange = async (id: string, status: string) => {
    await tasksApi.updateStatus(id, status);
    loadInvoicing();
  };

  const openEditTask = (t: FreeformTask) => {
    setEditTask(t);
    setNewTask({
      customerId: t.customer_id ?? "",
      techId: t.tech_id ?? "",
      address: t.address ?? "",
      email: t.email ?? "",
      type: t.type,
      notes: t.notes ?? "",
      startDate: t.start_date ?? "",
      endDate: t.end_date ?? "",
    });
    setNewTaskPhotos((t.photos as string[] | null) ?? []);
    setNewTaskOpen(true);
  };

  const handleSaveTask = async () => {
    if (!newTask.type) return;
    const data = {
      customerId: newTask.customerId || null,
      techId: newTask.techId || null,
      address: newTask.address || null,
      email: newTask.email || null,
      type: newTask.type,
      notes: newTask.notes || null,
      photos: newTaskPhotos,
      startDate: newTask.startDate || null,
      endDate: newTask.endDate || null,
    };
    if (editTask) {
      await tasksApi.update(editTask.id, data);
    } else {
      await tasksApi.create(data);
    }
    setNewTask({ customerId: "", techId: "", address: "", email: "", type: "Repair", notes: "", startDate: "", endDate: "" });
    setNewTaskPhotos([]);
    setEditTask(null);
    setNewTaskOpen(false);
    loadInvoicing();
  };

  // Client request 2026-08-28: bulk invoicing — combine several weeks of completed (but not
  // yet invoiced) jobs for one customer into a single invoice, one line item per job.
  const loadBulkJobs = useCallback(async () => {
    const { customerId, start, end } = bulkForm;
    if (!customerId || !start || !end) {
      setBulkJobs([]);
      return;
    }
    const jobs = await jobsApi.uninvoiced(customerId, start, end);
    setBulkJobs(jobs ?? []);
    setBulkSelected(new Set((jobs ?? []).map((j) => j.id)));
  }, [bulkForm]);

  useEffect(() => {
    loadBulkJobs();
  }, [loadBulkJobs]);

  const toggleBulkJob = (id: string) => {
    setBulkSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const customerOptions = customers.map(customerOption);
  const customersWithOpenInvoices = customers.filter((c) => invoices.some((i) => i.customer_id === c.id && i.status !== "Paid"));
  const customersWithOpenInvoicesOptions = customersWithOpenInvoices.map((c) => ({ value: c.id, label: c.name }));
  const openInvoicesForCustomer = invoices.filter((i) => i.customer_id === bulkInvoiceCustomerId && i.status !== "Paid");
  const toggleBulkInvoice = (id: string) => {
    setBulkInvoiceSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Client video 2026-10-18: the email used to be a mailto: link (opened desktop Outlook). Now a
  // real email from the server with a view/pay link per invoice; the dialog stays open with the result.
  const [bulkEmailResult, setBulkEmailResult] = useState<{ ok: boolean; text: string } | null>(null);
  const handleBulkEmail = async () => {
    const ids = Array.from(bulkInvoiceSelected);
    if (ids.length === 0) return;
    setBulkCollecting(true);
    setBulkEmailResult(null);
    try {
      const r = await invoicingApi.bulkSendInvoiceEmail(ids);
      setBulkEmailResult({ ok: true, text: `${t("Emailed")} ${r.sent} ${t("invoices to")} ${r.to}` });
      await loadInvoicing();
    } catch (err) {
      setBulkEmailResult({ ok: false, text: t(err instanceof Error ? err.message : "Failed to send") });
    }
    setBulkCollecting(false);
  };
  const [previewInvoiceId, setPreviewInvoiceId] = useState<string | null>(null);

  const handleBulkCollect = async (opaqueData?: { dataDescriptor: string; dataValue: string }) => {
    const ids = Array.from(bulkInvoiceSelected);
    if (ids.length === 0) return;
    setBulkCollecting(true);
    await invoicingApi.bulkCollect(ids, bulkPayMethod as "Card" | "Check", opaqueData, bulkCheckNumber.trim() || null);
    await loadInvoicing();
    setBulkInvoiceSelected(new Set());
    setBulkCollecting(false);
    setBulkCheckNumber("");
    setBulkOpen(false);
  };

  const handleCreateBulkInvoice = async () => {
    const selectedJobs = bulkJobs.filter((j) => bulkSelected.has(j.id));
    if (!bulkForm.customerId || selectedJobs.length === 0) return;
    const invoice = await invoicingApi.createBulk({
      customerId: bulkForm.customerId,
      jobIds: selectedJobs.map((j) => j.id),
      issueDate: bulkForm.end,
    });
    setBulkForm({ customerId: "", start: "", end: "" });
    setBulkOpen(false);
    await loadInvoicing();
    navigate(`/invoicing/${invoice.id}`);
  };

  const filtered = invoices.filter((inv) => matchesQuery(search, [inv.number, inv.customers?.name, inv.job_description, inv.status, inv.issue_date]));
  const invoiceSort = useSort(filtered, (inv, key) =>
    key === "customer" ? inv.customers?.name : key === "amount" ? (inv.total ?? inv.amount) : key === "sync" ? (inv.qbo_invoice_id ? 1 : 0) : (inv as unknown as Record<string, string | number | null>)[key]);
  const estimateSort = useSort(
    estimates.filter((est) => matchesQuery(estimateSearch, [est.number, est.customers?.name, est.status, est.issue_date])),
    (est, key) => key === "customer" ? est.customers?.name : key === "amount" ? (est.total ?? est.amount) : (est as unknown as Record<string, string | number | null>)[key]);
  const reminderSort = useSort(
    remindersFiltered.filter((r) => matchesQuery(reminderSearch, [r.customers?.name, r.label, r.customers?.phone])),
    (r, key) => key === "customer" ? r.customers?.name : (r as unknown as Record<string, string | number | null>)[key]);
  const taskSort = useSort(
    tasks.filter((task) => matchesQuery(taskSearch, [task.type, task.customers?.name, task.address, task.profiles?.name, task.status, task.notes, task.start_date])),
    (task, key) => key === "customer" ? task.customers?.name : key === "tech" ? task.profiles?.name : key === "photos" ? task.photos?.length ?? 0 : (task as unknown as Record<string, string | number | null>)[key]);
  const recurringSort = useSort(
    recurringBilling.filter((rb) => matchesQuery(recurringSearch, [rb.customers?.name, rb.frequency, rb.status, String(rb.amount)])),
    (rb, key) => key === "customer" ? rb.customers?.name : (rb as unknown as Record<string, string | number | null>)[key]);
  const paymentSort = useSort(
    payments.filter((pay) => matchesQuery(paymentSearch, [pay.customers?.name, pay.invoices?.number, String(pay.amount), pay.paid_at, pay.method])),
    (pay, key) => key === "invoice" ? pay.invoices?.number : key === "customer" ? pay.customers?.name : (pay as unknown as Record<string, string | number | null>)[key]);

  // QA sweep 2026-09-30: these summed the stored pre-tax `amount`, which never matched the real
  // Total on the invoice document/charge -- `total` (backend-computed, materials-only tax) is what
  // was actually charged/is actually owed.
  const totalOutstanding = invoices.filter((i) => i.status !== "Paid").reduce((sum, i) => sum + (i.total ?? i.amount), 0);
  const paidThisMonth = invoices.filter((i) => i.status === "Paid").reduce((sum, i) => sum + (i.total ?? i.amount), 0);
  const overdue = invoices.filter((i) => i.status === "Overdue").reduce((sum, i) => sum + (i.total ?? i.amount), 0);
  const paidWithDays = invoices.filter((i) => i.status === "Paid" && i.paid_date);
  const avgDays = paidWithDays.length > 0
    ? paidWithDays.reduce((sum, i) => sum + daysBetween(i.paid_date as string, i.issue_date), 0) / paidWithDays.length
    : 0;

  const today = new Date();
  const buckets = [
    { bucket: "Current", min: -Infinity, max: 0 },
    { bucket: "1-30", min: 1, max: 30 },
    { bucket: "31-60", min: 31, max: 60 },
    { bucket: "61-90", min: 61, max: 90 },
    { bucket: "90+", min: 91, max: Infinity },
  ];
  const agedReceivables = buckets.map((b) => {
    const matching = invoices.filter((i) => {
      if (i.status === "Paid" || !i.due_date) return false;
      const daysPastDue = daysBetween(today.toISOString().slice(0, 10), i.due_date);
      return daysPastDue > b.min - 1 && daysPastDue <= b.max;
    });
    return { bucket: b.bucket, amount: matching.reduce((sum, i) => sum + (i.total ?? i.amount), 0), count: matching.length };
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-[#0F172A]">{t("Invoicing")}</h1>
        <div className="flex items-center gap-2">
          {/* Client PDF 2026-09-05: top-right button order "New Estimate - New Task - New
              Invoice" -- achieved with CSS order rather than physically relocating each dialog's
              JSX (New Task's full dialog lives in the Tasks tab below; this button just switches
              to that tab and opens it). */}
          <Button
            className="bg-[#0891B2] hover:bg-[#0E7490] text-white gap-2 h-10 order-2"
            onClick={() => { setActiveTab("tasks"); setNewTaskOpen(true); }}
          >
            <Plus className="w-4 h-4" /> {t("New Task")}
          </Button>
          <Dialog open={newInvoiceOpen} onOpenChange={setNewInvoiceOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#0891B2] hover:bg-[#0E7490] text-white gap-2 h-10 order-3">
                <Plus className="w-4 h-4" /> {t("New Invoice")}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl lg:max-w-4xl w-[90vw] max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{t("Create New Invoice")}</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-sm font-medium text-[#0F172A]">{t("Customer")}</label>
                  <div className="mt-1">
                    <SearchableSelect value={newInvoice.customerId} onChange={(v) => setNewInvoice((p) => ({ ...p, customerId: v }))} placeholder={t("Select customer")} searchPlaceholder={t("Search customers...")} options={customerOptions} showSublabelWhenSelected />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-[#0F172A]">{t("Issue Date")}</label>
                    <Input type="date" className="mt-1" value={newInvoice.issueDate} onChange={(e) => setNewInvoice((p) => ({ ...p, issueDate: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[#0F172A]">{t("Due Date")}</label>
                    <Input type="date" className="mt-1" value={newInvoice.dueDate} onChange={(e) => setNewInvoice((p) => ({ ...p, dueDate: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-[#0F172A]">{t("Job Description")}</label>
                  <textarea
                    className="mt-1 w-full rounded-lg border border-[#E2E8F0] p-2 text-sm min-h-[60px]"
                    placeholder={t("e.g. Heater Install, Zinc Anode, Check Valve...")}
                    value={newInvoice.jobDescription}
                    onChange={(e) => setNewInvoice((p) => ({ ...p, jobDescription: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-[#0F172A]">{t("Line Items")}</label>
                  <div className="mt-1">
                    <LineItemsEditor items={newInvoiceLines} onChange={setNewInvoiceLines} inventoryItems={inventoryItems} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-[#0F172A]">{t("Amount")} {newInvoiceLines.length > 0 && <span className="text-xs text-[#64748B]">({t("from line items")})</span>}</label>
                    <Input
                      type="number"
                      className="mt-1"
                      placeholder="0.00"
                      value={newInvoiceLines.length > 0 ? newInvoiceSubtotal.toFixed(2) : newInvoice.amount}
                      disabled={newInvoiceLines.length > 0}
                      onChange={(e) => setNewInvoice((p) => ({ ...p, amount: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[#0F172A]">{t("Down Payment")}</label>
                    <div className="mt-1 flex gap-2">
                      <Input type="number" placeholder="0" value={newInvoice.downPayment} onChange={(e) => setNewInvoice((p) => ({ ...p, downPayment: e.target.value }))} />
                      <div className="flex rounded-lg border border-[#E2E8F0] overflow-hidden shrink-0">
                        <button type="button" onClick={() => setNewInvoiceDownPaymentMode("percent")} className={`px-2.5 text-sm font-medium ${newInvoiceDownPaymentMode === "percent" ? "bg-[#0891B2] text-white" : "bg-white text-[#64748B]"}`}>%</button>
                        <button type="button" onClick={() => setNewInvoiceDownPaymentMode("fixed")} className={`px-2.5 text-sm font-medium ${newInvoiceDownPaymentMode === "fixed" ? "bg-[#0891B2] text-white" : "bg-white text-[#64748B]"}`}>$</button>
                      </div>
                    </div>
                    <p className="text-xs text-[#64748B] mt-1">= ${resolveDownPayment(newInvoice.downPayment, newInvoiceDownPaymentMode, newInvoiceSubtotal).toFixed(2)}</p>
                  </div>
                </div>
                <Button className="w-full bg-[#0891B2] hover:bg-[#0E7490] text-white" onClick={handleCreateInvoice}>
                  {t("Create Invoice")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="h-10 gap-2 border-[#E2E8F0] text-[#0F172A] bg-white order-4">
                <Layers className="w-4 h-4" /> {t("Bulk Invoice")}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg lg:max-w-3xl w-[90vw] max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{t("Bulk Invoice")}</DialogTitle></DialogHeader>
              <div className="flex gap-2 -mt-2">
                <button
                  onClick={() => setBulkTab("invoices")}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${bulkTab === "invoices" ? "bg-[#0891B2] text-white" : "bg-[#F8FAFC] text-[#64748B] border border-[#E2E8F0]"}`}
                >
                  {t("Combine Open Invoices")}
                </button>
                <button
                  onClick={() => setBulkTab("jobs")}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${bulkTab === "jobs" ? "bg-[#0891B2] text-white" : "bg-[#F8FAFC] text-[#64748B] border border-[#E2E8F0]"}`}
                >
                  {t("Combine Completed Jobs")}
                </button>
              </div>

              {bulkTab === "invoices" ? (
                <div className="space-y-4 pt-2">
                  <p className="text-xs text-[#64748B]">{t("Pick a customer with open invoices, select the ones to combine, then collect payment on all of them at once.")}</p>
                  <div>
                    <label className="text-sm font-medium text-[#0F172A]">{t("Customer")}</label>
                    <div className="mt-1">
                      <SearchableSelect
                        value={bulkInvoiceCustomerId}
                        onChange={(v) => { setBulkInvoiceCustomerId(v); setBulkInvoiceSelected(new Set()); }}
                        placeholder={t("Select customer")}
                        searchPlaceholder={t("Search customers...")}
                        emptyText={t("No customers with open invoices.")}
                        options={customersWithOpenInvoicesOptions}
                      />
                    </div>
                  </div>
                  {bulkInvoiceCustomerId && (
                    <div>
                      <label className="text-sm font-medium text-[#0F172A]">{t("Open invoices")}</label>
                      <div className="mt-1 space-y-1.5 max-h-56 overflow-y-auto">
                        {openInvoicesForCustomer.map((inv) => (
                          <label key={inv.id} className="flex items-center gap-2 p-2 rounded-lg border border-[#E2E8F0] text-sm cursor-pointer">
                            <input type="checkbox" checked={bulkInvoiceSelected.has(inv.id)} onChange={() => toggleBulkInvoice(inv.id)} />
                            <span className="flex-1">
                              <button type="button" className="text-[#0891B2] hover:underline font-medium" title={t("See the invoice")} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPreviewInvoiceId(inv.id); }}>{inv.number}</button>
                              {" "}— {inv.issue_date}{" "}
                              <Badge className={`${statusColors[inv.status] ?? ""} text-[10px] px-1.5 py-0`}>{t(inv.status)}</Badge>
                            </span>
                            <span className="font-medium text-[#0F172A]">${(inv.total ?? inv.amount).toFixed(2)}</span>
                          </label>
                        ))}
                        {openInvoicesForCustomer.length === 0 && <p className="text-sm text-[#64748B] py-2">{t("No open invoices for this customer.")}</p>}
                      </div>
                    </div>
                  )}
                  {bulkInvoiceSelected.size > 0 && (
                    <>
                      <p className="text-right text-sm font-semibold text-[#0F172A]">
                        {t("Total:")} ${openInvoicesForCustomer.filter((i) => bulkInvoiceSelected.has(i.id)).reduce((s, i) => s + (i.total ?? i.amount), 0).toFixed(2)}
                      </p>
                      <div>
                        <label className="text-sm font-medium text-[#0F172A]">{t("Payment Method")}</label>
                        <div className="grid grid-cols-3 gap-2 mt-1">
                          {(["Card", "Check", "Email"] as const).map((m) => (
                            <button
                              key={m}
                              onClick={() => setBulkPayMethod(m)}
                              className={`py-2 rounded-lg border text-sm font-medium ${bulkPayMethod === m ? "border-[#0891B2] bg-[#0891B2]/10 text-[#0891B2]" : "border-[#E2E8F0] text-[#64748B]"}`}
                            >
                              {m === "Card" ? t("Card on File") : m === "Check" ? t("Manual Check") : t("Email Customer")}
                            </button>
                          ))}
                        </div>
                      </div>
                      {bulkPayMethod === "Card" ? (
                        <CardPaymentForm
                          amount={openInvoicesForCustomer.filter((i) => bulkInvoiceSelected.has(i.id)).reduce((s, i) => s + (i.total ?? i.amount), 0)}
                          onCharge={(opaqueData) => handleBulkCollect(opaqueData)}
                        />
                      ) : (
                        <>
                        {/* Client SMS 2026-10-16 + 2026-10-18 ("accepting a check there is no spot for a check
                            number") -- the field existed but was an unlabeled box; now labelled and focused. */}
                        {bulkPayMethod === "Check" && (
                          <div>
                            <label className="text-sm font-medium text-[#0F172A]">{t("Check #")}</label>
                            <Input autoFocus className="mt-1" placeholder={t("Enter the check number")} value={bulkCheckNumber} onChange={(e) => setBulkCheckNumber(e.target.value)} />
                          </div>
                        )}
                        <Button
                          className="w-full bg-[#0891B2] hover:bg-[#0E7490] text-white"
                          onClick={() => (bulkPayMethod === "Email" ? handleBulkEmail() : handleBulkCollect())}
                          disabled={bulkCollecting}
                        >
                          {bulkPayMethod === "Email" ? (bulkCollecting ? t("Sending...") : t("Email Selected Invoices")) : t("Collect Payment (Check)")}
                        </Button>
                        {bulkPayMethod === "Email" && bulkEmailResult && (
                          <p className={`text-sm ${bulkEmailResult.ok ? "text-[#16A34A]" : "text-[#DC2626]"}`}>{bulkEmailResult.text}</p>
                        )}
                        </>
                      )}
                    </>
                  )}
                </div>
              ) : (
              <div className="space-y-4 pt-2">
                <p className="text-xs text-[#64748B]">{t("Combine several weeks of completed jobs for one customer into a single invoice — one line item per job.")}</p>
                <div>
                  <label className="text-sm font-medium text-[#0F172A]">{t("Customer")}</label>
                  <div className="mt-1">
                    <SearchableSelect value={bulkForm.customerId} onChange={(v) => setBulkForm((p) => ({ ...p, customerId: v }))} placeholder={t("Select customer")} searchPlaceholder={t("Search customers...")} options={customerOptions} showSublabelWhenSelected />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-[#0F172A]">{t("From")}</label>
                    <Input type="date" className="mt-1" value={bulkForm.start} onChange={(e) => setBulkForm((p) => ({ ...p, start: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[#0F172A]">{t("To")}</label>
                    <Input type="date" className="mt-1" value={bulkForm.end} onChange={(e) => setBulkForm((p) => ({ ...p, end: e.target.value }))} />
                  </div>
                </div>
                {bulkForm.customerId && bulkForm.start && bulkForm.end && (
                  <div>
                    <label className="text-sm font-medium text-[#0F172A]">{t("Completed jobs in range")}</label>
                    <div className="mt-1 space-y-1.5 max-h-64 overflow-y-auto">
                      {bulkJobs.length === 0 && (
                        <div className="text-sm text-[#64748B] py-2 space-y-2">
                          <p>{t("No completed jobs without an invoice in this range. A job gets its own invoice automatically when it's completed — to bill several of them together, use Combine Open Invoices.")}</p>
                          <Button type="button" size="sm" variant="outline" onClick={() => { setBulkInvoiceCustomerId(bulkForm.customerId); setBulkInvoiceSelected(new Set()); setBulkTab("invoices"); }}>{t("Combine Open Invoices")}</Button>
                        </div>
                      )}
                      {bulkJobs.map((j) => (
                        <label key={j.id} className="flex items-center gap-2 p-2 rounded-lg border border-[#E2E8F0] text-sm cursor-pointer">
                          <input type="checkbox" checked={bulkSelected.has(j.id)} onChange={() => toggleBulkJob(j.id)} />
                          <span className="flex-1">{j.type} — {j.scheduled_date}</span>
                          <span className="font-medium text-[#0F172A]">${j.amount.toFixed(2)}</span>
                        </label>
                      ))}
                    </div>
                    {bulkJobs.length > 0 && (
                      <p className="text-right text-sm font-semibold text-[#0F172A] mt-2">
                        {t("Total:")} ${bulkJobs.filter((j) => bulkSelected.has(j.id)).reduce((s, j) => s + j.amount, 0).toFixed(2)}
                      </p>
                    )}
                  </div>
                )}
                <Button className="w-full bg-[#0891B2] hover:bg-[#0E7490] text-white" onClick={handleCreateBulkInvoice} disabled={bulkSelected.size === 0}>
                  {t("Create Bulk Invoice")}
                </Button>
              </div>
              )}
            </DialogContent>
          </Dialog>
          <InvoicePreviewDialog invoiceId={previewInvoiceId} onClose={() => setPreviewInvoiceId(null)} />
          <Dialog open={newEstimateOpen} onOpenChange={(open) => (open ? openNewEstimateDialog() : setNewEstimateOpen(false))}>
            <DialogTrigger asChild>
              <Button variant="outline" className="h-10 gap-2 border-[#E2E8F0] text-[#0F172A] bg-white order-1">
                <Copy className="w-4 h-4" /> {t("New Estimate")}
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[90vw] max-w-[90vw] h-[90vh] max-h-[90vh] overflow-y-auto content-start">
              <DialogHeader><DialogTitle>{t("Create New Estimate")}</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                {estimateTemplates.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-[#0F172A]">{t("Apply Template")}</label>
                    <Select onValueChange={applyEstimateTemplate}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder={t("Start from a saved template (optional)")} /></SelectTrigger>
                      <SelectContent>
                        {estimateTemplates.map((tpl) => <SelectItem key={tpl.id} value={tpl.id}>{tpl.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-[#0F172A]">{t("Customer")}</label>
                  <div className="mt-1">
                    <SearchableSelect value={newEstimate.customerId} onChange={(v) => setNewEstimate((p) => ({ ...p, customerId: v }))} placeholder={t("Select customer")} searchPlaceholder={t("Search customers...")} options={customerOptions} showSublabelWhenSelected />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-[#0F172A]">{t("Issue Date")}</label>
                    <Input type="date" className="mt-1" value={newEstimate.issueDate} onChange={(e) => setNewEstimate((p) => ({ ...p, issueDate: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[#0F172A]">{t("Expires")}</label>
                    <Input type="date" className="mt-1" value={newEstimate.expiryDate} onChange={(e) => setNewEstimate((p) => ({ ...p, expiryDate: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-[#0F172A]">{t("Job Description")}</label>
                  <textarea
                    className="mt-1 w-full rounded-lg border border-[#E2E8F0] p-2 text-sm min-h-[60px]"
                    placeholder={t("e.g. Heater Install, Zinc Anode, Check Valve...")}
                    value={newEstimate.jobDescription}
                    onChange={(e) => setNewEstimate((p) => ({ ...p, jobDescription: e.target.value }))}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-[#0F172A]">{t("Line Items")}</label>
                    {newEstimateLines.some((li) => li.description.trim()) && (
                      <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-[#0891B2]" onClick={handleSaveAsTemplate} disabled={savingTemplate}>
                        {savingTemplate ? t("Saving...") : t("Save as Template")}
                      </Button>
                    )}
                  </div>
                  <div className="mt-1">
                    <LineItemsEditor items={newEstimateLines} onChange={setNewEstimateLines} inventoryItems={inventoryItems} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-[#0F172A]">{t("Amount")} {newEstimateLines.length > 0 && <span className="text-xs text-[#64748B]">({t("from line items")})</span>}</label>
                    <Input
                      type="number"
                      className="mt-1"
                      placeholder="0.00"
                      value={newEstimateLines.length > 0 ? newEstimateSubtotal.toFixed(2) : newEstimate.amount}
                      disabled={newEstimateLines.length > 0}
                      onChange={(e) => setNewEstimate((p) => ({ ...p, amount: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[#0F172A]">{t("Down Payment")}</label>
                    <div className="mt-1 flex gap-2">
                      <Input type="number" placeholder="50" value={newEstimate.downPayment} onChange={(e) => setNewEstimate((p) => ({ ...p, downPayment: e.target.value }))} />
                      <div className="flex rounded-lg border border-[#E2E8F0] overflow-hidden shrink-0">
                        <button type="button" onClick={() => setNewEstimateDownPaymentMode("percent")} className={`px-2.5 text-sm font-medium ${newEstimateDownPaymentMode === "percent" ? "bg-[#0891B2] text-white" : "bg-white text-[#64748B]"}`}>%</button>
                        <button type="button" onClick={() => setNewEstimateDownPaymentMode("fixed")} className={`px-2.5 text-sm font-medium ${newEstimateDownPaymentMode === "fixed" ? "bg-[#0891B2] text-white" : "bg-white text-[#64748B]"}`}>$</button>
                      </div>
                    </div>
                    <p className="text-xs text-[#64748B] mt-1">= ${resolveDownPayment(newEstimate.downPayment, newEstimateDownPaymentMode, newEstimateSubtotal).toFixed(2)}</p>
                  </div>
                </div>
                <Button className="w-full bg-[#0891B2] hover:bg-[#0E7490] text-white" onClick={handleCreateEstimate}>
                  {t("Create Estimate")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* QB Connected + Aged Receivables */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className={`lg:col-span-1 border-[#E2E8F0] shadow-sm ${qboConnected ? "bg-[#16A34A]/5" : "bg-[#F59E0B]/5"}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${qboConnected ? "bg-[#16A34A]/10" : "bg-[#F59E0B]/10"}`}>
                <BookOpen className={`w-5 h-5 ${qboConnected ? "text-[#16A34A]" : "text-[#F59E0B]"}`} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm text-[#0F172A]">QuickBooks Online</p>
                  <Badge className={`${qboConnected ? "bg-[#16A34A]/10 text-[#16A34A]" : "bg-[#F59E0B]/10 text-[#F59E0B]"} text-[10px] px-1.5 py-0`}>
                    {qboConnected ? t("Connected") : t("Not Connected")}
                  </Badge>
                </div>
                <p className="text-xs text-[#64748B]">
                  {qboConnected ? t("Sync invoices from each invoice's detail page.") : t("Connect it from Settings > Integrations.")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-[#E2E8F0] shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-[#0F172A]">{t("Aged Receivables")}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-5 gap-2">
              {agedReceivables.map((ar) => (
                <div key={ar.bucket} className="text-center p-3 rounded-lg bg-[#F8FAFC]">
                  <p className="text-xs text-[#64748B]">{ar.bucket}</p>
                  <p className="text-lg font-bold text-[#0F172A]">${money(ar.amount)}</p>
                  <p className="text-xs text-[#64748B]">{ar.count} {t("invoices")}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Outstanding", value: `$${money(totalOutstanding)}`, icon: FileText, color: "text-[#F59E0B]", bg: "bg-[#F59E0B]/10" },
          { label: "Paid This Month", value: `$${money(paidThisMonth)}`, icon: CheckCircle2, color: "text-[#16A34A]", bg: "bg-[#16A34A]/10" },
          { label: "Overdue", value: `$${money(overdue)}`, icon: AlertTriangle, color: "text-[#DC2626]", bg: "bg-[#DC2626]/10" },
          { label: "Avg Days to Pay", value: `${avgDays.toFixed(0)} days`, icon: Clock, color: "text-[#0891B2]", bg: "bg-[#0891B2]/10" },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="bg-white rounded-xl p-4 border border-[#E2E8F0] shadow-sm flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${kpi.bg} flex items-center justify-center shrink-0`}>
                <Icon className={`w-5 h-5 ${kpi.color}`} />
              </div>
              <div>
                <p className="text-xs text-[#64748B]">{t(kpi.label)}</p>
                <p className="text-lg font-bold text-[#0F172A]">{kpi.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {isLoading && <div className="text-center py-8 text-[#64748B]">{t("Loading invoices...")}</div>}

      {!isLoading && (
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* Client PDF 2026-09-05: tab order "Estimates - Tasks - Recurring - Customer Invoices -
            Payments". Vendor Bills moved out entirely (client SMS 2026-09-09) to Inventory >
            Vendor Tools, next to Purchase Orders. */}
        <TabsList className="bg-white border border-[#E2E8F0] h-10 p-1 rounded-lg flex-wrap h-auto">
          <TabsTrigger value="estimates" className="order-1 text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4 gap-1.5">
            <Copy className="w-4 h-4" /> {t("Estimates")}
          </TabsTrigger>
          {/* Client video 2026-10-06: "I would add another tab between estimates and tasks and
              put other reminders right here" -- same customer_reminders data as Reports >
              Reminders / CustomerDetail's Other Reminders card, surfaced where staff already work. */}
          <TabsTrigger value="other-reminders" className="order-2 text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4 gap-1.5">
            <Bell className="w-4 h-4" /> {t("Other Reminders")}
          </TabsTrigger>
          <TabsTrigger value="tasks" className="order-3 text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4 gap-1.5">
            <ClipboardList className="w-4 h-4" /> {t("Tasks")}
          </TabsTrigger>
          <TabsTrigger value="recurring" className="order-4 text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4 gap-1.5">
            <Repeat className="w-4 h-4" /> {t("Recurring")}
          </TabsTrigger>
          <TabsTrigger value="all" className="order-5 text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4 gap-1.5">
            <FileText className="w-4 h-4" /> {t("Customer Invoices")}
          </TabsTrigger>
          <TabsTrigger value="payments" className="order-6 text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4 gap-1.5">
            <CreditCard className="w-4 h-4" /> {t("Payments")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4 space-y-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
            <Input placeholder={t("Search invoice #, customer, description...")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-10 bg-white border-[#E2E8F0]" />
          </div>
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    {(() => { const th = sortHeader(invoiceSort, t); return (<>
                    {th("number", "Invoice #")}{th("customer", "Customer")}{th("job_description", "Description")}{th("issue_date", "Issue Date")}{th("due_date", "Due Date")}
                    {th("amount", "Amount", "right")}{th("status", "Status", "center")}{th("sync", "Sync", "center")}
                  </>); })()}
                    <th className="text-center py-3 px-4 text-xs font-semibold text-[#64748B] uppercase"></th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceSort.sorted.map((inv) => (
                    <tr key={inv.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] cursor-pointer" onClick={() => navigate(`/invoicing/${inv.id}`)}>
                      <td className="py-3 px-4 font-medium text-[#0F172A]">{inv.number}</td>
                      <td className="py-3 px-4 text-[#64748B]">{inv.customers?.name ?? "—"}</td>
                      <td className="py-3 px-4 text-[#64748B] max-w-[220px] truncate">{inv.job_description || "—"}</td>
                      <td className="py-3 px-4 text-[#64748B]">{inv.issue_date}</td>
                      <td className="py-3 px-4 text-[#64748B]">{inv.due_date}</td>
                      <td className="text-right py-3 px-4 font-semibold text-[#0F172A]">${money(inv.total ?? inv.amount)}</td>
                      <td className="text-center py-3 px-4">
                        <Badge className={`${statusColors[inv.status]} text-[10px] px-1.5 py-0`}>{t(inv.status)}</Badge>
                      </td>
                      <td className="text-center py-3 px-4">
                        {inv.qbo_invoice_id ? (
                          <Badge className="bg-[#16A34A]/10 text-[#16A34A] text-[10px] px-1.5 py-0">{t("Synced")}</Badge>
                        ) : (
                          <Badge className="bg-[#F59E0B]/10 text-[#F59E0B] text-[10px] px-1.5 py-0">{t("Not synced")}</Badge>
                        )}
                      </td>
                      <td className="text-center py-3 px-4">
                        <ArrowRight className="w-4 h-4 text-[#64748B]" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="estimates" className="mt-4 space-y-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
            <Input placeholder={t("Search estimate #, customer, status...")} value={estimateSearch} onChange={(e) => setEstimateSearch(e.target.value)} className="pl-9 h-10 bg-white border-[#E2E8F0]" />
          </div>
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    {(() => { const th = sortHeader(estimateSort, t); return (<>
                    {th("number", "Estimate #")}{th("customer", "Customer")}{th("issue_date", "Issue Date")}{th("expiry_date", "Expires")}{th("amount", "Amount", "right")}{th("status", "Status", "center")}
                  </>); })()}
                    <th className="text-center py-3 px-4 text-xs font-semibold text-[#64748B] uppercase"></th>
                  </tr>
                </thead>
                <tbody>
                  {estimateSort.sorted.map((est) => (
                    <tr key={est.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] cursor-pointer" onClick={() => navigate(`/invoicing/estimates/${est.id}`)}>
                      <td className="py-3 px-4 font-medium text-[#0F172A]">{est.number}</td>
                      <td className="py-3 px-4 text-[#64748B]">{est.customers?.name ?? "—"}</td>
                      <td className="py-3 px-4 text-[#64748B]">{est.issue_date}</td>
                      <td className="py-3 px-4 text-[#64748B]">{est.expiry_date ?? "—"}</td>
                      <td className="text-right py-3 px-4 font-semibold text-[#0F172A]">${money(est.total ?? est.amount)}</td>
                      <td className="text-center py-3 px-4">
                        <Badge className={`${statusColors[est.status] ?? "bg-[#F1F5F9] text-[#64748B]"} text-[10px] px-1.5 py-0`}>{t(est.status)}</Badge>
                      </td>
                      <td className="text-center py-3 px-4" onClick={(e) => e.stopPropagation()}>
                        {est.status !== "Converted" ? (
                          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => handleConvertEstimate(est.id)}>
                            {t("Convert to Invoice")}
                          </Button>
                        ) : (
                          <button className="text-xs text-[#0891B2] font-medium hover:underline" onClick={() => navigate(`/invoicing/${est.converted_invoice_id}`)}>
                            {t("View Invoice")}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {estimateSort.sorted.length === 0 && (
                    <tr><td colSpan={7} className="py-8 text-center text-[#64748B]">{estimates.length === 0 ? t("No estimates yet") : t("No matches")}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="other-reminders" className="mt-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center flex-wrap gap-2">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
              <Input placeholder={t("Search customer or reminder...")} value={reminderSearch} onChange={(e) => setReminderSearch(e.target.value)} className="pl-9 h-10 bg-white border-[#E2E8F0]" />
            </div>
            <div className="flex border border-[#E2E8F0] rounded-lg overflow-hidden text-sm">
              {(["30", "60", "90", "all"] as const).map((r) => {
                const active = remindersRange === r;
                return (
                  <button key={r} onClick={() => setRemindersRange(r)} className={`px-3 py-1.5 border-l first:border-l-0 border-[#E2E8F0] ${active ? "bg-[#0891B2] text-white" : "text-[#0F172A] hover:bg-[#F8FAFC]"}`}>
                    {r === "all" ? t("All") : `${r} ${t("days")}`}
                  </button>
                );
              })}
            </div>
            </div>
            <Dialog open={reminderOpen} onOpenChange={(open) => { setReminderOpen(open); if (!open) { setEditingReminderId(null); setReminderDraft({ customerId: "", label: "", frequencyMonths: "", nextDue: "" }); } }}>
              <DialogTrigger asChild>
                <Button className="bg-[#0891B2] hover:bg-[#0E7490] text-white gap-2 h-10"><Plus className="w-4 h-4" /> {t("Add Reminder Type")}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{editingReminderId ? t("Edit Reminder") : t("Add Reminder Type")}</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  {!editingReminderId && (
                    <div>
                      <label className="text-sm font-medium text-[#0F172A]">{t("Customer")}</label>
                      <SearchableSelect value={reminderDraft.customerId} onChange={(v) => setReminderDraft((p) => ({ ...p, customerId: v }))} placeholder={t("Select customer")} searchPlaceholder={t("Search customers...")} options={customerOptions} showSublabelWhenSelected />
                    </div>
                  )}
                  <div><label className="text-sm font-medium text-[#0F172A]">{t("Label")}</label><ReminderLabelSelect value={reminderDraft.label} onChange={(label) => setReminderDraft((p) => ({ ...p, label }))} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-sm font-medium text-[#0F172A]">{t("Frequency (months)")}</label><Input type="number" className="mt-1" placeholder="e.g. 4" value={reminderDraft.frequencyMonths} onChange={(e) => setReminderDraft((p) => ({ ...p, frequencyMonths: e.target.value }))} /></div>
                    <div><label className="text-sm font-medium text-[#0F172A]">{t("Next Due")}</label><Input type="date" className="mt-1" value={reminderDraft.nextDue} onChange={(e) => setReminderDraft((p) => ({ ...p, nextDue: e.target.value }))} /></div>
                  </div>
                  <Button className="w-full bg-[#0891B2] text-white" onClick={handleSaveReminder}>{t("Save")}</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                <tr>
                  {(() => { const th = sortHeader(reminderSort, t); return (<>
                    {th("customer", "Customer")}{th("label", "Reminder Type")}{th("frequency_months", "Frequency")}{th("next_due", "Next Due")}
                  </>); })()}
                  <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">{t("Actions")}</th>
                </tr>
              </thead>
              <tbody>
                {reminderSort.sorted.map((r) => {
                  const overdue = new Date(r.next_due) <= new Date();
                  return (
                    <tr key={r.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] cursor-pointer" onClick={() => handleOpenReminderEdit(r)}>
                      <td className="py-3 px-4 text-[#0F172A] font-medium">{r.customers?.name ?? "—"}</td>
                      <td className="py-3 px-4 text-[#0F172A]">{r.label}</td>
                      <td className="py-3 px-4 text-[#64748B]">{t("every")} {r.frequency_months}{t("mo")}</td>
                      <td className={`py-3 px-4 ${overdue ? "text-[#DC2626] font-medium" : "text-[#64748B]"}`}>{r.next_due}{overdue ? ` · ${t("overdue")}` : ""}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1">
                          {r.customers?.phone && (
                            <a href={`tel:${r.customers.phone}`} onClick={(e) => e.stopPropagation()} className="p-1.5 rounded hover:bg-[#F1F5F9] text-[#0891B2]" title={t("Call")}>
                              <Phone className="w-4 h-4" />
                            </a>
                          )}
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleMarkReminderDone(r.id); }} title={t("Mark Serviced")}>
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleDeleteReminder(r.id); }} title={t("Delete")}>
                            <Trash2 className="w-3.5 h-3.5 text-[#DC2626]" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {reminderSort.sorted.length === 0 && (
                  <tr><td colSpan={5} className="py-8 text-center text-[#64748B]">{reminders.length === 0 ? t("No reminder types set up yet") : t("No reminders due in this range")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="mt-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
              <Input placeholder={t("Search customer, address, tech, type, status...")} value={taskSearch} onChange={(e) => setTaskSearch(e.target.value)} className="pl-9 h-10 bg-white border-[#E2E8F0]" />
            </div>
            <Dialog
              open={newTaskOpen}
              onOpenChange={(open) => {
                setNewTaskOpen(open);
                if (!open) {
                  setEditTask(null);
                  setNewTask({ customerId: "", techId: "", address: "", email: "", type: "Repair", notes: "", startDate: "", endDate: "" });
                  setNewTaskPhotos([]);
                }
              }}
            >
              <DialogTrigger asChild>
                <Button
                  className="bg-[#0891B2] hover:bg-[#0E7490] text-white gap-2 h-10"
                  onClick={() => {
                    setEditTask(null);
                    setNewTask({ customerId: "", techId: "", address: "", email: "", type: "Repair", notes: "", startDate: "", endDate: "" });
                    setNewTaskPhotos([]);
                  }}
                >
                  <Plus className="w-4 h-4" /> {t("New Task")}
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[90vw] max-w-[90vw] h-[90vh] max-h-[90vh] overflow-y-auto content-start">
                <DialogHeader><DialogTitle>{editTask ? t("Edit Task") : t("New Task")}</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <div>
                    <label className="text-sm font-medium text-[#0F172A]">{t("Customer (optional)")}</label>
                    <div className="mt-1">
                      <SearchableSelect
                        value={newTask.customerId}
                        onChange={(v) => {
                          const picked = customers.find((c) => c.id === v);
                          setNewTask((p) => ({ ...p, customerId: v, address: picked?.address ?? p.address, email: picked?.email ?? p.email }));
                        }}
                        placeholder={t("Select customer")}
                        searchPlaceholder={t("Search customers...")}
                        options={customerOptions} showSublabelWhenSelected
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[#0F172A]">{t("Email (optional)")}</label>
                    <Input className="mt-1" value={newTask.email} onChange={(e) => setNewTask((p) => ({ ...p, email: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[#0F172A]">{t("Address")}</label>
                    <AddressAutocomplete className="mt-1" value={newTask.address} onChange={(address) => setNewTask((p) => ({ ...p, address }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-[#0F172A]">{t("Assign Tech")}</label>
                      <Select value={newTask.techId} onValueChange={(v) => setNewTask((p) => ({ ...p, techId: v }))}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder={t("Select tech")} /></SelectTrigger>
                        <SelectContent>{techs.map((tech) => <SelectItem key={tech.id} value={tech.id}>{tech.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-[#0F172A]">{t("Type")}</label>
                      <Select value={newTask.type} onValueChange={(v) => setNewTask((p) => ({ ...p, type: v }))}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Renovation">{t("Renovation")}</SelectItem>
                          <SelectItem value="Repair">{t("Repair")}</SelectItem>
                          <SelectItem value="Go back">{t("Go back")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-[#0F172A]">{t("Start Date")}</label>
                      <Input type="date" className="mt-1" value={newTask.startDate} onChange={(e) => setNewTask((p) => ({ ...p, startDate: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-[#0F172A]">{t("End Date")}</label>
                      <Input type="date" className="mt-1" value={newTask.endDate} onChange={(e) => setNewTask((p) => ({ ...p, endDate: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[#0F172A]">{t("Notes")}</label>
                    <textarea
                      className="mt-1 w-full rounded-lg border border-[#E2E8F0] p-2 text-sm min-h-[60px]"
                      value={newTask.notes}
                      onChange={(e) => setNewTask((p) => ({ ...p, notes: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[#0F172A] flex items-center gap-1.5"><Camera className="w-4 h-4" /> {t("Photos")}</label>
                    <input type="file" accept="image/*" multiple className="mt-1 text-sm" onChange={handleTaskPhotoSelect} disabled={taskPhotoUploading} />
                    {newTaskPhotos.length > 0 && (
                      <div className="grid grid-cols-4 gap-2 mt-2">
                        {newTaskPhotos.map((url, i) => (
                          <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-[#F1F5F9]">
                            <img src={url} alt="Task" className="w-full h-full object-cover" />
                            <button
                              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center"
                              onClick={() => setNewTaskPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button className="w-full bg-[#0891B2] hover:bg-[#0E7490] text-white" onClick={handleSaveTask}>{editTask ? t("Save Changes") : t("Save Task")}</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    {(() => { const th = sortHeader(taskSort, t); return (<>
                    {th("type", "Type")}{th("customer", "Customer")}{th("address", "Address")}{th("tech", "Tech")}{th("start_date", "Dates")}{th("photos", "Photos", "center")}{th("status", "Status", "center")}
                  </>); })()}
                    <th className="text-center py-3 px-4 text-xs font-semibold text-[#64748B] uppercase"></th>
                  </tr>
                </thead>
                <tbody>
                  {taskSort.sorted.map((task) => (
                    <tr key={task.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="py-3 px-4 font-medium text-[#0F172A]">{t(task.type)}</td>
                      <td className="py-3 px-4 text-[#64748B]">{task.customers?.name ?? "—"}</td>
                      <td className="py-3 px-4 text-[#64748B] max-w-[180px] truncate">{task.address ?? "—"}</td>
                      <td className="py-3 px-4 text-[#64748B]">{task.profiles?.name ?? t("Unassigned")}</td>
                      <td className="py-3 px-4 text-[#64748B]">{task.start_date ?? "—"}{task.end_date ? ` → ${task.end_date}` : ""}</td>
                      <td className="text-center py-3 px-4 text-[#64748B]">{task.photos?.length ?? 0}</td>
                      <td className="text-center py-3 px-4">
                        <Select value={task.status} onValueChange={(v) => handleTaskStatusChange(task.id, v)}>
                          <SelectTrigger className="h-8 w-[120px] text-xs mx-auto"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Open">{t("Open")}</SelectItem>
                            <SelectItem value="In Progress">{t("In Progress")}</SelectItem>
                            <SelectItem value="Done">{t("Done")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="text-center py-3 px-4">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditTask(task)}>
                          <Pencil className="w-3.5 h-3.5 text-[#64748B]" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {taskSort.sorted.length === 0 && (
                    <tr><td colSpan={8} className="py-8 text-center text-[#64748B]">{tasks.length === 0 ? t("No tasks yet") : t("No matches")}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="recurring" className="mt-4 space-y-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
            <Input placeholder={t("Search customer, frequency, status...")} value={recurringSearch} onChange={(e) => setRecurringSearch(e.target.value)} className="pl-9 h-10 bg-white border-[#E2E8F0]" />
          </div>
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    {(() => { const th = sortHeader(recurringSort, t); return (<>
                    {th("customer", "Customer")}{th("frequency", "Frequency")}{th("amount", "Amount", "right")}{th("next_charge", "Next Charge")}{th("status", "Status", "center")}
                  </>); })()}
                  </tr>
                </thead>
                <tbody>
                  {recurringSort.sorted.map((rb) => (
                    <tr key={rb.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="py-3 px-4 font-medium text-[#0F172A]">{rb.customers?.name ?? "—"}</td>
                      <td className="py-3 px-4 text-[#64748B]">{t(rb.frequency)}</td>
                      <td className="text-right py-3 px-4 font-semibold text-[#0F172A]">${rb.amount}</td>
                      <td className="py-3 px-4 text-[#64748B]">{rb.next_charge}</td>
                      <td className="text-center py-3 px-4">
                        <Badge className="bg-[#16A34A]/10 text-[#16A34A] text-[10px] px-1.5 py-0">{t(rb.status)}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="payments" className="mt-4 space-y-3">
          {/* Client SMS 2026-09-21: search Payments by customer name, amount or date. */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
            <Input placeholder={t("Search by customer, amount, or date...")} value={paymentSearch} onChange={(e) => setPaymentSearch(e.target.value)} className="pl-9 h-10 bg-white border-[#E2E8F0]" />
          </div>
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    {(() => { const th = sortHeader(paymentSort, t); return (<>
                    {th("invoice", "Invoice")}{th("customer", "Customer")}{th("amount", "Amount", "right")}{th("paid_at", "Date")}{th("method", "Method")}{th("status", "Status", "center")}
                  </>); })()}
                  </tr>
                </thead>
                <tbody>
                  {paymentSort.sorted.map((pay) => {
                    const method = paymentMethods[pay.method ?? ""] || { icon: CreditCard, label: pay.method ?? "—" };
                    const MethodIcon = method.icon;
                    return (
                      <tr key={pay.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]">
                        <td className="py-3 px-4 font-medium text-[#0F172A]">{pay.invoices?.number ?? "—"}</td>
                        <td className="py-3 px-4 text-[#64748B]">{pay.customers?.name ?? "—"}</td>
                        <td className="text-right py-3 px-4 font-semibold text-[#0F172A]">${pay.amount}</td>
                        <td className="py-3 px-4 text-[#64748B]">{pay.paid_at}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <MethodIcon className="w-4 h-4 text-[#0891B2]" />
                            <span className="text-sm text-[#0F172A]">{t(method.label)}</span>
                          </div>
                        </td>
                        <td className="text-center py-3 px-4">
                          <Badge className="bg-[#16A34A]/10 text-[#16A34A] text-[10px] px-1.5 py-0">{t(pay.status)}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
      )}
    </div>
  );
}
