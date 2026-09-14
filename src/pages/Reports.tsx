import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Package, DollarSign, FileText, Bell, Warehouse, Plus, CheckCircle2, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/SearchableSelect";
import { reportsApi, type ItemMovementRow, type DepositRow, type InvoiceDueRow, type CustomerReminder, type ValuationRow } from "@/lib/api/reports";
import { posApi, type SalesReport } from "@/lib/api/pos";
import { customersApi } from "@/lib/api/customers";
import { useLanguage } from "@/lib/language-context";

// Client request 2026-09-02 ("Need a reports section"): item movement, customer deposits,
// invoices total-due per customer, recurring reminder-job types, inventory valuation, plus the
// sales-tax report that already existed on the POS page (reused here from the same endpoint).
const reportTabs = ["sales-tax", "movement", "deposits", "due", "reminders", "valuation"];

// Client meeting 2026-09: "a lot of these reports here may be a way to sort these reports by
// clicking higher to lower." Generic click-to-sort for every report table on this page.
function useSort<T>(rows: T[], getValue: (row: T, key: string) => string | number | null) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const sorted = sortKey
    ? [...rows].sort((a, b) => {
        const av = getValue(a, sortKey);
        const bv = getValue(b, sortKey);
        if (av == null) return 1;
        if (bv == null) return -1;
        const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
        return sortDir === "asc" ? cmp : -cmp;
      })
    : rows;
  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };
  return { sorted, sortKey, sortDir, toggleSort };
}

function SortTh({ label, sortKey, active, dir, onClick, align = "left" }: {
  label: string; sortKey: string; active: string | null; dir: "asc" | "desc";
  onClick: (key: string) => void; align?: "left" | "right" | "center";
}) {
  const isActive = active === sortKey;
  return (
    <th
      className={`py-3 px-4 text-xs font-semibold text-[#64748B] uppercase cursor-pointer select-none hover:text-[#0891B2] ${align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"}`}
      onClick={() => onClick(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive && <span className="text-[10px]">{dir === "asc" ? "▲" : "▼"}</span>}
      </span>
    </th>
  );
}

export default function Reports() {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => {
    const tab = searchParams.get("tab");
    return tab && reportTabs.includes(tab) ? tab : "sales-tax";
  });
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && reportTabs.includes(tab)) setActiveTab(tab);
  }, [searchParams]);

  const [start, setStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [end, setEnd] = useState(() => new Date().toISOString().slice(0, 10));

  const [salesTax, setSalesTax] = useState<SalesReport | null>(null);
  const [movement, setMovement] = useState<ItemMovementRow[]>([]);
  const [deposits, setDeposits] = useState<DepositRow[]>([]);
  const [invoicesDue, setInvoicesDue] = useState<InvoiceDueRow[]>([]);
  const [reminders, setReminders] = useState<CustomerReminder[]>([]);
  const [valuation, setValuation] = useState<ValuationRow[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [reminderOpen, setReminderOpen] = useState(false);
  const [newReminder, setNewReminder] = useState({ customerId: "", label: "", frequencyMonths: "", nextDue: "" });

  const load = useCallback(async () => {
    setIsLoading(true);
    const [taxData, movementData, depositsData, dueData, remindersData, valuationData, customersData] = await Promise.all([
      posApi.reports(start, end),
      reportsApi.itemMovement(start, end),
      reportsApi.deposits(start, end),
      reportsApi.invoicesDue(),
      reportsApi.reminders(),
      reportsApi.inventoryValuation(),
      customersApi.list(),
    ]);
    setSalesTax(taxData);
    setMovement(movementData ?? []);
    setDeposits(depositsData ?? []);
    setInvoicesDue(dueData ?? []);
    setReminders(remindersData ?? []);
    setValuation(valuationData ?? []);
    setCustomers((customersData ?? []).map((c) => ({ id: c.id, name: c.name })));
    setIsLoading(false);
  }, [start, end]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAddReminder = async () => {
    if (!newReminder.customerId || !newReminder.label || !newReminder.frequencyMonths || !newReminder.nextDue) return;
    await reportsApi.addReminder({
      customerId: newReminder.customerId,
      label: newReminder.label,
      frequencyMonths: parseInt(newReminder.frequencyMonths, 10),
      nextDue: newReminder.nextDue,
    });
    setNewReminder({ customerId: "", label: "", frequencyMonths: "", nextDue: "" });
    setReminderOpen(false);
    load();
  };

  const handleMarkReminderDone = async (id: string) => {
    await reportsApi.markReminderDone(id);
    load();
  };

  const today = new Date().toISOString().slice(0, 10);
  const totalValuation = valuation.reduce((s, v) => s + Number(v.value), 0);

  const movementSort = useSort(movement, (m, key) => (m as unknown as Record<string, string | number | null>)[key]);
  const depositsSort = useSort(deposits, (d, key) => key === "customer" ? d.customers?.name ?? null : (d as unknown as Record<string, string | number | null>)[key]);
  const invoicesDueSort = useSort(invoicesDue, (r, key) => (r as unknown as Record<string, string | number | null>)[key]);
  const remindersSort = useSort(reminders, (r, key) => key === "customer" ? r.customers?.name ?? null : (r as unknown as Record<string, string | number | null>)[key]);
  const valuationSort = useSort(valuation, (v, key) => (v as unknown as Record<string, string | number | null>)[key]);

  // Client request 2026-09-04: this report rendered all 2,600+ inventory items unpaginated.
  const [valuationPage, setValuationPage] = useState(1);
  const VALUATION_PAGE_SIZE = 50;
  const valuationTotalPages = Math.max(1, Math.ceil(valuation.length / VALUATION_PAGE_SIZE));
  const paginatedValuation = valuationSort.sorted.slice((valuationPage - 1) * VALUATION_PAGE_SIZE, valuationPage * VALUATION_PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-[#0F172A]">{t("Reports")}</h1>
        <div className="flex items-center gap-2">
          <Input type="date" className="h-9 w-auto" value={start} onChange={(e) => setStart(e.target.value)} />
          <span className="text-[#64748B] text-sm">{t("to")}</span>
          <Input type="date" className="h-9 w-auto" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>

      {isLoading && <div className="text-center py-8 text-[#64748B]">{t("Loading reports...")}</div>}

      {!isLoading && (
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-white border border-[#E2E8F0] h-10 p-1 rounded-lg flex-wrap h-auto">
          <TabsTrigger value="sales-tax" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4 gap-1.5"><Receipt className="w-4 h-4" /> {t("Sales Tax")}</TabsTrigger>
          <TabsTrigger value="movement" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4 gap-1.5"><Package className="w-4 h-4" /> {t("Item Movement")}</TabsTrigger>
          <TabsTrigger value="deposits" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4 gap-1.5"><DollarSign className="w-4 h-4" /> {t("Deposits")}</TabsTrigger>
          <TabsTrigger value="due" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4 gap-1.5"><FileText className="w-4 h-4" /> {t("Invoices Due")}</TabsTrigger>
          <TabsTrigger value="reminders" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4 gap-1.5"><Bell className="w-4 h-4" /> {t("Reminders")}</TabsTrigger>
          <TabsTrigger value="valuation" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4 gap-1.5"><Warehouse className="w-4 h-4" /> {t("Inventory Valuation")}</TabsTrigger>
        </TabsList>

        <TabsContent value="sales-tax" className="mt-4">
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-5 max-w-md space-y-3">
            <p className="text-xs font-semibold text-[#64748B] uppercase">{t("Sales Tax Report (POS sales only — job invoices don't track tax separately)")}</p>
            <div className="flex justify-between text-sm"><span className="text-[#64748B]">{t("Orders")}</span><span className="font-medium text-[#0F172A]">{salesTax?.taxSummary.orderCount ?? 0}</span></div>
            <div className="flex justify-between text-sm"><span className="text-[#64748B]">{t("Taxable Sales")}</span><span className="font-medium text-[#0F172A]">${(salesTax?.taxSummary.taxableSales ?? 0).toFixed(2)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-[#64748B]">{t("Tax Collected")}</span><span className="font-medium text-[#0F172A]">${(salesTax?.taxSummary.taxCollected ?? 0).toFixed(2)}</span></div>
            <div className="flex justify-between text-sm pt-2 border-t border-[#E2E8F0]"><span className="font-semibold text-[#0F172A]">{t("Total Sales")}</span><span className="font-bold text-[#0891B2]">${(salesTax?.taxSummary.totalSales ?? 0).toFixed(2)}</span></div>
          </div>
        </TabsContent>

        <TabsContent value="movement" className="mt-4">
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <SortTh label={t("Product")} sortKey="name" active={movementSort.sortKey} dir={movementSort.sortDir} onClick={movementSort.toggleSort} />
                    <SortTh label="SKU" sortKey="sku" active={movementSort.sortKey} dir={movementSort.sortDir} onClick={movementSort.toggleSort} />
                    <SortTh label={t("Movement Type")} sortKey="movement_type" active={movementSort.sortKey} dir={movementSort.sortDir} onClick={movementSort.toggleSort} />
                    <SortTh label={t("Qty")} sortKey="qty" active={movementSort.sortKey} dir={movementSort.sortDir} onClick={movementSort.toggleSort} align="right" />
                  </tr>
                </thead>
                <tbody>
                  {movementSort.sorted.map((m, i) => (
                    <tr key={i} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="py-3 px-4 font-medium text-[#0F172A]">{m.name}</td>
                      <td className="py-3 px-4 text-[#64748B]">{m.sku}</td>
                      <td className="py-3 px-4 text-[#64748B]">{m.movement_type}</td>
                      <td className="text-right py-3 px-4 text-[#0F172A]">{m.qty}</td>
                    </tr>
                  ))}
                  {movement.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-[#64748B]">{t("No movement in this date range")}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="deposits" className="mt-4">
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <SortTh label={t("Invoice #")} sortKey="number" active={depositsSort.sortKey} dir={depositsSort.sortDir} onClick={depositsSort.toggleSort} />
                    <SortTh label={t("Customer")} sortKey="customer" active={depositsSort.sortKey} dir={depositsSort.sortDir} onClick={depositsSort.toggleSort} />
                    <SortTh label={t("Issue Date")} sortKey="issue_date" active={depositsSort.sortKey} dir={depositsSort.sortDir} onClick={depositsSort.toggleSort} />
                    <SortTh label={t("Deposit")} sortKey="down_payment" active={depositsSort.sortKey} dir={depositsSort.sortDir} onClick={depositsSort.toggleSort} align="right" />
                  </tr>
                </thead>
                <tbody>
                  {depositsSort.sorted.map((d, i) => (
                    <tr key={i} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="py-3 px-4 font-medium text-[#0F172A]">{d.number}</td>
                      <td className="py-3 px-4 text-[#64748B]">{d.customers?.name ?? "—"}</td>
                      <td className="py-3 px-4 text-[#64748B]">{d.issue_date}</td>
                      <td className="text-right py-3 px-4 font-semibold text-[#0F172A]">${Number(d.down_payment).toFixed(2)}</td>
                    </tr>
                  ))}
                  {deposits.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-[#64748B]">{t("No deposits in this date range")}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="due" className="mt-4">
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <SortTh label={t("Customer")} sortKey="customer_name" active={invoicesDueSort.sortKey} dir={invoicesDueSort.sortDir} onClick={invoicesDueSort.toggleSort} />
                    <SortTh label={t("Open Invoices")} sortKey="invoice_count" active={invoicesDueSort.sortKey} dir={invoicesDueSort.sortDir} onClick={invoicesDueSort.toggleSort} align="right" />
                    <SortTh label={t("Total Due")} sortKey="total_due" active={invoicesDueSort.sortKey} dir={invoicesDueSort.sortDir} onClick={invoicesDueSort.toggleSort} align="right" />
                  </tr>
                </thead>
                <tbody>
                  {invoicesDueSort.sorted.map((r) => (
                    <tr key={r.customer_id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="py-3 px-4 font-medium text-[#0F172A]">{r.customer_name}</td>
                      <td className="text-right py-3 px-4 text-[#0F172A]">{r.invoice_count}</td>
                      <td className="text-right py-3 px-4 font-semibold text-[#0F172A]">${Number(r.total_due).toFixed(2)}</td>
                    </tr>
                  ))}
                  {invoicesDue.length === 0 && <tr><td colSpan={3} className="py-8 text-center text-[#64748B]">{t("No customers with open invoices")}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="reminders" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Dialog open={reminderOpen} onOpenChange={setReminderOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#0891B2] hover:bg-[#0E7490] text-white gap-2 h-10"><Plus className="w-4 h-4" /> {t("Add Reminder Type")}</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{t("Add Reminder Type")}</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <div>
                    <Label>{t("Customer")}</Label>
                    <div className="mt-1">
                      <SearchableSelect
                        value={newReminder.customerId}
                        onChange={(v) => setNewReminder((p) => ({ ...p, customerId: v }))}
                        placeholder={t("Select customer")}
                        searchPlaceholder={t("Search customers...")}
                        options={customers.map((c) => ({ value: c.id, label: c.name }))}
                      />
                    </div>
                  </div>
                  <div><Label>{t("Label")}</Label><Input className="mt-1" placeholder={t("e.g. Filter Cleaning")} value={newReminder.label} onChange={(e) => setNewReminder((p) => ({ ...p, label: e.target.value }))} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>{t("Frequency (months)")}</Label><Input type="number" className="mt-1" placeholder="e.g. 4" value={newReminder.frequencyMonths} onChange={(e) => setNewReminder((p) => ({ ...p, frequencyMonths: e.target.value }))} /></div>
                    <div><Label>{t("Next Due")}</Label><Input type="date" className="mt-1" value={newReminder.nextDue} onChange={(e) => setNewReminder((p) => ({ ...p, nextDue: e.target.value }))} /></div>
                  </div>
                  <Button className="w-full bg-[#0891B2] text-white" onClick={handleAddReminder}>{t("Save")}</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <SortTh label={t("Customer")} sortKey="customer" active={remindersSort.sortKey} dir={remindersSort.sortDir} onClick={remindersSort.toggleSort} />
                    <SortTh label={t("Reminder Type")} sortKey="label" active={remindersSort.sortKey} dir={remindersSort.sortDir} onClick={remindersSort.toggleSort} />
                    <SortTh label={t("Frequency")} sortKey="frequency_months" active={remindersSort.sortKey} dir={remindersSort.sortDir} onClick={remindersSort.toggleSort} />
                    <SortTh label={t("Next Due")} sortKey="next_due" active={remindersSort.sortKey} dir={remindersSort.sortDir} onClick={remindersSort.toggleSort} />
                    <th className="text-center py-3 px-4 text-xs font-semibold text-[#64748B] uppercase"></th>
                  </tr>
                </thead>
                <tbody>
                  {remindersSort.sorted.map((r) => {
                    const overdue = r.next_due <= today;
                    return (
                      <tr key={r.id} className={`border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] ${overdue ? "bg-[#DC2626]/5" : ""}`}>
                        <td className="py-3 px-4 font-medium text-[#0F172A]">{r.customers?.name ?? "—"}</td>
                        <td className="py-3 px-4 text-[#64748B]">{r.label}</td>
                        <td className="py-3 px-4 text-[#64748B]">{t("every")} {r.frequency_months} {t("months")}</td>
                        <td className={`py-3 px-4 font-medium ${overdue ? "text-[#DC2626]" : "text-[#0F172A]"}`}>{r.next_due}{overdue ? ` (${t("overdue")})` : ""}</td>
                        <td className="text-center py-3 px-4">
                          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs border-[#E2E8F0]" onClick={() => handleMarkReminderDone(r.id)}>
                            <CheckCircle2 className="w-3.5 h-3.5" /> {t("Mark Done")}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {reminders.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-[#64748B]">{t("No reminder types set up yet")}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="valuation" className="mt-4 space-y-3">
          <p className="text-xs text-[#64748B]">{t("Historical stock snapshots aren't tracked, so this reflects current on-hand quantities, not a true point-in-time valuation as of the date range above.")}</p>
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <SortTh label={t("Product")} sortKey="name" active={valuationSort.sortKey} dir={valuationSort.sortDir} onClick={valuationSort.toggleSort} />
                    <SortTh label="SKU" sortKey="sku" active={valuationSort.sortKey} dir={valuationSort.sortDir} onClick={valuationSort.toggleSort} />
                    <SortTh label={t("Qty")} sortKey="quantity" active={valuationSort.sortKey} dir={valuationSort.sortDir} onClick={valuationSort.toggleSort} align="right" />
                    <SortTh label={t("Unit Cost")} sortKey="unit_cost" active={valuationSort.sortKey} dir={valuationSort.sortDir} onClick={valuationSort.toggleSort} align="right" />
                    <SortTh label={t("Value")} sortKey="value" active={valuationSort.sortKey} dir={valuationSort.sortDir} onClick={valuationSort.toggleSort} align="right" />
                  </tr>
                </thead>
                <tbody>
                  {paginatedValuation.map((v, i) => (
                    <tr key={i} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="py-3 px-4 font-medium text-[#0F172A]">{v.name}</td>
                      <td className="py-3 px-4 text-[#64748B]">{v.sku}</td>
                      <td className="text-right py-3 px-4 text-[#0F172A]">{v.quantity}</td>
                      <td className="text-right py-3 px-4 text-[#0F172A]">${Number(v.unit_cost).toFixed(2)}</td>
                      <td className="text-right py-3 px-4 font-semibold text-[#0F172A]">${Number(v.value).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {valuation.length > 0 && (
              <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#E2E8F0] text-sm">
                <p className="text-[#64748B] text-xs">
                  {(valuationPage - 1) * VALUATION_PAGE_SIZE + 1}–{Math.min(valuationPage * VALUATION_PAGE_SIZE, valuation.length)} {t("of")} {valuation.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="h-7 text-xs border-[#E2E8F0]" disabled={valuationPage <= 1} onClick={() => setValuationPage((p) => p - 1)}>
                    {t("Previous")}
                  </Button>
                  <span className="text-[#64748B] text-xs">{t("Page")} {valuationPage} {t("of")} {valuationTotalPages}</span>
                  <Button variant="outline" size="sm" className="h-7 text-xs border-[#E2E8F0]" disabled={valuationPage >= valuationTotalPages} onClick={() => setValuationPage((p) => p + 1)}>
                    {t("Next")}
                  </Button>
                </div>
              </div>
            )}
            <div className="px-4 py-3 border-t border-[#E2E8F0] text-sm font-semibold text-[#0F172A] text-right">
              {t("Total Inventory Value")}: ${totalValuation.toFixed(2)}
            </div>
          </div>
        </TabsContent>
      </Tabs>
      )}
    </div>
  );
}
