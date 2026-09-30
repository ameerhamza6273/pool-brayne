# Clear Pool CRM — Client Request Tracker

One place for **everything the client has asked for**, what happened to it, and where to see it.
**Rule (team + Claude):** before answering or building anything from a new client message, look here first.
If it is already listed, do not rebuild it and do not ask the client again — reply with *where to find it*
(the "Where" column). Add every genuinely new request the moment it arrives.

Status: ✅ done & checked · 🟡 done, needs the client's input/account to finish · ⏳ not built yet

Last updated: 2026-09-30

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
| *(2026-09-29, video)* Map pin lands on the wrong side of town for some addresses ("11 approximate dashes") | ✅ fixed | Free OpenStreetMap geocoding didn't have some newer subdivision streets and fell back to a city/zip-centroid guess. A free US Census Bureau lookup is now tried first for anything OpenStreetMap can't find (routed through our own server since Census blocks direct browser calls) — verified live: a day that had 11/20 approximate pins now has 0/20; the specific address in the video moved from the wrong side of Marietta to the correct spot near Roswell |
| Map centered on 2900 Holcomb Bridge Rd (was Austin, TX) and bigger | ✅ | Map tab |
| **Standard time on every job** so weekly routes keep the same stop order (customer X is always Monday's first stop for tech X) | ✅ | Schedule › **day** view › the list icon in an employee's column header = **Route order**: put the stops in order, set the first-stop time + minutes per stop, Apply. Repeating jobs keep that time every week; non-repeating jobs can be ticked "Repeat weekly" |
| Recurring series has its own standard start time | ✅ | New / Edit Recurring › "Standard start time" (shown in the Recurring Jobs table) |
| Jobs that were uploaded but "haven't recurred" | ✅ | 74 weekly series now show on the calendar for the coming weeks (dashed); the rest can be made weekly from Route order |
| Schedule is too busy to look at every day | ✅ | Month view shows 5 jobs per day + "+N more" (opens that day); **only** button next to each employee = look at one person in one click; the schedule reopens the way you left it (view + employees) |
| Pipeline / Dispatch board drag-and-drop | ✅ | Jobs & Dispatch |
| Maps active / Schedule active (was "not active") | ✅ | Map and Schedule tabs are live and interactive |
| *(2026-09-25)* **Tasks** filter box on the schedule (3rd box) | ✅ | Schedule › left panel › "Tasks" (off by default); tasks show on their dates, click = quick view |
| *(2026-09-25)* New estimates linked to **Unassigned** + quick view | ✅ | Schedule › open estimates sit in Unassigned on their date ("Estimates" box, on by default); click one = popup with lines + "Open Estimate"; the top Search finds them |
| *(2026-09-25)* Drag to make schedule sections bigger ("Other" row, hourly grid, employee list) | ✅ | Grab the grey bar under each section and drag down; double-click resets |
| *(2026-09-25)* "Techs with jobs" check box | ✅ | Schedule › left panel › "Techs with jobs" = only people with something in the dates on screen |
| *(2026-09-25)* Drag jobs up/down to change a tech's stop order; ask temporary or permanent for recurring | ✅ | Schedule › day view › list icon in the tech's column (Route order): drag rows; if any stop repeats you pick **Permanent** or **Temporary (this day only)** |
| *(2026-09-25)* Technician filter defaults to whoever signs in; date range defaults to today + Today/Week/Month buttons | ✅ | Jobs & Dispatch top row (Pipeline). Schedule/Dispatch keep showing everyone until the filter is changed by hand |

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
| *(2026-09-29, SMS)* "It won't let me print off barcodes... worked yesterday, not today" | ✅ fixed | Print Labels / Zebra Barcode used to fail completely silently if the browser blocked the popup — now shows "Your browser blocked the popup. Allow popups for this site and try again." right on the page instead of doing nothing |
| *(2026-09-25)* POS: edit the price of an item in the current sale | ✅ | POS › cart line › "Edit price" under the line total (this sale only, catalog price unchanged) |
| *(2026-09-25)* POS: see the cost by right-clicking a price | ✅ | Right-click any price in the product list or the current sale; click anywhere to hide |
| *(2026-09-25)* POS: editable return/refund disclaimer on every printed receipt | ✅ | POS › "Receipt Disclaimer" button (top); receipt › Print now prints a real receipt with it at the bottom |
| *(2026-09-25, SMS)* POS: print transactions; click a recent transaction → receipt → add notes → print / re-print | ✅ | POS › Recent Transactions › click any sale ("Show more" for older ones) |
| *(2026-09-25, QA)* POS top cards showed totals of only the last 8 sales | ✅ fixed | POS top: Today's Sales, Last 7 Days, Avg Ticket (7 days), Sales Today — real totals |
| *(2026-09-25, SMS)* Same from the customer page | ✅ | Customer › Previous Sales › click a sale |
| *(2026-09-25)* POS: one sale showed up as 3 closed transactions | ✅ fixed | Double-clicking Complete Sale saved it again; now blocked (button shows Processing…, server refuses an identical repeat) |
| *(2026-09-25)* Remove the default "0" in price boxes | ✅ | Estimate / Invoice / Job line items + PO unit cost start empty |
| *(2026-09-25)* Estimate line items: Category + Manufacturer dropdowns like POS | ✅ | Each line item, above Description (narrows "Pick from inventory") |
| *(2026-09-25)* Drag line items up/down | ✅ | Grip on the left of each line (estimate, invoice, job); the order is saved |
| *(2026-09-25)* Notes under each line item (explain / serial #) | ✅ | Notes box under each line's description; prints under the item |
| *(2026-09-25)* No empty Documents section on estimates / jobs | ✅ | With no documents it's just an "Add document" button |

## 3. Inventory, Library, Data

| Request | Status | Where to find it |
|---|---|---|
| Grid view as default on Directory, Library, Forms, Form Builder, Manufacturers, Campaigns | ✅ | Each page (table by default, cards toggle) |
| Edit button on every Job Settings list (job types, statuses, estimate statuses, call types/sources, reschedule types, cancellation reasons) | ✅ | Settings › Job Settings (pencil icon) |
| Search fields: Payments, Write-offs (reason + dates), Directory, Forms | ✅ | Those pages |
| **Delete a SKU** with a "this is permanent" confirmation | ✅ | Inventory › Catalog › red trash icon next to the pencil. SKUs already used on a job or written off can't be deleted (the popup says why) so history is kept |
| Customer CSV: front gate code, house gate code, padlock code, access notes | ✅ | Data › Import / Export › Customer List (template + export include them; same fields as the customer page's Gate Codes card) |
| **CSV import & export** for Customers, Inventory, Vendors, Inventory Categories, Inventory Manufacturers, Library Categories, Library Manufacturers | ✅ | Data › **Import / Export** |
| *(2026-09-25)* **Document List** under Data (upload labels were stuck on "Sand Change Form") | ✅ | Data › Import / Export › **Document List** card (add / rename / delete). Uploads default to "Use file name" |
| *(2026-09-25)* Edit / Delete buttons on documents | ✅ | Documents on a Job, an Estimate and an **Invoice** (pencil = rename, trash = remove) |
| Reminders: show address under the customer's name | ✅ | Reports › Reminders, and every customer picker |
| Reminders: add your own labels to the dropdown (Filter cleaning, Salt cell cleaning, Sand change, Anode replacement, …) | ✅ | Reminder label dropdown › "+ Add new label…" ; manage in Settings › Job Settings › Reminder Types |
| Dropdown lists no longer hang outside pop-ups (max 150px, scrollbar) | ✅ | Every dialog in the app |

## 4. Technician view (phone)

| Request | Status | Where to find it |
|---|---|---|
| *(2026-09-25)* Clock in / out from the phone + make requests | ✅ | Technician Field › top card |
| Order: job description → existing photos → parts/materials → documents → library → before/after photos → forms → job notes → internal notes/photos | ✅ | Technician Field › open a job |
| *(2026-09-29, video)* Before/after photo upload "not clickable" | ✅ | This was the desktop Job page's decorative Before/After Photos tab (placeholder icons, no upload wired up) — now a real upload, same as Technician Field's |
| *(2026-09-29, video)* "Upload or attach receipts" button not clickable | ✅ | Job page › Receipts tab — real upload now (reuses the Documents mechanism, kept separate) |
| *(2026-09-29, video)* Documents button not active | ✅ | Job page › Documents tab — now the same real Documents section used elsewhere on the page |
| *(2026-09-29, video call)* Known Issue tab "not clickable" | ✅ | Job page › Known Issue tab — now real, saved on the property so it shows the same on every job at that address (add/remove, visible to all techs) |
| *(2026-09-29, video call)* Clicking a job in Schedule should show a quick preview with pictures, like clicking a Task already does | ✅ | Schedule › click any job (week/day/month) — same popup Tasks use, now also shows that customer's saved photos; "Open Job" still goes to the full page |
| *(2026-09-29, video)* Equipment Inspection Checklist / One-off Job Checklist should be collapsed so notes aren't pushed off-screen | ✅ | Every form card (Technician Field + Job page) now starts collapsed, showing just the name and "X of Y completed"; tap to open |
| *(2026-09-29, video)* Job Notes typed on a job "did not save" | ✅ fixed | Technician Field › Job Notes now has its own "Save Note to Customer Record" button (previously only saved if you completed the job in the same sitting — typing notes and coming back later lost them) |
| *(2026-09-29, video)* Checked off a submitted checklist, but couldn't open/preview it again — notes "not visible" | ✅ fixed | Job page and Technician Field › **Submitted Forms** — click any entry to see exactly what was checked and the notes that were written, read-only |

---

## 5. Timesheets

| Request | Status | Where to find it |
|---|---|---|
| *(2026-09-25)* Add employees | ✅ | Timesheets lists everyone on the team; "Add Employee" opens Settings › Team |
| *(2026-09-25)* Edit times, add missed time, notes | ✅ | Timesheets › click an employee row (or +) › edit / delete / Add time, each with notes |
| *(2026-09-25)* Clock in / clock out that really saves | ✅ | Timesheets top card (and the tech Field view); saved immediately, survives refresh |
| *(2026-09-25)* Make requests; approve / deny requests | ✅ | "Make a Request" (time off, sick day, time correction); Timesheets › Requests › Approve / Deny with a reply |
| Browse other weeks | ✅ | Arrows next to "Week of" |

## Still needed from the client (send once, together)

1. **Logo file** (PNG) for invoices.
2. **Email account** — free SendGrid account + API key (or their business email SMTP details) so invoices and purchase-order emails can be sent from the CRM. (Text messages via Twilio can come later.)
3. **POS returns:** refund back to the customer's card, or cash/check only?
4. One SMS line was cut off: *"Allow us the option to click on an option to click…"* — what was the rest?
5. **Inventory (2026-09-18 list):** *"Remove the original in inventory list (default list we started with)"* — which list? A leftover demo category, or the old imported product list?
6. ~~Documents folder (2026-09-18)~~ — answered by the 2026-09-25 video: built as Data › **Document List**.
7. *(confirm only)* Inventory edit "need a drop down" — Manufacturer now suggests from a list; is that the field you meant?
8. ~~Documents on Invoices~~ — built 2026-09-25 (dev decided, no client question): invoice page › Documents (upload, attach from Library, rename, delete; not printed).
9. ~~Duplicate POS orders from the double-click bug~~ — removed 2026-09-25 with the dev's OK (6 extra copies deleted, 8 stock units put back; first sale of each group kept).

| *(2026-09-30, video)* Map shows 0 jobs for a date that Dispatch/Schedule clearly has jobs on | ✅ fixed | Map never followed the top date-range filter at all — it only moved with its own separate day arrows, so editing the shared date range (which visually looks like it drives every tab) silently did nothing to Map. Now the top range's start date always sets Map's day too |
| *(2026-09-30, SMS)* "Maps still not working" (still 0 jobs on today's date after the above fix) | ✅ fixed | A second, separate cause: Map only ever plotted real generated jobs, never a recurring series' upcoming visit that hasn't turned into a real job yet (the dashed "repeat" jobs you already see on Schedule/Dispatch). On a day where every due maintenance visit was still just one of those, Map showed 0 while Schedule showed a full day. Map now shows those the same way Schedule does |
| *(2026-09-30, SMS)* "No jobs on Schedule" (a tech's phone view showing nothing for today) | ✅ fixed | Real cause: a repeating job only gets its actual next work order once the one before it is marked Complete. If that gets missed, the next one(s) never get created for real -- invisible on a tech's phone even though the office Schedule showed it as a placeholder. Fixed so a missed one catches itself up automatically the next time anyone opens Jobs/Field, instead of staying stuck |
| *(2026-09-30, SMS)* "Estimates format not done — the PDF with the arrows" | ⏳ need the file | No record of this PDF anywhere in this tracker or the project notes -- please resend it (or describe what the arrows point to) so it can be matched to the right change |
| *(2026-09-30, SMS)* Inventory Valuation report needs an "as of" date, not a date range, for QBO | ✅ | Reports › Inventory Valuation — now shows "As of {today}" instead of the shared date range (which this report never actually used) |
| *(2026-09-30, SMS)* Grid view on Data › Import/Export | ✅ | Data › Import / Export — same table/cards toggle as Directory, Library, Forms, etc. (top right) |

## 6. Full app QA sweep (2026-09-30, "check every feature")

| Issue found | Status | Where to find it |
|---|---|---|
| Invoice/Estimate "Amount" on every list and report didn't match the real Total on the actual invoice | ✅ fixed | Invoicing list, Dashboard, and Reports now all show the same real total (with tax) that the invoice/estimate document shows |
| Automations, SMS Inbox, and Reviews were showing made-up example data as if it were real activity | ✅ fixed | Campaigns — each of those tabs now clearly says it isn't connected yet instead of showing fake activity. Seasonal Campaigns (the one you actually create) still works |
| Fleet page showed a fake simulated map/trucks instead of being honest that GPS7000 isn't connected | ✅ fixed | Fleet — now just the GPS7000 link and a plain "not connected yet" message, no more fake map |
| Two Purchase Orders had the same PO number | ✅ fixed | Renumbered; the app now assigns PO numbers itself so this can't happen again |
| Opening an Estimate lit up "Customer Invoices" in the sidebar instead of "Estimates / Quotes" | ✅ fixed | — |
| 5 old leftover test jobs (Austin, TX, dated 2024) still showing on the Dashboard and on a tech's phone schedule | ⏳ needs your OK | There's no delete button for jobs anywhere yet, and removing them directly would need your explicit go-ahead since it touches the database directly — let us know how you'd like these handled |

## Not built (deliberately, no client request yet)

Global search bar in the top bar · "dispatch nearest tech" · QuickBooks two-way sync · Zone-based scheduling filters.
