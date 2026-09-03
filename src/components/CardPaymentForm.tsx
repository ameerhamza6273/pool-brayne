import { useState } from "react";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { tokenizeCard } from "@/lib/authorizenet";

// Real card entry via Authorize.net Accept.js — the card number/CVV are tokenized client-side
// and never sent to our own backend, only the resulting opaque payment nonce is.
export default function CardPaymentForm({
  amount,
  onCharge,
  submitLabel,
}: {
  amount: number;
  onCharge: (opaqueData: { dataDescriptor: string; dataValue: string }) => Promise<void>;
  submitLabel?: string;
}) {
  const [cardNumber, setCardNumber] = useState("");
  const [expMonth, setExpMonth] = useState("");
  const [expYear, setExpYear] = useState("");
  const [cvv, setCvv] = useState("");
  const [charging, setCharging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCharge = async () => {
    setError(null);
    setCharging(true);
    try {
      const opaqueData = await tokenizeCard({ cardNumber, expMonth, expYear, cvv });
      await onCharge(opaqueData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    }
    setCharging(false);
  };

  return (
    <div className="space-y-3">
      <div>
        <Label>Card Number</Label>
        <Input
          className="mt-1"
          placeholder="4111 1111 1111 1111"
          value={cardNumber}
          onChange={(e) => setCardNumber(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>Exp Month</Label>
          <Input className="mt-1" placeholder="MM" maxLength={2} value={expMonth} onChange={(e) => setExpMonth(e.target.value.replace(/\D/g, ""))} />
        </div>
        <div>
          <Label>Exp Year</Label>
          <Input className="mt-1" placeholder="YYYY" maxLength={4} value={expYear} onChange={(e) => setExpYear(e.target.value.replace(/\D/g, ""))} />
        </div>
        <div>
          <Label>CVV</Label>
          <Input className="mt-1" placeholder="123" maxLength={4} value={cvv} onChange={(e) => setCvv(e.target.value.replace(/\D/g, ""))} />
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button
        className="w-full h-11 bg-[#0891B2] hover:bg-[#0E7490] text-white gap-2"
        disabled={charging || !cardNumber || !expMonth || !expYear || !cvv}
        onClick={handleCharge}
      >
        <CreditCard className="w-4 h-4" />
        {charging ? "Charging..." : (submitLabel ?? `Charge $${amount.toFixed(2)}`)}
      </Button>
    </div>
  );
}
