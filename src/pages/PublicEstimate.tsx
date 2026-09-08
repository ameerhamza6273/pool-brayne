import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, XCircle, Droplets } from "lucide-react";
import { Button } from "@/components/ui/button";
import { invoicingApi, type PublicEstimate as PublicEstimateBundle } from "@/lib/api/invoicing";

// Client PDF 2026-09-06: "I am sending a sample email for an estimate it will have an 'Approve
// Estimation' button" — this is that customer-facing page, reachable with no login via the
// estimate's unguessable approval_token. See backend/src/routes/public.ts for the (unauthenticated)
// API it calls.
export default function PublicEstimate() {
  const { token } = useParams<{ token: string }>();
  const [bundle, setBundle] = useState<PublicEstimateBundle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [responding, setResponding] = useState(false);

  const load = useCallback(() => {
    if (!token) return;
    setIsLoading(true);
    invoicingApi.publicEstimate(token)
      .then(setBundle)
      .catch(() => setBundle(null))
      .finally(() => setIsLoading(false));
  }, [token]);

  useEffect(load, [load]);

  const handleRespond = async (decision: "Accepted" | "Declined") => {
    if (!token) return;
    setResponding(true);
    setError(null);
    try {
      await invoicingApi.respondToEstimate(token, decision);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
    setResponding(false);
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-[#64748B]">Loading estimate...</div>;
  }

  if (!bundle) {
    return <div className="min-h-screen flex items-center justify-center text-[#64748B]">Estimate not found.</div>;
  }

  const { estimate, lineItems, business } = bundle;
  const subtotal = lineItems.length > 0 ? lineItems.reduce((s, li) => s + li.amount, 0) : 0;
  const materialsSubtotal = lineItems.filter((li) => li.item_type !== "labor").reduce((s, li) => s + li.amount, 0);
  const laborSubtotal = lineItems.filter((li) => li.item_type === "labor").reduce((s, li) => s + li.amount, 0);
  const tax = subtotal * 0.0825;
  const total = subtotal + tax;
  const remainingBalance = total - (estimate.down_payment ?? 0);
  const alreadyResponded = estimate.status === "Accepted" || estimate.status === "Declined";

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#0891B2] flex items-center justify-center"><Droplets className="w-4 h-4 text-white" /></div>
          <span className="font-bold text-[#0C2A3A]">{business?.invoice_business_name || business?.name || "Estimate"}</span>
        </div>

        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-6 lg:p-8 space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-[#0F172A]">Estimate {estimate.number}</h1>
              <p className="text-sm text-[#64748B]">For {estimate.customers?.name ?? "you"}</p>
            </div>
            <div className="text-right text-sm text-[#64748B]">
              <p>Issued {estimate.issue_date}</p>
              {estimate.expiry_date && <p>Expires {estimate.expiry_date}</p>}
            </div>
          </div>

          {estimate.job_description && (
            <div className="border border-[#E2E8F0] rounded-lg p-4">
              <p className="text-xs font-semibold text-[#64748B] uppercase mb-1">Job Description</p>
              <p className="text-sm text-[#0F172A] whitespace-pre-wrap">{estimate.job_description}</p>
            </div>
          )}

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
                {lineItems.map((li, idx) => (
                  <tr key={idx} className="border-b border-[#F1F5F9]">
                    <td className="py-2 text-[#0F172A]">
                      {li.description}
                      {li.notes && <p className="text-xs text-[#94A3B8]">{li.notes}</p>}
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
              <div className="flex justify-between text-sm pt-2 border-t border-[#E2E8F0]"><span className="text-[#64748B]">Down Payment</span><span>${(estimate.down_payment ?? 0).toFixed(2)}</span></div>
              <div className="flex justify-between text-sm font-semibold"><span>Remaining Balance</span><span>${remainingBalance.toFixed(2)}</span></div>
            </div>
          </div>

          {estimate.status === "Converted" ? (
            <p className="text-center text-sm text-[#64748B] py-3">This estimate has already been converted and can no longer be responded to.</p>
          ) : alreadyResponded ? (
            <div className={`text-center py-4 rounded-lg font-medium ${estimate.status === "Accepted" ? "bg-[#16A34A]/10 text-[#16A34A]" : "bg-[#DC2626]/10 text-[#DC2626]"}`}>
              You {estimate.status === "Accepted" ? "approved" : "declined"} this estimate{estimate.approved_at ? ` on ${new Date(estimate.approved_at).toLocaleDateString()}` : ""}.
            </div>
          ) : (
            <div className="space-y-2">
              {error && <p className="text-sm text-red-600 text-center">{error}</p>}
              <div className="flex gap-3">
                <Button className="flex-1 h-11 bg-[#16A34A] hover:bg-[#15803D] text-white gap-2" onClick={() => handleRespond("Accepted")} disabled={responding}>
                  <CheckCircle2 className="w-4 h-4" /> Approve Estimate
                </Button>
                <Button variant="outline" className="flex-1 h-11 border-[#E2E8F0] gap-2" onClick={() => handleRespond("Declined")} disabled={responding}>
                  <XCircle className="w-4 h-4" /> Decline
                </Button>
              </div>
              <p className="text-xs text-center text-[#94A3B8]">By approving, you authorize this work at the price shown above.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
