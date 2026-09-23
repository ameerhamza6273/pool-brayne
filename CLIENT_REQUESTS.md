# Clear Pool CRM — Client Request Tracker

One place for **everything the client has asked for**, what happened to it, and where to see it.
**Rule (team + Claude):** before answering or building anything from a new client message, look here first.
If it is already listed, do not rebuild it and do not ask the client again — reply with *where to find it*
(the "Where" column). Add every genuinely new request the moment it arrives.

Status: ✅ done & checked · 🟡 done, needs the client's input/account to finish · ⏳ not built yet

Last updated: 2026-09-23

---

## 1. Schedule, Jobs & Dispatch

| Request | Status | Where to find it |
|---|---|---|
| Filter individual employees on the schedule so it's easy to read (*asked twice*) | ✅ | Jobs & Dispatch › **Schedule** › left panel: tick/untick each employee, Select All, Unassigned, Search Professional |
| Week / Day / Month views, hourly grid | ✅ | Schedule › month · week · day buttons (top right) |
| Day view: one column per employee with job count + day total | ✅ | Schedule › **day** |
| Click an empty slot to add a job; drag to reschedule/reassign | ✅ | Schedule (week/day) |
| Show customer first + last name on the calendar | ✅ | Calendar chips show the full name |
| Look at the calendar by employee color or job/task color | ✅ | Schedule › "Color by: Employee / Job type" |
| Edit an employee's color | ✅ | Schedule › colored square next to each employee |
| Recurring jobs must repeat on the calendar (not only the first date) | ✅ | Future dates show as dashed "repeat" chips; click one to open the series |
| Recurring jobs: grid view (default) + search (customer, tech, day, job type) | ✅ | Schedule tab › **Recurring Jobs** (table ⇄ cards toggle) |
| Recurring: "notes for this job only" and "forms for all jobs" fields | ✅ | New Recurring / Edit Recurring |
| Convert a job to recurring and back (one-time) | ✅ | Job page › **Make Recurring** / **Make one-time**; also on the Recurring Jobs list |
| New Recurring: show address under the customer when searching | ✅ | New Recurring dialog |
| Search jobs: Technician, Job Type and **date range** dropdowns to its right | ✅ | Jobs & Dispatch (top row, applies to every tab) |
| Map: show **all** addresses, numbered stops, route line between jobs | ✅ | Jobs & Dispatch › **Map** (29/29 jobs, numbered pins per tech, road route lines; dashed pin = approximate address) |
| Map centered on 2900 Holcomb Bridge Rd (was Austin, TX) and bigger | ✅ | Map tab |
| **Standard time on every job** so weekly routes keep the same stop order (customer X is always Monday's first stop for tech X) | ✅ | Schedule › **day** view › the list icon in an employee's column header = **Route order**: put the stops in order, set the first-stop time + minutes per stop, Apply. Repeating jobs keep that time every week; non-repeating jobs can be ticked "Repeat weekly" |
| Recurring series has its own standard start time | ✅ | New / Edit Recurring › "Standard start time" (shown in the Recurring Jobs table) |
| Jobs that were uploaded but "haven't recurred" | ✅ | 74 weekly series now show on the calendar for the coming weeks (dashed); the rest can be made weekly from Route order |
| Schedule is too busy to look at every day | ✅ | Month view shows 5 jobs per day + "+N more" (opens that day); **only** button next to each employee = look at one person in one click; the schedule reopens the way you left it (view + employees) |
| Pipeline / Dispatch board drag-and-drop | ✅ | Jobs & Dispatch |
| Maps active / Schedule active (was "not active") | ✅ | Map and Schedule tabs are live and interactive |

## 2. Point of Sale, Estimates, Invoices

| Request | Status | Where to find it |
|---|---|---|
| Sell a negative number (return / exchange) | ✅ | POS › **Return Mode** or "Return this item" on a cart line |
| Couldn't close out a sale after picking payment type | ✅ fixed | POS › Charge / Refund |
| Full payment is the default (unless "Add" is used for split) | ✅ | POS payment window |
| Item # as the first field | ✅ | POS list |
| Refund a return **to the customer's card** | 🟡 | Needs the client's decision — today returns go back as Cash / ACH / Check |
| Labor SKUs (service-1 … service-67) under Labor, not taxed, listed above materials | ✅ | Estimates / Invoices; Inventory shows them as "Non-inventory" |
| Document list to pull from on estimates | ✅ | Library › upload 5–10 documents once; Estimate › "attach from Library" |
| Invoice looks like their old emailed invoice (header boxes, photos, service notes, line items) | ✅ | Customer Invoices › open an invoice |
| **Email / text the invoice to the customer** | 🟡 | Needs the client's email-sending account (SendGrid or their email SMTP); texting needs Twilio |
| Company logo on invoices | 🟡 | Needs the logo file from the client |
| Pop-ups (New Estimate, New Task, Purchase Order) at 90% of the screen | ✅ | Those dialogs |
| Printing: no browser date/page-number header/footer; no menus on the printout | ✅ | Inventory labels (Avery + Zebra) now print as clean PDFs; PO / invoice / estimate print |

## 3. Inventory, Library, Data

| Request | Status | Where to find it |
|---|---|---|
| Grid view as default on Directory, Library, Forms, Form Builder, Manufacturers, Campaigns | ✅ | Each page (table by default, cards toggle) |
| Edit button on every Job Settings list (job types, statuses, estimate statuses, call types/sources, reschedule types, cancellation reasons) | ✅ | Settings › Job Settings (pencil icon) |
| Search fields: Payments, Write-offs (reason + dates), Directory, Forms | ✅ | Those pages |
| **Delete a SKU** with a "this is permanent" confirmation | ✅ | Inventory › Catalog › red trash icon next to the pencil. SKUs already used on a job or written off can't be deleted (the popup says why) so history is kept |
| Customer CSV: front gate code, house gate code, padlock code, access notes | ✅ | Data › Import / Export › Customer List (template + export include them; same fields as the customer page's Gate Codes card) |
| **CSV import & export** for Customers, Inventory, Vendors, Inventory Categories, Inventory Manufacturers, Library Categories, Library Manufacturers | ✅ | Data › **Import / Export** |
| Reminders: show address under the customer's name | ✅ | Reports › Reminders, and every customer picker |
| Reminders: add your own labels to the dropdown (Filter cleaning, Salt cell cleaning, Sand change, Anode replacement, …) | ✅ | Reminder label dropdown › "+ Add new label…" ; manage in Settings › Job Settings › Reminder Types |
| Dropdown lists no longer hang outside pop-ups (max 150px, scrollbar) | ✅ | Every dialog in the app |

## 4. Technician view (phone)

| Request | Status | Where to find it |
|---|---|---|
| Order: job description → existing photos → parts/materials → documents → library → before/after photos → forms → job notes → internal notes/photos | ✅ | Technician Field › open a job |

---

## Still needed from the client (send once, together)

1. **Logo file** (PNG) for invoices.
2. **Email account** — free SendGrid account + API key (or their business email SMTP details) so invoices and purchase-order emails can be sent from the CRM. (Text messages via Twilio can come later.)
3. **POS returns:** refund back to the customer's card, or cash/check only?
4. One SMS line was cut off: *"Allow us the option to click on an option to click…"* — what was the rest?
5. **Inventory (2026-09-18 list):** *"Remove the original in inventory list (default list we started with)"* — which list? A leftover demo category, or the old imported product list?
6. **Documents (2026-09-18 list):** *"Need a Document folder to put from 'Document List'"* — folders inside Library, or a Documents section on each Job/Estimate?
7. *(confirm only)* Inventory edit "need a drop down" — Manufacturer now suggests from a list; is that the field you meant?

## Not built (deliberately, no client request yet)

Global search bar in the top bar · "dispatch nearest tech" · QuickBooks two-way sync · Zone-based scheduling filters.
