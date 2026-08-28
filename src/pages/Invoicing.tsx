import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, Plus, BookOpen, CreditCard, Repeat, CheckCircle2, Clock, AlertTriangle, FileText, ArrowRight, Copy, Truck, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { invoicingApi, type Estimate, type VendorBill } from "@/lib/api/invoicing";
import { customersApi } from "@/lib/api/customers";
import { inventoryApi, type ItemWithStock } from "@/lib/api/inventory";
import { settingsApi } from "@/lib/api/settings";
import { jobsApi } from "@/lib/api/jobs";
import LineItemsEditor, { type DraftLineItem } from "@/components/LineItemsEditor";
import type { Database } from "@/lib/database.types";

type Invoice = Database["public"]["Tables"]["invoices"]["Row"] & { customers: { name: string } | null };
type UninvoicedJob = Database["public"]["Tables"]["jobs"]["Row"];
type RecurringBilling = Database["public"]["Tables"]["recurring_billing"]["Row"] & { customers: { name: string } | null };
type Payment = Database["public"]["Tables"]["payments"]["Row"] & { invoices: { number: string } | null; customers: { name: string } | null };
type Customer = { id: string; name: string };
type Supplier = { id: string; name: string };

const statusColors: Record<string, string> = {
  Draft: "bg-[#F59E0B]/10 text-[#F59E0B]",
  Sent: "bg-[#0891B2]/10 text-[#0891B2]",
  Paid: "bg-[#16A34A]/10 text-[#16A34A]",
  Overdue: "bg-[#DC2626]/10 text-[#DC2626]",
};

const paymentMethods: Record<string, { icon: typeof CreditCard; label: string }> = {
  Card: { icon: CreditCard, label: "Card" },
  ACH: { icon: FileText, label: "ACH" },
};

const daysBetween = (a: string, b: string) => Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86400000);

export default function Invoicing() {
  const [search, setSearch] = useState("");
  const [newInvoiceOpen, setNewInvoiceOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [recurringBilling, setRecurringBilling] = useState<RecurringBilling[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [newInvoice, setNewInvoice] = useState({ customerId: "", issueDate: "", dueDate: "", amount: "", downPayment: "", jobDescription: "" });
  const [newInvoiceLines, setNewInvoiceLines] = useState<DraftLineItem[]>([]);
  const [qboConnected, setQboConnected] = useState(false);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [vendorBills, setVendorBills] = useState<VendorBill[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [inventoryItems, setInventoryItems] = useState<ItemWithStock[]>([]);
  const [newEstimateOpen, setNewEstimateOpen] = useState(false);
  const [newEstimate, setNewEstimate] = useState({ customerId: "", issueDate: "", expiryDate: "", amount: "", downPayment: "", jobDescription: "" });
  const [newEstimateLines, setNewEstimateLines] = useState<DraftLineItem[]>([]);
  const [newBillOpen, setNewBillOpen] = useState(false);
  const [newBill, setNewBill] = useState({ supplierId: "", number: "", issueDate: "", dueDate: "", amount: "" });
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => (searchParams.get("tab") === "estimates" ? "estimates" : "all"));
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkForm, setBulkForm] = useState({ customerId: "", start: "", end: "" });
  const [bulkJobs, setBulkJobs] = useState<UninvoicedJob[]>([]);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  useEffect(() => {
    if (searchParams.get("tab") === "estimates") setActiveTab("estimates");
  }, [searchParams]);

  const loadInvoicing = useCallback(async () => {
    setIsLoading(true);
    const [invoicesData, recurringData, paymentsData, customersData, settingsData, estimatesData, vendorBillsData, suppliersData, inventoryData] = await Promise.all([
      invoicingApi.list(),
      invoicingApi.recurringBilling(),
      invoicingApi.payments(),
      customersApi.list(),
      settingsApi.all(),
      invoicingApi.estimates(),
      invoicingApi.vendorBills(),
      inventoryApi.suppliers(),
      inventoryApi.summary(),
    ]);
    setInvoices((invoicesData ?? []) as Invoice[]);
    setRecurringBilling((recurringData ?? []) as RecurringBilling[]);
    setPayments((paymentsData ?? []) as Payment[]);
    setCustomers(customersData ?? []);
    setQboConnected(settingsData.integrations.some((i) => i.provider === "quickbooks" && i.status === "Connected"));
    setEstimates((estimatesData ?? []) as Estimate[]);
    setVendorBills((vendorBillsData ?? []) as VendorBill[]);
    setSuppliers(suppliersData ?? []);
    setInventoryItems(inventoryData?.items ?? []);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadInvoicing();
  }, [loadInvoicing]);

  const handleCreateInvoice = async () => {
    if (!newInvoice.customerId || !newInvoice.issueDate) return;
    const number = `INV-${newInvoice.issueDate.replace(/-/g, "")}-${String(invoices.length + 1).padStart(3, "0")}`;
    await invoicingApi.create({
      customerId: newInvoice.customerId,
      number,
      issueDate: newInvoice.issueDate,
      dueDate: newInvoice.dueDate || null,
      amount: parseFloat(newInvoice.amount) || 0,
      status: "Draft",
      downPayment: parseFloat(newInvoice.downPayment) || 0,
      jobDescription: newInvoice.jobDescription || null,
      lineItems: newInvoiceLines.filter((li) => li.description.trim()),
    });
    setNewInvoice({ customerId: "", issueDate: "", dueDate: "", amount: "", downPayment: "", jobDescription: "" });
    setNewInvoiceLines([]);
    setNewInvoiceOpen(false);
    loadInvoicing();
  };

  const handleCreateEstimate = async () => {
    if (!newEstimate.customerId || !newEstimate.issueDate) return;
    const number = `EST-${newEstimate.issueDate.replace(/-/g, "")}-${String(estimates.length + 1).padStart(3, "0")}`;
    await invoicingApi.createEstimate({
      customerId: newEstimate.customerId,
      number,
      issueDate: newEstimate.issueDate,
      expiryDate: newEstimate.expiryDate || null,
      amount: parseFloat(newEstimate.amount) || 0,
      downPayment: parseFloat(newEstimate.downPayment) || 0,
      jobDescription: newEstimate.jobDescription || null,
      lineItems: newEstimateLines.filter((li) => li.description.trim()),
    });
    setNewEstimate({ customerId: "", issueDate: "", expiryDate: "", amount: "", downPayment: "", jobDescription: "" });
    setNewEstimateLines([]);
    setNewEstimateOpen(false);
    loadInvoicing();
  };

  const handleConvertEstimate = async (id: string) => {
    const { invoiceId } = await invoicingApi.convertEstimateToInvoice(id);
    await loadInvoicing();
    navigate(`/invoicing/${invoiceId}`);
  };

  const handleCreateBill = async () => {
    if (!newBill.supplierId || !newBill.number || !newBill.issueDate) return;
    await invoicingApi.createVendorBill({
      supplierId: newBill.supplierId,
      number: newBill.number,
      issueDate: newBill.issueDate,
      dueDate: newBill.dueDate || null,
      amount: parseFloat(newBill.amount) || 0,
    });
    setNewBill({ supplierId: "", number: "", issueDate: "", dueDate: "", amount: "" });
    setNewBillOpen(false);
    loadInvoicing();
  };

  const handleMarkBillPaid = async (id: string) => {
    await invoicingApi.markVendorBillPaid(id);
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

  const handleCreateBulkInvoice = async () => {
    const selectedJobs = bulkJobs.filter((j) => bulkSelected.has(j.id));
    if (!bulkForm.customerId || selectedJobs.length === 0) return;
    const number = `INV-${bulkForm.end.replace(/-/g, "")}-${String(invoices.length + 1).padStart(3, "0")}`;
    const invoice = await invoicingApi.create({
      customerId: bulkForm.customerId,
      number,
      issueDate: bulkForm.end,
      dueDate: null,
      amount: 0,
      status: "Draft",
      lineItems: selectedJobs.map((j) => ({
        description: `${j.type} — ${j.scheduled_date ?? j.created_at.slice(0, 10)}`,
        quantity: 1,
        rate: j.amount,
      })),
    });
    setBulkForm({ customerId: "", start: "", end: "" });
    setBulkOpen(false);
    await loadInvoicing();
    navigate(`/invoicing/${invoice.id}`);
  };

  const filtered = invoices.filter((inv) =>
    inv.number.toLowerCase().includes(search.toLowerCase()) ||
    (inv.customers?.name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const totalOutstanding = invoices.filter((i) => i.status !== "Paid").reduce((sum, i) => sum + i.amount, 0);
  const paidThisMonth = invoices.filter((i) => i.status === "Paid").reduce((sum, i) => sum + i.amount, 0);
  const overdue = invoices.filter((i) => i.status === "Overdue").reduce((sum, i) => sum + i.amount, 0);
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
    return { bucket: b.bucket, amount: matching.reduce((sum, i) => sum + i.amount, 0), count: matching.length };
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-[#0F172A]">Invoicing</h1>
        <div className="flex items-center gap-2">
          <Dialog open={newInvoiceOpen} onOpenChange={setNewInvoiceOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#0891B2] hover:bg-[#0E7490] text-white gap-2 h-10">
                <Plus className="w-4 h-4" /> New Invoice
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Create New Invoice</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-sm font-medium text-[#0F172A]">Customer</label>
                  <Select value={newInvoice.customerId} onValueChange={(v) => setNewInvoice((p) => ({ ...p, customerId: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select customer" /></SelectTrigger>
                    <SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-[#0F172A]">Issue Date</label>
                    <Input type="date" className="mt-1" value={newInvoice.issueDate} onChange={(e) => setNewInvoice((p) => ({ ...p, issueDate: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[#0F172A]">Due Date</label>
                    <Input type="date" className="mt-1" value={newInvoice.dueDate} onChange={(e) => setNewInvoice((p) => ({ ...p, dueDate: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-[#0F172A]">Job Description</label>
                  <textarea
                    className="mt-1 w-full rounded-lg border border-[#E2E8F0] p-2 text-sm min-h-[60px]"
                    placeholder="e.g. Heater Install, Zinc Anode, Check Valve..."
                    value={newInvoice.jobDescription}
                    onChange={(e) => setNewInvoice((p) => ({ ...p, jobDescription: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-[#0F172A]">Line Items</label>
                  <div className="mt-1">
                    <LineItemsEditor items={newInvoiceLines} onChange={setNewInvoiceLines} inventoryItems={inventoryItems} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-[#0F172A]">Amount {newInvoiceLines.length > 0 && <span className="text-xs text-[#64748B]">(from line items)</span>}</label>
                    <Input
                      type="number"
                      className="mt-1"
                      placeholder="0.00"
                      value={newInvoiceLines.length > 0 ? newInvoiceLines.reduce((s, li) => s + li.quantity * li.rate, 0).toFixed(2) : newInvoice.amount}
                      disabled={newInvoiceLines.length > 0}
                      onChange={(e) => setNewInvoice((p) => ({ ...p, amount: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[#0F172A]">Down Payment</label>
                    <Input type="number" className="mt-1" placeholder="0.00" value={newInvoice.downPayment} onChange={(e) => setNewInvoice((p) => ({ ...p, downPayment: e.target.value }))} />
                  </div>
                </div>
                <Button className="w-full bg-[#0891B2] hover:bg-[#0E7490] text-white" onClick={handleCreateInvoice}>
                  Create Invoice
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="h-10 gap-2 border-[#E2E8F0] text-[#0F172A] bg-white">
                <Layers className="w-4 h-4" /> Bulk Invoice
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Bulk Invoice</DialogTitle></DialogHeader>
              <p className="text-xs text-[#64748B] -mt-2">Combine several weeks of completed jobs for one customer into a single invoice — one line item per job.</p>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-sm font-medium text-[#0F172A]">Customer</label>
                  <Select value={bulkForm.customerId} onValueChange={(v) => setBulkForm((p) => ({ ...p, customerId: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select customer" /></SelectTrigger>
                    <SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-[#0F172A]">From</label>
                    <Input type="date" className="mt-1" value={bulkForm.start} onChange={(e) => setBulkForm((p) => ({ ...p, start: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[#0F172A]">To</label>
                    <Input type="date" className="mt-1" value={bulkForm.end} onChange={(e) => setBulkForm((p) => ({ ...p, end: e.target.value }))} />
                  </div>
                </div>
                {bulkForm.customerId && bulkForm.start && bulkForm.end && (
                  <div>
                    <label className="text-sm font-medium text-[#0F172A]">Completed jobs in range</label>
                    <div className="mt-1 space-y-1.5 max-h-64 overflow-y-auto">
                      {bulkJobs.length === 0 && <p className="text-sm text-[#64748B] py-2">No uninvoiced completed jobs in this range.</p>}
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
                        Total: ${bulkJobs.filter((j) => bulkSelected.has(j.id)).reduce((s, j) => s + j.amount, 0).toFixed(2)}
                      </p>
                    )}
                  </div>
                )}
                <Button className="w-full bg-[#0891B2] hover:bg-[#0E7490] text-white" onClick={handleCreateBulkInvoice} disabled={bulkSelected.size === 0}>
                  Create Bulk Invoice
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={newEstimateOpen} onOpenChange={setNewEstimateOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="h-10 gap-2 border-[#E2E8F0] text-[#0F172A] bg-white">
                <Copy className="w-4 h-4" /> New Estimate
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Create New Estimate</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-sm font-medium text-[#0F172A]">Customer</label>
                  <Select value={newEstimate.customerId} onValueChange={(v) => setNewEstimate((p) => ({ ...p, customerId: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select customer" /></SelectTrigger>
                    <SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-[#0F172A]">Issue Date</label>
                    <Input type="date" className="mt-1" value={newEstimate.issueDate} onChange={(e) => setNewEstimate((p) => ({ ...p, issueDate: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[#0F172A]">Expires</label>
                    <Input type="date" className="mt-1" value={newEstimate.expiryDate} onChange={(e) => setNewEstimate((p) => ({ ...p, expiryDate: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-[#0F172A]">Job Description</label>
                  <textarea
                    className="mt-1 w-full rounded-lg border border-[#E2E8F0] p-2 text-sm min-h-[60px]"
                    placeholder="e.g. Heater Install, Zinc Anode, Check Valve..."
                    value={newEstimate.jobDescription}
                    onChange={(e) => setNewEstimate((p) => ({ ...p, jobDescription: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-[#0F172A]">Line Items</label>
                  <div className="mt-1">
                    <LineItemsEditor items={newEstimateLines} onChange={setNewEstimateLines} inventoryItems={inventoryItems} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-[#0F172A]">Amount {newEstimateLines.length > 0 && <span className="text-xs text-[#64748B]">(from line items)</span>}</label>
                    <Input
                      type="number"
                      className="mt-1"
                      placeholder="0.00"
                      value={newEstimateLines.length > 0 ? newEstimateLines.reduce((s, li) => s + li.quantity * li.rate, 0).toFixed(2) : newEstimate.amount}
                      disabled={newEstimateLines.length > 0}
                      onChange={(e) => setNewEstimate((p) => ({ ...p, amount: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[#0F172A]">Down Payment</label>
                    <Input type="number" className="mt-1" placeholder="0.00" value={newEstimate.downPayment} onChange={(e) => setNewEstimate((p) => ({ ...p, downPayment: e.target.value }))} />
                  </div>
                </div>
                <Button className="w-full bg-[#0891B2] hover:bg-[#0E7490] text-white" onClick={handleCreateEstimate}>
                  Create Estimate
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={newBillOpen} onOpenChange={setNewBillOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="h-10 gap-2 border-[#E2E8F0] text-[#0F172A] bg-white">
                <Plus className="w-4 h-4" /> New Vendor Bill
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader><DialogTitle>Create New Vendor Bill</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-sm font-medium text-[#0F172A]">Supplier</label>
                  <Select value={newBill.supplierId} onValueChange={(v) => setNewBill((p) => ({ ...p, supplierId: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select supplier" /></SelectTrigger>
                    <SelectContent>{suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-[#0F172A]">Bill Number</label>
                  <Input className="mt-1" placeholder="BILL-1001" value={newBill.number} onChange={(e) => setNewBill((p) => ({ ...p, number: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-[#0F172A]">Issue Date</label>
                    <Input type="date" className="mt-1" value={newBill.issueDate} onChange={(e) => setNewBill((p) => ({ ...p, issueDate: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[#0F172A]">Due Date</label>
                    <Input type="date" className="mt-1" value={newBill.dueDate} onChange={(e) => setNewBill((p) => ({ ...p, dueDate: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-[#0F172A]">Amount</label>
                  <Input type="number" className="mt-1" placeholder="0.00" value={newBill.amount} onChange={(e) => setNewBill((p) => ({ ...p, amount: e.target.value }))} />
                </div>
                <Button className="w-full bg-[#0891B2] hover:bg-[#0E7490] text-white" onClick={handleCreateBill}>
                  Create Vendor Bill
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
                    {qboConnected ? "Connected" : "Not Connected"}
                  </Badge>
                </div>
                <p className="text-xs text-[#64748B]">
                  {qboConnected ? "Sync invoices from each invoice's detail page." : "Connect it from Settings > Integrations."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-[#E2E8F0] shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-[#0F172A]">Aged Receivables</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-5 gap-2">
              {agedReceivables.map((ar) => (
                <div key={ar.bucket} className="text-center p-3 rounded-lg bg-[#F8FAFC]">
                  <p className="text-xs text-[#64748B]">{ar.bucket}</p>
                  <p className="text-lg font-bold text-[#0F172A]">${ar.amount.toLocaleString()}</p>
                  <p className="text-xs text-[#64748B]">{ar.count} invoices</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Outstanding", value: `$${totalOutstanding.toLocaleString()}`, icon: FileText, color: "text-[#F59E0B]", bg: "bg-[#F59E0B]/10" },
          { label: "Paid This Month", value: `$${paidThisMonth.toLocaleString()}`, icon: CheckCircle2, color: "text-[#16A34A]", bg: "bg-[#16A34A]/10" },
          { label: "Overdue", value: `$${overdue.toLocaleString()}`, icon: AlertTriangle, color: "text-[#DC2626]", bg: "bg-[#DC2626]/10" },
          { label: "Avg Days to Pay", value: `${avgDays.toFixed(0)} days`, icon: Clock, color: "text-[#0891B2]", bg: "bg-[#0891B2]/10" },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="bg-white rounded-xl p-4 border border-[#E2E8F0] shadow-sm flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${kpi.bg} flex items-center justify-center shrink-0`}>
                <Icon className={`w-5 h-5 ${kpi.color}`} />
              </div>
              <div>
                <p className="text-xs text-[#64748B]">{kpi.label}</p>
                <p className="text-lg font-bold text-[#0F172A]">{kpi.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {isLoading && <div className="text-center py-8 text-[#64748B]">Loading invoices...</div>}

      {!isLoading && (
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-white border border-[#E2E8F0] h-10 p-1 rounded-lg">
          <TabsTrigger value="all" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4 gap-1.5">
            <FileText className="w-4 h-4" /> Customer Invoices
          </TabsTrigger>
          <TabsTrigger value="estimates" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4 gap-1.5">
            <Copy className="w-4 h-4" /> Estimates
          </TabsTrigger>
          <TabsTrigger value="vendor-bills" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4 gap-1.5">
            <Truck className="w-4 h-4" /> Vendor Bills
          </TabsTrigger>
          <TabsTrigger value="recurring" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4 gap-1.5">
            <Repeat className="w-4 h-4" /> Recurring
          </TabsTrigger>
          <TabsTrigger value="payments" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4 gap-1.5">
            <CreditCard className="w-4 h-4" /> Payments
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4 space-y-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
            <Input placeholder="Search invoices..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-10 bg-white border-[#E2E8F0]" />
          </div>
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Invoice #</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Customer</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Issue Date</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Due Date</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Amount</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Status</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Sync</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-[#64748B] uppercase"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((inv) => (
                    <tr key={inv.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] cursor-pointer" onClick={() => navigate(`/invoicing/${inv.id}`)}>
                      <td className="py-3 px-4 font-medium text-[#0F172A]">{inv.number}</td>
                      <td className="py-3 px-4 text-[#64748B]">{inv.customers?.name ?? "—"}</td>
                      <td className="py-3 px-4 text-[#64748B]">{inv.issue_date}</td>
                      <td className="py-3 px-4 text-[#64748B]">{inv.due_date}</td>
                      <td className="text-right py-3 px-4 font-semibold text-[#0F172A]">${inv.amount.toLocaleString()}</td>
                      <td className="text-center py-3 px-4">
                        <Badge className={`${statusColors[inv.status]} text-[10px] px-1.5 py-0`}>{inv.status}</Badge>
                      </td>
                      <td className="text-center py-3 px-4">
                        {inv.qbo_invoice_id ? (
                          <Badge className="bg-[#16A34A]/10 text-[#16A34A] text-[10px] px-1.5 py-0">Synced</Badge>
                        ) : (
                          <Badge className="bg-[#F59E0B]/10 text-[#F59E0B] text-[10px] px-1.5 py-0">Not synced</Badge>
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

        <TabsContent value="estimates" className="mt-4">
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Estimate #</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Customer</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Issue Date</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Expires</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Amount</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Status</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-[#64748B] uppercase"></th>
                  </tr>
                </thead>
                <tbody>
                  {estimates.map((est) => (
                    <tr key={est.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] cursor-pointer" onClick={() => navigate(`/invoicing/estimates/${est.id}`)}>
                      <td className="py-3 px-4 font-medium text-[#0F172A]">{est.number}</td>
                      <td className="py-3 px-4 text-[#64748B]">{est.customers?.name ?? "—"}</td>
                      <td className="py-3 px-4 text-[#64748B]">{est.issue_date}</td>
                      <td className="py-3 px-4 text-[#64748B]">{est.expiry_date ?? "—"}</td>
                      <td className="text-right py-3 px-4 font-semibold text-[#0F172A]">${est.amount.toLocaleString()}</td>
                      <td className="text-center py-3 px-4">
                        <Badge className={`${statusColors[est.status] ?? "bg-[#F1F5F9] text-[#64748B]"} text-[10px] px-1.5 py-0`}>{est.status}</Badge>
                      </td>
                      <td className="text-center py-3 px-4" onClick={(e) => e.stopPropagation()}>
                        {est.status !== "Converted" ? (
                          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => handleConvertEstimate(est.id)}>
                            Convert to Invoice
                          </Button>
                        ) : (
                          <button className="text-xs text-[#0891B2] font-medium hover:underline" onClick={() => navigate(`/invoicing/${est.converted_invoice_id}`)}>
                            View Invoice
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {estimates.length === 0 && (
                    <tr><td colSpan={7} className="py-8 text-center text-[#64748B]">No estimates yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="vendor-bills" className="mt-4">
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Bill #</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Vendor</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Issue Date</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Due Date</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Amount</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Status</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-[#64748B] uppercase"></th>
                  </tr>
                </thead>
                <tbody>
                  {vendorBills.map((bill) => (
                    <tr key={bill.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="py-3 px-4 font-medium text-[#0F172A]">{bill.number}</td>
                      <td className="py-3 px-4 text-[#64748B]">{bill.suppliers?.name ?? "—"}</td>
                      <td className="py-3 px-4 text-[#64748B]">{bill.issue_date}</td>
                      <td className="py-3 px-4 text-[#64748B]">{bill.due_date ?? "—"}</td>
                      <td className="text-right py-3 px-4 font-semibold text-[#0F172A]">${bill.amount.toLocaleString()}</td>
                      <td className="text-center py-3 px-4">
                        <Badge className={`${statusColors[bill.status] ?? "bg-[#F1F5F9] text-[#64748B]"} text-[10px] px-1.5 py-0`}>{bill.status}</Badge>
                      </td>
                      <td className="text-center py-3 px-4">
                        {bill.status !== "Paid" && (
                          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => handleMarkBillPaid(bill.id)}>
                            Mark Paid
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {vendorBills.length === 0 && (
                    <tr><td colSpan={7} className="py-8 text-center text-[#64748B]">No vendor bills yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="recurring" className="mt-4">
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Customer</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Frequency</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Amount</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Next Charge</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recurringBilling.map((rb) => (
                    <tr key={rb.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="py-3 px-4 font-medium text-[#0F172A]">{rb.customers?.name ?? "—"}</td>
                      <td className="py-3 px-4 text-[#64748B]">{rb.frequency}</td>
                      <td className="text-right py-3 px-4 font-semibold text-[#0F172A]">${rb.amount}</td>
                      <td className="py-3 px-4 text-[#64748B]">{rb.next_charge}</td>
                      <td className="text-center py-3 px-4">
                        <Badge className="bg-[#16A34A]/10 text-[#16A34A] text-[10px] px-1.5 py-0">{rb.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Invoice</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Customer</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Amount</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Date</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Method</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((pay) => {
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
                            <span className="text-sm text-[#0F172A]">{method.label}</span>
                          </div>
                        </td>
                        <td className="text-center py-3 px-4">
                          <Badge className="bg-[#16A34A]/10 text-[#16A34A] text-[10px] px-1.5 py-0">{pay.status}</Badge>
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
