import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Mail, MessageSquare, CreditCard, FileText, BadgeCheck, Wrench, Hammer, Droplets } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { invoicingApi } from "@/lib/api/invoicing";
import type { Database } from "@/lib/database.types";

type Invoice = Database["public"]["Tables"]["invoices"]["Row"] & { customers: { name: string; address: string | null } | null };
type LineItem = Database["public"]["Tables"]["invoice_line_items"]["Row"];

const statusColors: Record<string, string> = {
  Draft: "bg-[#F59E0B]/10 text-[#F59E0B]",
  Sent: "bg-[#0891B2]/10 text-[#0891B2]",
  Paid: "bg-[#16A34A]/10 text-[#16A34A]",
  Overdue: "bg-[#DC2626]/10 text-[#DC2626]",
};

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [payOpen, setPayOpen] = useState(false);
  const [qboSyncing, setQboSyncing] = useState(false);
  const [qboError, setQboError] = useState<string | null>(null);

  const loadInvoice = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const bundle = await invoicingApi.detail(id);
      setInvoice(bundle.invoice as Invoice);
      setLineItems(bundle.lineItems);
    } catch {
      setInvoice(null);
    }
    setIsLoading(false);
  }, [id]);

  useEffect(() => {
    loadInvoice();
  }, [loadInvoice]);

  if (isLoading) {
    return <div className="text-center py-20 text-[#64748B]">Loading invoice...</div>;
  }

  if (!invoice) {
    return (
      <div className="text-center py-20">
        <p className="text-[#64748B]">Invoice not found</p>
        <Button onClick={() => navigate("/invoicing")} className="mt-4 bg-[#0891B2] text-white">Back to Invoicing</Button>
      </div>
    );
  }

  const items: { description: string; quantity: number; rate: number; amount: number }[] =
    lineItems.length > 0
      ? lineItems
      : [{ description: `${invoice.status === "Draft" ? "Service" : "Weekly Maintenance"} - ${invoice.customers?.name ?? ""}`, quantity: 1, rate: invoice.amount, amount: invoice.amount }];
  const subtotal = items.reduce((sum, li) => sum + li.amount, 0);
  const tax = subtotal * 0.0825;
  const total = subtotal + tax;

  const handleCollectPayment = async (method: "Card" | "ACH") => {
    if (!id) return;
    await invoicingApi.collectPayment(id, method);
    setPayOpen(false);
    loadInvoice();
  };

  const handleSyncToQuickbooks = async () => {
    if (!id) return;
    setQboSyncing(true);
    setQboError(null);
    try {
      await invoicingApi.syncToQuickbooks(id);
      await loadInvoice();
    } catch (err) {
      setQboError(err instanceof Error ? err.message : "QuickBooks sync failed");
    }
    setQboSyncing(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/invoicing")} className="p-2 rounded-lg hover:bg-[#F8FAFC] text-[#64748B]">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <h1 className="text-xl font-bold text-[#0F172A]">{invoice.number}</h1>
            <Badge className={`${statusColors[invoice.status]} text-[10px] px-1.5 py-0`}>{invoice.status}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {invoice.status !== "Paid" && (
          <Dialog open={payOpen} onOpenChange={setPayOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#16A34A] hover:bg-[#15803D] text-white gap-2 h-9">
                <CreditCard className="w-4 h-4" /> Collect Payment
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Collect Payment</DialogTitle></DialogHeader>
              <Tabs defaultValue="card">
                <TabsList className="w-full">
                  <TabsTrigger value="card" className="flex-1">Card</TabsTrigger>
                  <TabsTrigger value="ach" className="flex-1">ACH</TabsTrigger>
                </TabsList>
                <TabsContent value="card" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Card Number</label>
                    <div className="h-10 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] flex items-center px-3 text-sm text-[#64748B]">
                      **** **** **** 4242
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Expiry</label>
                      <div className="h-10 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] flex items-center px-3 text-sm text-[#64748B]">12/25</div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">CVC</label>
                      <div className="h-10 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] flex items-center px-3 text-sm text-[#64748B]">***</div>
                    </div>
                  </div>
                  <Button className="w-full bg-[#16A34A] text-white" onClick={() => handleCollectPayment("Card")}>Pay ${total.toFixed(2)}</Button>
                </TabsContent>
                <TabsContent value="ach" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Bank Account</label>
                    <div className="h-10 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] flex items-center px-3 text-sm text-[#64748B]">
                      **** **** **** 9876
                    </div>
                  </div>
                  <Button className="w-full bg-[#16A34A] text-white" onClick={() => handleCollectPayment("ACH")}>Pay ${total.toFixed(2)} via ACH</Button>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
          )}
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="h-9 gap-2 border-[#E2E8F0] text-[#0F172A]">
          <Mail className="w-4 h-4 text-[#0891B2]" /> Send via Email
        </Button>
        <Button variant="outline" className="h-9 gap-2 border-[#E2E8F0] text-[#0F172A]">
          <MessageSquare className="w-4 h-4 text-[#0891B2]" /> Send via SMS
        </Button>
        <Button variant="outline" className="h-9 gap-2 border-[#E2E8F0] text-[#0F172A]" onClick={() => window.print()}>
          <Download className="w-4 h-4 text-[#0891B2]" /> Download PDF
        </Button>
        <div className="ml-auto flex items-center gap-2">
          {invoice.qbo_invoice_id ? (
            <>
              <BadgeCheck className="w-4 h-4 text-[#16A34A]" />
              <span className="text-xs text-[#64748B]">Synced to QuickBooks</span>
            </>
          ) : (
            <Button variant="outline" size="sm" className="h-8 border-[#E2E8F0] text-[#0F172A]" onClick={handleSyncToQuickbooks} disabled={qboSyncing}>
              <BadgeCheck className="w-4 h-4 text-[#0891B2]" /> {qboSyncing ? "Syncing..." : "Sync to QuickBooks"}
            </Button>
          )}
        </div>
      </div>
      {qboError && <div className="text-xs text-red-600 -mt-2">{qboError}</div>}

      {/* Invoice Document */}
      <Card className="border-[#E2E8F0] shadow-sm">
        <CardContent className="p-6 lg:p-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-lg bg-[#0891B2] flex items-center justify-center">
                  <FileText className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-xl font-bold text-[#0F172A]">ClearPool</h2>
              </div>
              <p className="text-sm text-[#64748B]">Bryan's Pool Co</p>
              <p className="text-sm text-[#64748B]">Austin, TX 78701</p>
              <p className="text-sm text-[#64748B]">(512) 555-1000</p>
            </div>
            <div className="text-right">
              <h3 className="text-2xl font-bold text-[#0F172A]">INVOICE</h3>
              <p className="text-sm text-[#64748B]">{invoice.number}</p>
              <div className="mt-2">
                <Badge className={`${statusColors[invoice.status]} text-[10px] px-2 py-0.5`}>{invoice.status}</Badge>
              </div>
            </div>
          </div>

          {/* Bill To */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8 p-4 rounded-lg bg-[#F8FAFC]">
            <div>
              <p className="text-xs font-semibold text-[#64748B] uppercase mb-1">Bill To</p>
              <p className="font-medium text-[#0F172A]">{invoice.customers?.name ?? "—"}</p>
              <p className="text-sm text-[#64748B]">{invoice.customers?.address ?? "Austin, TX"}</p>
            </div>
            <div className="sm:text-right">
              <p className="text-xs font-semibold text-[#64748B] uppercase mb-1">Invoice Details</p>
              <p className="text-sm text-[#0F172A]">Issue Date: <span className="text-[#64748B]">{invoice.issue_date}</span></p>
              <p className="text-sm text-[#0F172A]">Due Date: <span className="text-[#64748B]">{invoice.due_date}</span></p>
            </div>
          </div>

          {/* Line Items */}
          <div className="mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E2E8F0]">
                  <th className="text-left py-3 text-xs font-semibold text-[#64748B] uppercase">Description</th>
                  <th className="text-right py-3 text-xs font-semibold text-[#64748B] uppercase">Qty</th>
                  <th className="text-right py-3 text-xs font-semibold text-[#64748B] uppercase">Rate</th>
                  <th className="text-right py-3 text-xs font-semibold text-[#64748B] uppercase">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((li, idx: number) => (
                  <tr key={idx} className="border-b border-[#F1F5F9]">
                    <td className="py-3 text-[#0F172A]">{li.description}</td>
                    <td className="text-right py-3 text-[#64748B]">{li.quantity}</td>
                    <td className="text-right py-3 text-[#64748B]">${li.rate.toFixed(2)}</td>
                    <td className="text-right py-3 font-medium text-[#0F172A]">${li.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Invoice Sections — Maintenance, One-off Jobs, Renovations */}
          <div className="mb-6 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-[#0F172A]">Invoice Sections</h4>
              <div className="flex items-center gap-2">
                <Label htmlFor="cc-toggle" className="text-xs text-[#64748B] flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5" /> Allow CC Payment
                </Label>
                <Switch id="cc-toggle" defaultChecked />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="border border-[#E2E8F0] rounded-lg p-3 bg-[#F8FAFC]">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-[#0891B2]/10 flex items-center justify-center">
                    <Droplets className="w-3.5 h-3.5 text-[#0891B2]" />
                  </div>
                  <span className="text-sm font-medium text-[#0F172A]">Maintenance</span>
                </div>
                <p className="text-xs text-[#64748B]">Weekly service visits</p>
                <p className="text-sm font-semibold text-[#0891B2] mt-1">${(subtotal * 0.6).toFixed(2)}</p>
              </div>
              <div className="border border-[#E2E8F0] rounded-lg p-3 bg-[#F8FAFC]">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-[#F59E0B]/10 flex items-center justify-center">
                    <Wrench className="w-3.5 h-3.5 text-[#F59E0B]" />
                  </div>
                  <span className="text-sm font-medium text-[#0F172A]">One-off Jobs</span>
                </div>
                <p className="text-xs text-[#64748B]">Repairs & services</p>
                <p className="text-sm font-semibold text-[#F59E0B] mt-1">${(subtotal * 0.25).toFixed(2)}</p>
              </div>
              <div className="border border-[#E2E8F0] rounded-lg p-3 bg-[#F8FAFC]">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-[#16A34A]/10 flex items-center justify-center">
                    <Hammer className="w-3.5 h-3.5 text-[#16A34A]" />
                  </div>
                  <span className="text-sm font-medium text-[#0F172A]">Renovations</span>
                </div>
                <p className="text-xs text-[#64748B]">Remodels & upgrades</p>
                <p className="text-sm font-semibold text-[#16A34A] mt-1">${(subtotal * 0.15).toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-full sm:w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[#64748B]">Subtotal</span>
                <span className="text-[#0F172A]">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#64748B]">Tax (8.25%)</span>
                <span className="text-[#0F172A]">${tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t border-[#E2E8F0]">
                <span className="text-[#0F172A]">Total</span>
                <span className="text-[#0891B2]">${total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
