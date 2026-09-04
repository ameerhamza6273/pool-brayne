import { useState, useEffect, useCallback } from "react";
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

// Client request 2026-09-02 ("Need a reports section"): item movement, customer deposits,
// invoices total-due per customer, recurring reminder-job types, inventory valuation, plus the
// sales-tax report that already existed on the POS page (reused here from the same endpoint).
export default function Reports() {
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-[#0F172A]">Reports</h1>
        <div className="flex items-center gap-2">
          <Input type="date" className="h-9 w-auto" value={start} onChange={(e) => setStart(e.target.value)} />
          <span className="text-[#64748B] text-sm">to</span>
          <Input type="date" className="h-9 w-auto" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>

      {isLoading && <div className="text-center py-8 text-[#64748B]">Loading reports...</div>}

      {!isLoading && (
      <Tabs defaultValue="sales-tax" className="w-full">
        <TabsList className="bg-white border border-[#E2E8F0] h-10 p-1 rounded-lg flex-wrap h-auto">
          <TabsTrigger value="sales-tax" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4 gap-1.5"><Receipt className="w-4 h-4" /> Sales Tax</TabsTrigger>
          <TabsTrigger value="movement" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4 gap-1.5"><Package className="w-4 h-4" /> Item Movement</TabsTrigger>
          <TabsTrigger value="deposits" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4 gap-1.5"><DollarSign className="w-4 h-4" /> Deposits</TabsTrigger>
          <TabsTrigger value="due" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4 gap-1.5"><FileText className="w-4 h-4" /> Invoices Due</TabsTrigger>
          <TabsTrigger value="reminders" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4 gap-1.5"><Bell className="w-4 h-4" /> Reminders</TabsTrigger>
          <TabsTrigger value="valuation" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4 gap-1.5"><Warehouse className="w-4 h-4" /> Inventory Valuation</TabsTrigger>
        </TabsList>

        <TabsContent value="sales-tax" className="mt-4">
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-5 max-w-md space-y-3">
            <p className="text-xs font-semibold text-[#64748B] uppercase">Sales Tax Report (POS sales only — job invoices don't track tax separately)</p>
            <div className="flex justify-between text-sm"><span className="text-[#64748B]">Orders</span><span className="font-medium text-[#0F172A]">{salesTax?.taxSummary.orderCount ?? 0}</span></div>
            <div className="flex justify-between text-sm"><span className="text-[#64748B]">Taxable Sales</span><span className="font-medium text-[#0F172A]">${(salesTax?.taxSummary.taxableSales ?? 0).toFixed(2)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-[#64748B]">Tax Collected</span><span className="font-medium text-[#0F172A]">${(salesTax?.taxSummary.taxCollected ?? 0).toFixed(2)}</span></div>
            <div className="flex justify-between text-sm pt-2 border-t border-[#E2E8F0]"><span className="font-semibold text-[#0F172A]">Total Sales</span><span className="font-bold text-[#0891B2]">${(salesTax?.taxSummary.totalSales ?? 0).toFixed(2)}</span></div>
          </div>
        </TabsContent>

        <TabsContent value="movement" className="mt-4">
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Product</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">SKU</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Movement Type</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {movement.map((m, i) => (
                    <tr key={i} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="py-3 px-4 font-medium text-[#0F172A]">{m.name}</td>
                      <td className="py-3 px-4 text-[#64748B]">{m.sku}</td>
                      <td className="py-3 px-4 text-[#64748B]">{m.movement_type}</td>
                      <td className="text-right py-3 px-4 text-[#0F172A]">{m.qty}</td>
                    </tr>
                  ))}
                  {movement.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-[#64748B]">No movement in this date range</td></tr>}
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
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Invoice #</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Customer</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Issue Date</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Deposit</th>
                  </tr>
                </thead>
                <tbody>
                  {deposits.map((d, i) => (
                    <tr key={i} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="py-3 px-4 font-medium text-[#0F172A]">{d.number}</td>
                      <td className="py-3 px-4 text-[#64748B]">{d.customers?.name ?? "—"}</td>
                      <td className="py-3 px-4 text-[#64748B]">{d.issue_date}</td>
                      <td className="text-right py-3 px-4 font-semibold text-[#0F172A]">${Number(d.down_payment).toFixed(2)}</td>
                    </tr>
                  ))}
                  {deposits.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-[#64748B]">No deposits in this date range</td></tr>}
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
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Customer</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Open Invoices</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Total Due</th>
                  </tr>
                </thead>
                <tbody>
                  {invoicesDue.map((r) => (
                    <tr key={r.customer_id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]">
                      <td className="py-3 px-4 font-medium text-[#0F172A]">{r.customer_name}</td>
                      <td className="text-right py-3 px-4 text-[#0F172A]">{r.invoice_count}</td>
                      <td className="text-right py-3 px-4 font-semibold text-[#0F172A]">${Number(r.total_due).toFixed(2)}</td>
                    </tr>
                  ))}
                  {invoicesDue.length === 0 && <tr><td colSpan={3} className="py-8 text-center text-[#64748B]">No customers with open invoices</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="reminders" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Dialog open={reminderOpen} onOpenChange={setReminderOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#0891B2] hover:bg-[#0E7490] text-white gap-2 h-10"><Plus className="w-4 h-4" /> Add Reminder Type</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Reminder Type</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <div>
                    <Label>Customer</Label>
                    <div className="mt-1">
                      <SearchableSelect
                        value={newReminder.customerId}
                        onChange={(v) => setNewReminder((p) => ({ ...p, customerId: v }))}
                        placeholder="Select customer"
                        searchPlaceholder="Search customers..."
                        options={customers.map((c) => ({ value: c.id, label: c.name }))}
                      />
                    </div>
                  </div>
                  <div><Label>Label</Label><Input className="mt-1" placeholder="e.g. Filter Cleaning" value={newReminder.label} onChange={(e) => setNewReminder((p) => ({ ...p, label: e.target.value }))} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Frequency (months)</Label><Input type="number" className="mt-1" placeholder="e.g. 4" value={newReminder.frequencyMonths} onChange={(e) => setNewReminder((p) => ({ ...p, frequencyMonths: e.target.value }))} /></div>
                    <div><Label>Next Due</Label><Input type="date" className="mt-1" value={newReminder.nextDue} onChange={(e) => setNewReminder((p) => ({ ...p, nextDue: e.target.value }))} /></div>
                  </div>
                  <Button className="w-full bg-[#0891B2] text-white" onClick={handleAddReminder}>Save</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Customer</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Reminder Type</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Frequency</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Next Due</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-[#64748B] uppercase"></th>
                  </tr>
                </thead>
                <tbody>
                  {reminders.map((r) => {
                    const overdue = r.next_due <= today;
                    return (
                      <tr key={r.id} className={`border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] ${overdue ? "bg-[#DC2626]/5" : ""}`}>
                        <td className="py-3 px-4 font-medium text-[#0F172A]">{r.customers?.name ?? "—"}</td>
                        <td className="py-3 px-4 text-[#64748B]">{r.label}</td>
                        <td className="py-3 px-4 text-[#64748B]">every {r.frequency_months} months</td>
                        <td className={`py-3 px-4 font-medium ${overdue ? "text-[#DC2626]" : "text-[#0F172A]"}`}>{r.next_due}{overdue ? " (overdue)" : ""}</td>
                        <td className="text-center py-3 px-4">
                          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs border-[#E2E8F0]" onClick={() => handleMarkReminderDone(r.id)}>
                            <CheckCircle2 className="w-3.5 h-3.5" /> Mark Done
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {reminders.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-[#64748B]">No reminder types set up yet</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="valuation" className="mt-4 space-y-3">
          <p className="text-xs text-[#64748B]">Historical stock snapshots aren't tracked, so this reflects current on-hand quantities, not a true point-in-time valuation as of the date range above.</p>
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Product</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">SKU</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Qty</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Unit Cost</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748B] uppercase">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {valuation.map((v, i) => (
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
            <div className="px-4 py-3 border-t border-[#E2E8F0] text-sm font-semibold text-[#0F172A] text-right">
              Total Inventory Value: ${totalValuation.toFixed(2)}
            </div>
          </div>
        </TabsContent>
      </Tabs>
      )}
    </div>
  );
}
