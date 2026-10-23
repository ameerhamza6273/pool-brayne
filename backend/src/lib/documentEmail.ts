// Client video 2026-10-23 ("what we're used to seeing"): the invoice/estimate email mirrors the one
// their old system sent -- greeting + message, a "Breakdown of Services" (invoice #, dates, job
// description, service performed), a big pay/approve button, then Call Us -- with the full
// document attached as a PDF. Kept in our own colors (cyan/navy), same rule as the invoice page.

const esc = (s: string | null | undefined) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const paragraphs = (text: string) =>
  text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 14px">${esc(p).replace(/\n/g, "<br/>")}</p>`)
    .join("");

const fmtDate = (d: string | Date | null | undefined) => {
  if (!d) return null;
  const s = typeof d === "string" ? d : d.toISOString();
  const [y, m, day] = s.slice(0, 10).split("-");
  return y && m && day ? `${m}/${day}/${y}` : null;
};

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
export function cleanEmailList(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  const out: string[] = [];
  for (const raw of list) {
    const e = String(raw ?? "").trim();
    if (e && !out.some((x) => x.toLowerCase() === e.toLowerCase())) out.push(e);
  }
  return out;
}
export const invalidEmails = (list: string[]) => list.filter((e) => !EMAIL_RE.test(e));

export function documentEmailHtml(opts: {
  kind: "invoice" | "estimate";
  logoUrl: string | null;
  businessName: string;
  businessPhone: string | null;
  customerName: string;
  message: string;
  number: string;
  dateRequested: string | Date | null;
  dateCompleted: string | Date | null;
  jobDescription: string | null;
  servicePerformed: string[];
  total: number;
  balanceDue: number | null;
  buttonUrl: string;
  pdfAttached?: boolean;
}) {
  const row = (label: string, value: string | null) =>
    value ? `<p style="margin:0 0 10px;font-size:16px"><strong>${esc(label)}:</strong> ${esc(value)}</p>` : "";
  // Client video 2026-10-24: "would like to see [Breakdown of Services] a little bit bigger... and bigger font".
  const section = (title: string, body: string) =>
    body
      ? `<p style="margin:22px 0 10px;font-size:19px;font-weight:700;color:#0C2A3A;border-bottom:2px solid #0C2A3A;padding-bottom:6px">${esc(title)}</p><div style="font-size:16px">${body}</div>`
      : "";
  const money = (n: number) => `$${n.toFixed(2)}`;
  const isInvoice = opts.kind === "invoice";
  const phoneDigits = (opts.businessPhone ?? "").replace(/[^\d+]/g, "");
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#0F172A;max-width:640px">
${opts.pdfAttached ? `<p style="margin:0 0 16px;padding:10px 14px;background:#ECFEFF;border-left:4px solid #0891B2;font-size:14px">The ${isInvoice ? "invoice" : "estimate"} PDF is attached to this email. If you would like to see a detailed view, please click the PDF.</p>` : ""}
${opts.logoUrl ? `<p style="margin:0 0 18px"><img src="${esc(opts.logoUrl)}" alt="${esc(opts.businessName)}" width="180" style="display:block;width:180px;max-width:180px;height:auto;border:0" /></p>` : ""}
<p style="margin:0 0 14px">Hi ${esc(opts.customerName)},</p>
${paragraphs(opts.message)}
${section("Breakdown of Services", [
    row(isInvoice ? "Invoice #" : "Estimate #", opts.number),
    row("Date Requested", fmtDate(opts.dateRequested)),
    row(isInvoice ? "Date Completed" : "Valid Until", fmtDate(opts.dateCompleted)),
    row(isInvoice ? "Total" : "Estimate Total", money(opts.total)),
    opts.balanceDue !== null && opts.balanceDue !== opts.total ? row("Balance Due", money(opts.balanceDue)) : "",
  ].join(""))}
${section("Job Description", opts.jobDescription ? paragraphs(opts.jobDescription) : "")}
${section("Service Performed", opts.servicePerformed.map((s) => paragraphs(s)).join(""))}
<p style="margin:26px 0 8px;text-align:center;font-weight:700">${isInvoice ? "Please use the button below to view and pay online." : "Please use the button below to review and approve online."}</p>
<p style="margin:0 0 26px;text-align:center"><a href="${esc(opts.buttonUrl)}" style="display:inline-block;background:#0891B2;color:#ffffff;padding:12px 26px;border-radius:8px;text-decoration:none;font-weight:700">${isInvoice ? "Click here to pay" : "Click here to review &amp; approve"}</a></p>
<p style="margin:0 0 16px;text-align:center;font-weight:700">Thank you for working with us. We hope to hear from you soon.</p>
${phoneDigits ? `<p style="margin:0 0 6px;text-align:center"><a href="tel:${esc(phoneDigits)}" style="display:inline-block;background:#0C2A3A;color:#ffffff;padding:9px 20px;border-radius:8px;text-decoration:none;font-weight:700">Call Us ${esc(opts.businessPhone)}</a></p>` : ""}
<p style="margin:16px 0 0;text-align:center;color:#64748B;font-size:12px">${esc(opts.businessName)}</p>
</div>`;
}
