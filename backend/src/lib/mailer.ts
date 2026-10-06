import nodemailer from "nodemailer";

// Client video 2026-10-06: Office 365 SMTP details provided (server/port/user/SSL), real
// sending still needs SMTP_PASSWORD in the environment before this can actually send -- every
// call below checks for it explicitly and throws a clear, honest error instead of silently
// failing or pretending to succeed, so "Send via Email" can be wired up now and will just start
// working the moment the password is added to the environment (no further code change needed).
const SMTP_HOST = process.env.SMTP_HOST ?? "smtp.office365.com";
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 587);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASSWORD = process.env.SMTP_PASSWORD;
const SMTP_FROM = process.env.SMTP_FROM ?? SMTP_USER;
// Where "customer paid" notifications go -- defaults to the same inbox being used to send, since
// no separate notification-email field exists on tenants yet.
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL ?? SMTP_USER;

export function isMailerConfigured(): boolean {
  return Boolean(SMTP_USER && SMTP_PASSWORD);
}

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;
function getTransporter() {
  if (!isMailerConfigured()) {
    throw new Error("Email isn't set up yet — the SMTP password hasn't been added. (Server/port/user are configured; ask for the password.)");
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
    });
  }
  return transporter;
}

export async function sendMail(opts: { to: string; subject: string; html: string }) {
  const t = getTransporter();
  await t.sendMail({ from: SMTP_FROM, to: opts.to, subject: opts.subject, html: opts.html });
}

// Client video 2026-10-06: "we also need notification on our end once [a customer has] paid an
// invoice". Best-effort -- failures here (e.g. password still missing) are logged, not thrown,
// so a successful real payment is never blocked by a notification email that can't send yet.
export async function notifyBusinessOfPayment(opts: { invoiceNumber: string; customerName: string; amount: number }) {
  if (!isMailerConfigured() || !NOTIFY_EMAIL) return;
  try {
    await sendMail({
      to: NOTIFY_EMAIL,
      subject: `Invoice ${opts.invoiceNumber} paid — $${opts.amount.toFixed(2)}`,
      html: `<p><strong>${opts.customerName}</strong> just paid invoice <strong>${opts.invoiceNumber}</strong> — $${opts.amount.toFixed(2)}.</p>`,
    });
  } catch (err) {
    console.error("notifyBusinessOfPayment failed:", err);
  }
}

// Client video 2026-10-06 (ServiceWorks Notification Preference screenshots): client has these
// 6 toggled on over there -- "Approved Estimation", "Tech Enroute", "Invoice Email", "Custom
// Estimation Email", "Trip Complete", "Tech Arrival". Invoice Email / Custom Estimation Email map
// to the "Send via Email" buttons already built (manual, by design -- auto-sending an unreviewed
// Draft invoice would undo the 2026-10-06 decision to default new invoices to Draft, not Sent).
// These 3 are the genuinely new ones: automatic, customer-facing, tied to job status changes.
export async function notifyCustomerOfJobEvent(opts: {
  to: string;
  customerName: string;
  businessName: string;
  event: "en_route" | "arrived" | "completed";
  jobDescription?: string | null;
}) {
  if (!isMailerConfigured()) return;
  const what = opts.jobDescription ? ` (${opts.jobDescription})` : "";
  const copy = {
    en_route: { subject: `${opts.businessName} is on the way`, body: `Your technician is on the way to your appointment${what}.` },
    arrived: { subject: `${opts.businessName} has arrived`, body: `Your technician has arrived and is starting your service${what}.` },
    completed: { subject: `${opts.businessName} — service complete`, body: `Your service${what} is complete. Thank you for your business!` },
  }[opts.event];
  try {
    await sendMail({ to: opts.to, subject: copy.subject, html: `<p>Hi ${opts.customerName},</p><p>${copy.body}</p><p>${opts.businessName}</p>` });
  } catch (err) {
    console.error("notifyCustomerOfJobEvent failed:", err);
  }
}

// "Approved Estimation" -- ON in the client's reference screenshots, described in the matching
// video as "kind of an important one". Separate from the existing in-app Notifications-bell alert
// (public.ts's estimate-respond route) -- this is the same event, also as a real email.
export async function notifyBusinessOfEstimateApproval(opts: { estimateNumber: string; customerName: string }) {
  if (!isMailerConfigured() || !NOTIFY_EMAIL) return;
  try {
    await sendMail({
      to: NOTIFY_EMAIL,
      subject: `Estimate ${opts.estimateNumber} approved`,
      html: `<p><strong>${opts.customerName}</strong> just approved estimate <strong>${opts.estimateNumber}</strong>.</p>`,
    });
  } catch (err) {
    console.error("notifyBusinessOfEstimateApproval failed:", err);
  }
}
