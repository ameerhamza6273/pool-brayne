import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Plus, BookOpen, CreditCard, Repeat, CheckCircle2, Clock, AlertTriangle, FileText, ArrowRight, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { invoices, recurringBilling, payments, agedReceivables } from "@/lib/data";

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

export default function Invoicing() {
  const [search, setSearch] = useState("");
  const [newInvoiceOpen, setNewInvoiceOpen] = useState(false);
  const navigate = useNavigate();

  const filtered = invoices.filter((inv) =>
    inv.number.toLowerCase().includes(search.toLowerCase()) ||
    inv.customer.toLowerCase().includes(search.toLowerCase())
  );

  const totalOutstanding = invoices.filter((i) => i.status !== "Paid").reduce((sum, i) => sum + i.amount, 0);
  const paidThisMonth = invoices.filter((i) => i.status === "Paid").reduce((sum, i) => sum + i.amount, 0);
  const overdue = invoices.filter((i) => i.status === "Overdue").reduce((sum, i) => sum + i.amount, 0);
  const avgDays = invoices.filter((i) => i.daysToPay !== null).reduce((sum, i) => sum + (i.daysToPay || 0), 0) / invoices.filter((i) => i.daysToPay !== null).length;

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
            <DialogContent className="sm:max-w-lg">
              <DialogHeader><DialogTitle>Create New Invoice</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-sm font-medium text-[#0F172A]">Customer</label>
                  <Input className="mt-1" placeholder="Search customer..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-[#0F172A]">Issue Date</label>
                    <Input type="date" className="mt-1" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[#0F172A]">Due Date</label>
                    <Input type="date" className="mt-1" />
                  </div>
                </div>
                <Button className="w-full bg-[#0891B2] hover:bg-[#0E7490] text-white" onClick={() => setNewInvoiceOpen(false)}>
                  Create Invoice
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="outline" className="h-10 gap-2 border-[#E2E8F0] text-[#0F172A] bg-white">
            <Copy className="w-4 h-4" /> Duplicate Estimate
          </Button>
        </div>
      </div>

      {/* QB Connected + Aged Receivables */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1 border-[#E2E8F0] shadow-sm bg-[#16A34A]/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#16A34A]/10 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-[#16A34A]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm text-[#0F172A]">QuickBooks Online</p>
                  <Badge className="bg-[#16A34A]/10 text-[#16A34A] text-[10px] px-1.5 py-0">Connected</Badge>
                </div>
                <p className="text-xs text-[#64748B]">Two-way sync active. Last synced 4 min ago.</p>
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

      {/* Tabs */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="bg-white border border-[#E2E8F0] h-10 p-1 rounded-lg">
          <TabsTrigger value="all" className="text-sm data-[state=active]:bg-[#0891B2] data-[state=active]:text-white rounded-md px-4 gap-1.5">
            <FileText className="w-4 h-4" /> All Invoices
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
                      <td className="py-3 px-4 text-[#64748B]">{inv.customer}</td>
                      <td className="py-3 px-4 text-[#64748B]">{inv.issueDate}</td>
                      <td className="py-3 px-4 text-[#64748B]">{inv.dueDate}</td>
                      <td className="text-right py-3 px-4 font-semibold text-[#0F172A]">${inv.amount.toLocaleString()}</td>
                      <td className="text-center py-3 px-4">
                        <Badge className={`${statusColors[inv.status]} text-[10px] px-1.5 py-0`}>{inv.status}</Badge>
                      </td>
                      <td className="text-center py-3 px-4">
                        <Badge className="bg-[#16A34A]/10 text-[#16A34A] text-[10px] px-1.5 py-0">Synced</Badge>
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
                      <td className="py-3 px-4 font-medium text-[#0F172A]">{rb.customer}</td>
                      <td className="py-3 px-4 text-[#64748B]">{rb.frequency}</td>
                      <td className="text-right py-3 px-4 font-semibold text-[#0F172A]">${rb.amount}</td>
                      <td className="py-3 px-4 text-[#64748B]">{rb.nextCharge}</td>
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
                    const method = paymentMethods[pay.method] || { icon: CreditCard, label: pay.method };
                    const MethodIcon = method.icon;
                    return (
                      <tr key={pay.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC]">
                        <td className="py-3 px-4 font-medium text-[#0F172A]">{pay.invoice}</td>
                        <td className="py-3 px-4 text-[#64748B]">{pay.customer}</td>
                        <td className="text-right py-3 px-4 font-semibold text-[#0F172A]">${pay.amount}</td>
                        <td className="py-3 px-4 text-[#64748B]">{pay.date}</td>
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
    </div>
  );
}
