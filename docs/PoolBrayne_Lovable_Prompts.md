# PoolBrayne — Lovable Build Prompts

> **Scope note:** Lovable builds React **web** apps (React + TypeScript + Tailwind + shadcn/ui + Vite).
> This produces a **mobile-first responsive web app / PWA** version of PoolBrayne — ideal for the
> operator dashboard, back office, and conference/investor demo. The native iOS/Android build
> (React Native, per the brief) is a separate later effort.
>
> **How to use:** Paste **Prompt 0** first and let it finish. Then paste **Prompts 1–8** one at a
> time, waiting for each to complete before the next. Build **frontend-only with realistic mock data** —
> no real QuickBooks/Stripe/Twilio yet (those are stubbed as "Connected" UI states).

---

## PROMPT 0 — Foundation: Design System, App Shell & Dashboard

```
Build the foundation of "PoolBrayne" — a mobile-first business operating system (SaaS web app)
for pool supply, repair, and service companies. Tagline: "Built by a tradesman. Built for the trades."
Powered by Brayne AI. This is a FRONTEND-ONLY build using realistic mock/seed data — no real backend
integrations yet. Use React + TypeScript + Tailwind + shadcn/ui. Make everything fully responsive,
mobile-first, with large touch targets suitable for field technicians on phones.

=== DESIGN SYSTEM ===
Theme: clean, modern, operational SaaS — confident but approachable (trades-friendly, not corporate-stuffy).
Colors (set these as Tailwind/CSS variables):
- Primary / brand "pool aqua": #0891B2 (hover #0E7490)
- Sidebar / deep base: #0C2A3A (deep teal-navy)
- App background: #F8FAFC ; Cards: #FFFFFF ; Borders: #E2E8F0
- Text: #0F172A primary, #64748B muted
- Status: success #16A34A, warning #F59E0B, danger #DC2626, info #0891B2
Typography: Inter throughout. Semibold headings, generous spacing, rounded-xl cards with soft shadows.
Components: use shadcn cards, tables, badges, tabs, dialogs, dropdowns, sheets, toasts, avatars.
Status pills should be colored badges. Use lucide-react icons.

=== APP SHELL & NAVIGATION ===
- DESKTOP: fixed left sidebar (deep teal-navy #0C2A3A) with the PoolBrayne wordmark + small
  water-drop logo at top, then nav items with icons: Dashboard, Customers, Jobs & Dispatch,
  Inventory, Fleet, Timesheets, Invoicing, Campaigns, Settings. Active item highlighted in aqua.
  At the bottom of the sidebar: a tenant/company switcher showing "Bryan's Pool Co — Tenant 001"
  with an avatar and a dropdown.
- TOP BAR: global search input, a notifications bell with a badge, and a user menu (avatar →
  Profile, Settings, Log out).
- MOBILE: collapse the sidebar into a bottom tab bar with 5 items (Dashboard, Jobs, Customers,
  Invoicing, More). "More" opens a sheet listing the remaining sections. Top bar becomes a compact
  header with a hamburger and the company name.

=== ROUTES ===
/login, /signup (auth screens), /dashboard (home), /customers, /customers/:id, /jobs, /jobs/:id,
/inventory, /fleet, /timesheets, /invoicing, /invoicing/:id, /campaigns, /settings, /onboarding.
Protect app routes behind a simple mock auth (any email/password logs in). Default redirect to /dashboard.

=== AUTH SCREENS ===
Split-screen layout. Left: a branded aqua gradient panel with the PoolBrayne logo, the tagline
"Built by a tradesman. Built for the trades.", and 3 small feature bullets (One login. One app.
Everything in one place.). Right: clean login form (email, password, "Sign in" button, "Forgot
password?"). Signup mirrors it with company name, name, email, password fields. Friendly, modern.

=== DASHBOARD (/dashboard) — Reporting Dashboard ===
Page title "Dashboard" with a date-range selector (Today / This Week / This Month / This Year) and
an "Export PDF" button (mock).
Row of KPI stat cards (each with icon, big number, label, and a small up/down % vs last period):
- Revenue (This Month) — $182,400
- Jobs Completed — 247
- Outstanding Invoices — $34,900 (12 invoices)
- New Customers — 18
Charts (use a charting lib like recharts):
- Revenue trend (area/line chart, last 12 months)
- Jobs completed per week (bar chart)
- Revenue by service type (donut: Maintenance, Repair, Install, Retail)
Lower section, two columns:
- "Technician Performance" table: Tech name, jobs/day, revenue, on-time completion %, avatar.
- "Inventory Alerts" list: low-stock products with current qty vs reorder threshold (red badges).
Right rail or bottom: "Outstanding / Aged Receivables" mini widget (0-30 / 31-60 / 61-90 / 90+ buckets).
Seed all of this with realistic pool-industry mock data.

Make it polished, responsive, and cohesive. This is the foundation — subsequent prompts will flesh
out each module's dedicated page.
```

---

## PROMPT 1 — Customer CRM

```
Build out the Customer CRM (/customers and /customers/:id).

/customers — LIST VIEW:
- Header "Customers" with a search bar, a "Filter by tag" dropdown (Residential, Commercial, VIP,
  Lapsed, Seasonal), and an "+ Add Customer" button (opens a dialog form).
- Toggle between a table view and a card grid.
- Table columns: Customer name + avatar, Type/tags (colored badges), Property address, Last service
  date, Lifetime value, and quick-action icons (call, text, email).
- Seed ~25 realistic customers (mix of residential & commercial pool owners), each with tags.

/customers/:id — PROFILE VIEW:
- Header: customer name, tag badges, and one-tap Call / Text / Email buttons (aqua, prominent).
- Left column: contact info, property address (with a small static map thumbnail placeholder),
  and an "Equipment on File" card listing pump model, heater, filter, salt system, and install dates.
- Right/main column: tabbed interface:
  - "Service History" — timeline of past jobs (date, type, technician, amount, status).
  - "Purchases" — table of in-store + service transactions (labeled "Synced from QuickBooks").
  - "Notes" — notes list with the ability to add a note, plus a photo-attachment gallery (mock images).
  - "Invoices" — list of this customer's invoices with status badges.
- A right rail "Customer Summary" card: lifetime value, # of jobs, customer since date, last contact.
Use realistic mock data consistent with the customers seeded in the list.
```

---

## PROMPT 2 — Job & Dispatch Pipeline

```
Build the Job & Dispatch Pipeline (/jobs and /jobs/:id).

/jobs — main view with a tab/segmented control to switch between "Pipeline (Kanban)",
"Dispatch Board", and "Schedule (Calendar)".

PIPELINE (Kanban): columns for Lead → Booked → Dispatched → In Progress → Completed. Each job card
shows: customer name, service type (Maintenance/Repair/Install), address, assigned technician avatar,
scheduled date/time, and a colored status accent. Cards are drag-and-droppable between columns.
Add a "+ New Job" button (dialog: customer, service type, date, assign tech, notes).

DISPATCH BOARD: left = list of unassigned/today's jobs; right = list of technicians with their
current status (Available / On a job / Off) and a "jobs today" count. Allow assigning a job to a tech
with one tap. Show a small note like "Assigns nearest available technician based on live vehicle position."

SCHEDULE (Calendar): weekly calendar with jobs as blocks color-coded by technician. Include a panel
for "Recurring Maintenance Routes" (weekly / bi-weekly / monthly) with a few seeded recurring routes.

/jobs/:id — JOB DETAIL:
- Job header: status badge, customer name + link, service type, scheduled time, assigned tech.
- Sections: job details/description, line items (labor + parts pulled from inventory), customer
  notes, a photo upload/gallery, and a signature-capture placeholder box ("Customer signature on completion").
- Right rail: a status timeline (Booked → En route → Arrived → Completed) and toggles to send
  automated customer notifications ("Booking confirmed", "Technician en route", "Job completed").
- Primary action button: "Mark Complete & Generate Invoice".
Seed realistic pool service jobs (filter cleanings, pump replacements, heater repairs, openings/closings).
```

---

## PROMPT 3 — Inventory Management

```
Build Inventory Management (/inventory).

- Header "Inventory" with search, a category filter (Chemicals, Parts, Equipment, Accessories),
  a location filter (Store / Vehicle 1 / Vehicle 2 / Vehicle 3), and "+ Add Product".
- KPI strip: Total SKUs, Low-stock items, Inventory value, Out-of-stock count.
- Main table: Product name + thumbnail, SKU, Category, Store qty, Vehicle qty, Total on hand,
  Reorder threshold, Unit cost, and a status badge (In Stock / Low / Out). Low-stock rows highlighted
  amber; out-of-stock red.
- Tabs at top: "Catalog", "Suppliers", "Purchase Orders", "Variance / Shrinkage".
  - Suppliers: table of supplier records (name, contact, products supplied, lead time).
  - Purchase Orders: list of POs with status (Draft, Ordered, Received) and a "+ New PO" button.
  - Variance: a simple shrinkage/variance report table (expected vs actual, variance %, flagged rows).
- Note somewhere: "Products consumed on a job are automatically deducted at close."
Seed realistic pool inventory: chlorine tabs, liquid chlorine, muriatic acid, salt cells, pump motors,
filter cartridges, O-rings, test kits, etc., with stock levels across store + vehicles.
```

---

## PROMPT 4 — Fleet & Vehicle Tracking

```
Build Fleet & Vehicle Tracking (/fleet).

- A large live-map placeholder (use a styled map background or an embedded map component) showing
  vehicle pins for 3–4 service vehicles with technician names and "last updated" timestamps.
  Add a banner: "Live GPS inside PoolBrayne — no separate login. Vendor-agnostic API layer."
- Left/side panel: list of vehicles — vehicle name/number, assigned technician, current status
  (Moving / Idle / Parked), current location label, speed, and today's mileage. Clicking a vehicle
  focuses its pin.
- Below the map: tabs for "Trip History" (table: vehicle, start/end, distance, duration) and
  "Geofence Alerts" (list: vehicle X left service zone at time Y — warning badges).
- A small card: "Dispatch suggests the nearest available technician based on live vehicle position."
Seed realistic vehicles, technicians, and a few geofence alerts.
```

---

## PROMPT 5 — Employee Time Tracking & Payroll Export

```
Build Employee Time Tracking & Payroll Export (/timesheets).

- Header "Timesheets" with a week selector and an "Approve Week" button.
- A prominent "Clock In / Clock Out" card at top (for the logged-in user) noting "GPS-verified at job
  site location" with a small location chip. Show current shift elapsed time when clocked in.
- Main table: employees as rows, days of the week as columns, hours per day in cells, weekly total,
  overtime hours highlighted amber, and an approval status badge (Pending / Approved). Each row has an
  "Approve" action. Distinguish Employee vs Contractor with a badge.
- A panel "Job Costing": small table tying technician hours to jobs completed (tech, job, hours, labor cost).
- Footer card: "Payroll Export" — buttons "Export to Gusto" and "Export to ADP" (mock), with a note
  "No double entry, no manual reconciliation." Show a summary: total hours, total OT, # employees,
  estimated payroll.
Seed 5–6 employees with a full week of realistic hours, including some overtime.
```

---

## PROMPT 6 — Invoicing, Payments & QuickBooks

```
Build Invoicing, Payments & QuickBooks (/invoicing and /invoicing/:id).

/invoicing — LIST + DASHBOARD:
- Top: a "QuickBooks Online — Connected" status card (green) showing "Two-way sync active. Last
  synced 4 min ago." and an "Aged Receivables" widget with buckets (Current / 1-30 / 31-60 / 61-90 / 90+).
- KPI strip: Total outstanding, Paid this month, Overdue, Avg days to pay.
- Tabs: "All Invoices", "Recurring Billing", "Payments".
  - All Invoices table: invoice #, customer, issue date, due date, amount, status badge
    (Draft / Sent / Paid / Overdue), and a sync icon ("Synced to QuickBooks"). Filters + search.
  - Recurring Billing: list of maintenance-contract customers on auto-bill (frequency, amount, next charge).
  - Payments: ledger of recent card/ACH payments with method icons.
- "+ New Invoice" button.

/invoicing/:id — INVOICE DETAIL:
- A clean invoice document layout: PoolBrayne + company header, bill-to customer, line items
  (labor + parts pre-populated from the job), subtotal, tax, total, status badge.
- Action bar: "Collect Payment" (dialog with Card / ACH tabs — mock), "Send via Email", "Send via SMS",
  "Download PDF". A note "Synced two-way with the client's own QuickBooks Online account."
Seed realistic invoices tied to the customers/jobs from earlier modules.
```

---

## PROMPT 7 — Customer Follow-Up & Reactivation

```
Build Customer Follow-Up & Reactivation (/campaigns).

- Header "Campaigns & Follow-Up". Tabs: "Automations", "Seasonal Campaigns", "SMS Inbox", "Reviews",
  "Performance".
- AUTOMATIONS: cards for each automated sequence with an on/off toggle and stats — e.g.
  "Post-Service Follow-Up" (SMS+email after each visit), "Lapsed Customer Win-Back" (triggered after
  configurable inactivity, e.g. 90 days), "Review Request" (after job completion → Google/Facebook).
  Each card shows trigger, channel, # enrolled, and basic conversion stat.
- SEASONAL CAMPAIGNS: cards for "Pool Opening", "Mid-Season Chemical Check-In", "Pool Closing" with
  status (Active/Scheduled/Draft), audience size, and scheduled send date. "+ New Campaign" button.
- SMS INBOX: a two-pane messaging interface — left = conversation list (customer name, last message
  preview, unread badge); right = a chat thread (customer bubbles vs business bubbles) with a reply
  composer. Banner: "Customers reply inside PoolBrayne — not to a technician's personal phone."
- REVIEWS: list of recent review requests sent and reviews received (stars, platform icon, snippet).
- PERFORMANCE: a table of campaigns with open rate, reply rate, bookings generated, and revenue
  attributed; plus a small bar chart comparing campaigns.
Seed realistic automations, a few SMS conversations, and campaign performance numbers.
```

---

## PROMPT 8 — Settings, Integrations & Multi-Tenant Onboarding

```
Build Settings (/settings) and a multi-tenant Onboarding flow (/onboarding).

/settings — tabbed:
- "Company Profile": company name, logo upload, address, business hours, service area.
- "Team": list of users/technicians with roles (Owner, Manager, Technician), invite button.
- "Integrations": connection cards for QuickBooks Online (Connected ✓), Fleet/GPS Provider
  (Connected ✓, "vendor-agnostic — swappable"), Gusto/ADP Payroll (Connected ✓), Twilio (SMS),
  SendGrid (Email), Stripe (Billing). Each card has a logo, status badge, and Connect/Manage button.
- "Subscription & Billing": current plan card (PoolBrayne Pro — $X/mo via Stripe), payment method,
  billing history table, and an upgrade/downgrade option. Note "Each client connects their own
  QuickBooks account — fully isolated per tenant."
- "Notifications": toggles for which automated customer/staff notifications are enabled.

/onboarding — multi-tenant new-client wizard (Phase 4 "sales portal" feel): a 4-step stepper:
  1) Company details, 2) Connect QuickBooks (mock OAuth screen), 3) Connect fleet & payroll providers,
  4) Choose subscription plan (3 pricing tiers) + Stripe checkout placeholder. Clean, conversion-focused,
  branded. End on a success screen: "Welcome to PoolBrayne — you're Tenant 00X."

Keep everything consistent with the existing design system and responsive.
```

---

## Tips for using these in Lovable

1. **Order matters.** Run Prompt 0 fully before anything else — it establishes the design tokens,
   shell, and routing every later prompt depends on.
2. **One prompt per message.** Don't paste two module prompts at once; let each finish and verify it
   before moving on. Smaller diffs = fewer regressions.
3. **If a screen drifts off-brand,** follow up with a short correction ("Use the aqua #0891B2 primary
   and match the card style on the Dashboard") rather than re-running the whole prompt.
4. **Connect Supabase later** (Lovable's native backend) when you're ready to move past mock data —
   auth, customers, jobs, and invoices map cleanly to tables.
5. **Brand assets:** there's no logo/color spec in the brief, so the aqua/teal-navy "pool" palette above
   is a recommendation — swap the hex values if Brayne AI has official brand colors.
