import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Mail, Paperclip } from "lucide-react";
import { customersApi } from "@/lib/api/customers";
import type { SendDocumentEmail } from "@/lib/api/invoicing";
import { useLanguage } from "@/lib/language-context";

export type EmailContact = { id: string; name: string; email: string | null; phone: string | null; is_primary: boolean };

const splitEmails = (s: string) => s.split(/[,;\s]+/).map((e) => e.trim()).filter(Boolean);
const sameEmail = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

// Client video 2026-10-23: "when we email invoice, we get a pop-up screen like this.
export default function SendEmailDialog({
  open,
  onOpenChange,
  kind,
  customerId,
  presetContacts,
  defaultSubject,
  defaultMessage,
  getPdf,
  pdfName,
  onSend,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: "invoice" | "estimate" | "purchase_order";
  customerId: string | null;
  /** Purchase orders: the vendor's emails, passed in instead of loading the customer's household. */
  presetContacts?: EmailContact[];
  defaultSubject: string;
  defaultMessage: string;
  getPdf: () => Promise<string | null>;
  pdfName: string;
  onSend: (data: SendDocumentEmail) => Promise<void>;
}) {
  const { t } = useLanguage();
  const [contacts, setContacts] = useState<EmailContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(defaultSubject);
  const [message, setMessage] = useState(defaultMessage);
  const [attachPdf, setAttachPdf] = useState(true);
  const [stage, setStage] = useState<"idle" | "pdf" | "sending">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSubject(defaultSubject);
    setMessage(defaultMessage);
    setCc("");
    setError(null);
    setStage("idle");
    setAttachPdf(true);
    setContacts([]);
    setTo("");
    if (presetContacts) {
      setContacts(presetContacts);
      setTo(presetContacts.filter((c) => c.is_primary && c.email).map((c) => c.email!).join(", "));
      return;
    }
    if (!customerId) return;
    let cancelled = false;
    setContactsLoading(true);
    customersApi.emailContacts(customerId).then((rows) => {
      if (cancelled) return;
      setContacts(rows);
      const primary = rows.find((r) => r.is_primary && r.email);
      setTo(primary?.email ?? "");
    }).catch(() => {}).finally(() => { if (!cancelled) setContactsLoading(false); });
    return () => { cancelled = true; };
  }, [open, customerId, presetContacts, defaultSubject, defaultMessage]);

  const toList = splitEmails(to);
  const isChecked = (c: EmailContact) => !!c.email && toList.some((e) => sameEmail(e, c.email!));
  const toggle = (c: EmailContact, checked: boolean) => {
    if (!c.email) return;
    const rest = toList.filter((e) => !sameEmail(e, c.email!));
    setTo((checked ? [...rest, c.email] : rest).join(", "));
  };
  const withEmail = contacts.filter((c) => c.email);
  const allChecked = withEmail.length > 0 && withEmail.every(isChecked);
  const toggleAll = (checked: boolean) => {
    const others = toList.filter((e) => !withEmail.some((c) => sameEmail(c.email!, e)));
    setTo((checked ? [...others, ...withEmail.map((c) => c.email!)] : others).join(", "));
  };

  const handleSend = async () => {
    setError(null);
    if (toList.length === 0) {
      setError(t("Add at least one email address to send to."));
      return;
    }
    try {
      let pdfBase64: string | null = null;
      if (attachPdf) {
        setStage("pdf");
        pdfBase64 = await getPdf().catch(() => null);
      }
      setStage("sending");
      await onSend({ to: toList, cc: splitEmails(cc), subject: subject.trim(), message, pdfBase64, pdfName });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Failed to send"));
    }
    setStage("idle");
  };

  const busy = stage !== "idle";
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{kind === "invoice" ? t("Send Invoice") : kind === "estimate" ? t("Send Estimate") : t("Send Purchase Order")}</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-1">
          {contactsLoading && <p className="text-sm text-[#64748B]">{t("Loading contacts...")}</p>}
          {contacts.length > 0 && (
            <div className="rounded-lg border border-[#E2E8F0] overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs text-[#64748B] uppercase">
                    <th className="w-10 py-2 px-3 text-left"><Checkbox checked={allChecked} disabled={withEmail.length === 0} onCheckedChange={(v) => toggleAll(!!v)} /></th>
                    <th className="py-2 px-3 text-left font-semibold">{t("Name")}</th>
                    <th className="py-2 px-3 text-left font-semibold">{t("Email")}</th>
                    <th className="py-2 px-3 text-left font-semibold">{t("Phone")}</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((c) => (
                    <tr key={c.id} className="border-b border-[#F1F5F9] last:border-0">
                      <td className="py-2 px-3"><Checkbox checked={isChecked(c)} disabled={!c.email} onCheckedChange={(v) => toggle(c, !!v)} /></td>
                      <td className="py-2 px-3 text-[#0F172A]">{c.name}</td>
                      <td className="py-2 px-3 text-[#64748B] break-all">{c.email || <span className="italic text-[#94A3B8]">{t("No email on file")}</span>}</td>
                      <td className="py-2 px-3 text-[#64748B] whitespace-nowrap">{c.phone || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>{t("To")}</Label>
              <Input className="mt-1" value={to} onChange={(e) => setTo(e.target.value)} placeholder="name@example.com, other@example.com" />
              <p className="text-xs text-[#64748B] mt-1">{t("Separate more than one email with a comma.")}</p>
            </div>
            <div>
              <Label>{t("CC")}</Label>
              <Input className="mt-1" value={cc} onChange={(e) => setCc(e.target.value)} placeholder={t("Optional")} />
            </div>
          </div>
          <div>
            <Label>{t("Subject")}</Label>
            <Input className="mt-1" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <Label>{t("Message")}</Label>
            <Textarea className="mt-1 min-h-[130px]" value={message} onChange={(e) => setMessage(e.target.value)} />
            <p className="text-xs text-[#64748B] mt-1">
              {kind === "invoice"
                ? t("Below your message the email adds the Breakdown of Services (invoice #, dates, job description, service performed) and a Click here to pay button.")
                : kind === "estimate"
                  ? t("Below your message the email adds the estimate details and a Click here to review & approve button.")
                  : t("Below your message the email adds the PO #, date, payment terms and the list of products.")}
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-[#0F172A] cursor-pointer">
            <Checkbox checked={attachPdf} onCheckedChange={(v) => setAttachPdf(!!v)} />
            <Paperclip className="w-4 h-4 text-[#64748B]" />
            {kind === "invoice" ? t("Attach the invoice as a PDF") : kind === "estimate" ? t("Attach the estimate as a PDF") : t("Attach the purchase order as a PDF")}
          </label>
          {error && <p className="text-sm text-[#DC2626]">{t(error)}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>{t("Cancel")}</Button>
            <Button className="bg-[#0891B2] hover:bg-[#0E7490] text-white gap-2" disabled={busy} onClick={handleSend}>
              <Mail className="w-4 h-4" />
              {stage === "pdf" ? t("Preparing PDF...") : stage === "sending" ? t("Sending...") : t("Send")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
