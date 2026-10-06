import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, Droplets } from "lucide-react";
import { laborFirst } from "@/lib/labor";
import { invoicingApi, type PublicInvoice as PublicInvoiceBundle } from "@/lib/api/invoicing";
import CardPaymentForm from "@/components/CardPaymentForm";

// Client video 2026-10-06: "text them a hyperlink on an estimate and an invoice so they can pay
// on their phone" — this is that page for an invoice, reachable with no login via the invoice's
// unguessable payment_token. Modeled on PublicEstimate.tsx; see backend/src/routes/public.ts for
// the (unauthenticated) API it calls.
export default function PublicInvoice() {
  const { token } = useParams<{ token: string }>();
  const [bundle, setBundle] = useState<PublicInvoiceBundle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  const load = useCallback(() => {
    if (!token) return;
    setIsLoading(true);
    invoicingApi.publicInvoice(token)
      .then(setBundle)
      .catch(() => setBundle(null))
      .finally(() => setIsLoading(false));
  }, [token]);

  useEffect(load, [load]);

  const handleCharge = async (opaqueData: { dataDescriptor: string; dataValue: string }) => {
    if (!token) return;
    setPaying(true);
    setError(null);
    try {
      await invoicingApi.payInvoicePublic(token, opaqueData);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    }
    setPaying(false);
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-[#64748B]">Loading invoice...</div>;
  }

  if (!bundle) {
    return <div className="min-h-screen flex items-center justify-center text-[#64748B]">Invoice not found.</div>;
  }

  const { invoice, lineItems, business, total } = bundle;
  const materialsSubtotal = lineItems.filter((li) => li.item_type !== "labor").reduce((s, li) => s + li.amount, 0);
  const laborSubtotal = lineItems.filter((li) => li.item_type === "labor").reduce((s, li) => s + li.amount, 0);
  // Client video 2026-10-06: display-only breakdown now follows each line's real `taxable`
  // override too, matching the backend-computed `total` above (the one actually charged).
  const taxableSubtotal = lineItems.filter((li) => li.taxable ?? li.item_type !== "labor").reduce((s, li) => s + li.amount, 0);
  const tax = taxableSubtotal * 0.0825;
  const remainingBalance = total - (invoice.down_payment ?? 0);
  const isPaid = invoice.status === "Paid";

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#0891B2] flex items-center justify-center"><Droplets className="w-4 h-4 text-white" /></div>
          <span className="font-bold text-[#0C2A3A]">{business?.invoice_business_name || business?.name || "Invoice"}</span>
        </div>

        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-6 lg:p-8 space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-[#0F172A]">Invoice {invoice.number}</h1>
              <p className="text-sm text-[#64748B]">For {invoice.customers?.name ?? "you"}</p>
            </div>
            <div className="text-right text-sm text-[#64748B]">
              <p>Issued {invoice.issue_date}</p>
              {invoice.due_date && <p>Due {invoice.due_date}</p>}
            </div>
          </div>

          {lineItems.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E2E8F0]">
                  <th className="text-left py-2 text-xs font-semibold text-[#64748B] uppercase">Description</th>
                  <th className="text-right py-2 text-xs font-semibold text-[#64748B] uppercase">Qty</th>
                  <th className="text-right py-2 text-xs font-semibold text-[#64748B] uppercase">Amount</th>
                </tr>
              </thead>
              <tbody>
                {laborFirst(lineItems).map((li, idx) => (
                  <tr key={idx} className="border-b border-[#F1F5F9]">
                    <td className="py-2 text-[#0F172A]">
                      {li.description}
                      {li.notes && <p className="text-xs text-[#94A3B8] whitespace-pre-wrap">{li.notes}</p>}
                    </td>
                    <td className="text-right py-2 text-[#64748B]">{li.quantity}</td>
                    <td className="text-right py-2 font-medium text-[#0F172A]">${li.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="flex justify-end">
            <div className="w-full sm:w-64 space-y-1.5">
              <div className="flex justify-between text-sm"><span className="text-[#64748B]">Parts &amp; Materials</span><span>${materialsSubtotal.toFixed(2)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-[#64748B]">Labor</span><span>${laborSubtotal.toFixed(2)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-[#64748B]">Tax</span><span>${tax.toFixed(2)}</span></div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t border-[#E2E8F0]"><span>Total</span><span className="text-[#0891B2]">${total.toFixed(2)}</span></div>
              <div className="flex justify-between text-sm pt-2 border-t border-[#E2E8F0]"><span className="text-[#64748B]">Down Payment</span><span>${(invoice.down_payment ?? 0).toFixed(2)}</span></div>
              <div className="flex justify-between text-sm font-semibold"><span>Remaining Balance</span><span>${remainingBalance.toFixed(2)}</span></div>
            </div>
          </div>

          {isPaid ? (
            <div className="text-center py-4 rounded-lg font-medium bg-[#16A34A]/10 text-[#16A34A] flex items-center justify-center gap-2">
              <CheckCircle2 className="w-5 h-5" /> Paid{invoice.paid_date ? ` on ${invoice.paid_date}` : ""}. Thank you!
            </div>
          ) : (
            <div className="space-y-2 border-t border-[#E2E8F0] pt-4">
              <p className="text-sm font-semibold text-[#0F172A]">Pay this invoice</p>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <CardPaymentForm amount={remainingBalance} onCharge={handleCharge} submitLabel={paying ? "Processing..." : `Pay $${remainingBalance.toFixed(2)}`} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
