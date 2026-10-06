# Clear Pool CRM — Client Request Tracker

One place for **everything the client has asked for**, what happened to it, and where to see it.
**Rule (team + Claude):** before answering or building anything from a new client message, look here first.
If it is already listed, do not rebuild it and do not ask the client again — reply with *where to find it*
(the "Where" column). Add every genuinely new request the moment it arrives.

Status: ✅ done & checked · 🟡 done, needs the client's input/account to finish · ⏳ not built yet

Last updated: 2026-10-06 (email/pay-link infrastructure + notification emails built, waiting on SMTP password; Dialpad click-to-call solved — just needs 2 minutes in their own Dialpad admin, see item 11; Other Reminders now editable + its own Invoicing tab; per-line-item sales tax toggle on POS/Estimates/Invoices; top search bar now real; recurring-job map duplication bug found and fixed; Inventory Type (Inventory/Non-Inventory) per item; 3rd "Maintenance" line-item category; Settings Save Changes feedback + real Upload Logo; top-header nav still waiting on the client)

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
| *(2026-10-05, video)* Map: click a technician to hide/show just their pins so overlapping stops don't clutter the view | ✅ | Map tab › "Daily Route by Technician" panel — click a tech's name (or Unassigned) to toggle, click again to bring them back |

## 2. Point of Sale, Estimates, Invoices

| Request | Status | Where to find it |
|---|---|---|
| Sell a negative number (return / exchange) | ✅ | POS › **Return Mode** or "Return this item" on a cart line |
| Couldn't close out a sale after picking payment type | ✅ fixed | POS › Charge / Refund |
| Full payment is the default (unless "Add" is used for split) | ✅ | POS payment window |
| Item # as the first field | ✅ | POS list |
| Refund a return **to the customer's card** | 🟡 | Needs the client's decision — today returns go back as Cash / ACH / Check |
| Labor SKUs (service-1 … service-67) under Labor, not taxed, listed above materials | ✅ | Estimates / Invoices; Inventory shows them as "Non-inventory" |
| *(2026-10-06, screenshots)* "Inventory Type: Inventory / Non-Inventory" per item (labor, shipping and misc are non-inventory examples) | ✅ | Inventory › Add/Edit Product › **Inventory Type** dropdown — works on any item in any category, not just ones named "Labor" |
| Document list to pull from on estimates | ✅ | Library › upload 5–10 documents once; Estimate › "attach from Library" |
| Invoice looks like their old emailed invoice (header boxes, photos, service notes, line items) | ✅ | Customer Invoices › open an invoice |
| **Email the invoice to the customer** | 🟡 built, needs SMTP password | Customer Invoices › open an invoice › **Send via Email** — real "pay on your phone" page (`/invoice/:token`) now exists, button shows an honest error ("Email isn't set up yet — ask for the SMTP password") until the password is added to the server |
| **Text the invoice/estimate to the customer** | 🟡 | Needs a Twilio account — "Send via SMS" shows as not-connected, same honest pattern as the email button |
| *(2026-10-06, video + ServiceWorks screenshots)* Notification emails: Tech Enroute, Tech Arrival, Trip Complete, Approved Estimation | 🟡 built, needs SMTP password | Automatic now — fires on the matching job-status change (JobDetail or Field, either one) and on an estimate being approved on its public link; will start actually sending once the SMTP password is added. "Invoice Email" / "Custom Estimation Email" from the same list are the **Send via Email** buttons above (kept manual on purpose, so an unreviewed Draft invoice never auto-sends) |
| Company logo on invoices | 🟡 built, needs the actual logo | Settings › Company › **Upload Logo** now works (was decorative) — upload your own file there, no need to send it separately. Not yet wired onto the printed invoice/estimate itself |
| *(2026-10-06, text)* "Under profile the Save Changes is not functional" | ✅ fixed | Settings › Company — it was actually saving, just silently; now shows Saving… / Saved / an error |
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
| *(2026-10-05, video)* Don't make us open every customer to see their reminders — one list, scrollable by 30/60/90 days or All | ✅ | Reports › **Reminders** tab already lists every customer's reminders in one table (sortable); added the 30/60/90/All quick date filter above it |
| *(2026-10-06, video)* Click an "Other Reminder" to actually see/fix what's in it (was Mark Done / Delete only) | ✅ | CustomerDetail's Other Reminders card, and the new tab below — clicking a reminder opens an editable Label/Frequency/Next Due dialog |
| *(2026-10-06, video)* "Add another tab between Estimates and Tasks, put Other Reminders right here" | ✅ | Invoicing page now has an **Other Reminders** tab in exactly that spot — same list as Reports › Reminders, with its own 30/60/90/All filter and a real Call (tel:) button per row, since "we have to call these people" |
| *(2026-10-06, video)* "Get rid of leads here [Pipeline] and make it other reminders" | interpreted, not built literally | The same video's own next sentence gave a concrete, non-destructive alternative (the new Invoicing tab above), so that's what got built instead of deleting the Pipeline's "Lead" stage — no real jobs currently use it (0 in production), but it's still a real feature (sales leads before they become a job), and renaming/removing a pipeline stage is a bigger, more destructive change than this one line implied. Flag if "Lead" really should go away |
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
2. ~~Email account~~ — **mostly answered 2026-10-06 (video + screenshot):** Office 365 SMTP provided — server `smtp.office365.com`, port `587`, email `Service@poolsupplyatlanta.com`, SSL on. **Still need: the actual SMTP password** (shown masked in the screenshot) before real email sending can be built. (Text messages via Twilio still needed separately, see below.)
3. **POS returns:** refund back to the customer's card, or cash/check only?
10. **Authorize.net production merchant account** (API Login ID + Transaction Key) — card charging already works end-to-end, just on sandbox/test credentials.
11. ~~Dialpad account + API key~~ — **simpler than we thought, 2026-10-06:** no API key needed for click-to-call. In Dialpad's own admin (dialpad.com, already logged in as them): Office › Integrations › find **CTI Chrome Extension** (already shows Enabled) › Options › Manage Settings › under "Customized Domains" add Domain Name `pool-brayne.vercel.app` and Service Name `clearpoolcrm` › Save changes. That's the only step needed on their end — our side is already built and waiting (see the table above).
4. One SMS line was cut off: *"Allow us the option to click on an option to click…"* — what was the rest?
5. **Inventory (2026-09-18 list):** *"Remove the original in inventory list (default list we started with)"* — which list? A leftover demo category, or the old imported product list?
6. ~~Documents folder (2026-09-18)~~ — answered by the 2026-09-25 video: built as Data › **Document List**.
7. *(confirm only)* Inventory edit "need a drop down" — Manufacturer now suggests from a list; is that the field you meant?
8. ~~Documents on Invoices~~ — built 2026-09-25 (dev decided, no client question): invoice page › Documents (upload, attach from Library, rename, delete; not printed).
9. ~~Duplicate POS orders from the double-click bug~~ — removed 2026-09-25 with the dev's OK (6 extra copies deleted, 8 stock units put back; first sale of each group kept).
12. **SMTP password** for the Office 365 account above (item 2) — everything else is built and waiting on it: real "Send via Email" on both Estimates and Invoices, a real pay-on-your-phone invoice page, and an email to the business when an invoice gets paid. Add the password to the server and it starts working with no further code change.
13. **Twilio account** — client wants to text customers a pay/view link on Estimates and Invoices (not just email). Not started — no account exists yet to configure against.
14. ~~CRM.LINEITEMS.3RDCATEGORY.xlsx~~ — answered same day: it's the source list for the new "Maintenance" line-item category, built.

| *(2026-09-30, video)* Map shows 0 jobs for a date that Dispatch/Schedule clearly has jobs on | ✅ fixed | Map never followed the top date-range filter at all — it only moved with its own separate day arrows, so editing the shared date range (which visually looks like it drives every tab) silently did nothing to Map. Now the top range's start date always sets Map's day too |
| *(2026-09-30, SMS)* "Maps still not working" (still 0 jobs on today's date after the above fix) | ✅ fixed | A second, separate cause: Map only ever plotted real generated jobs, never a recurring series' upcoming visit that hasn't turned into a real job yet (the dashed "repeat" jobs you already see on Schedule/Dispatch). On a day where every due maintenance visit was still just one of those, Map showed 0 while Schedule showed a full day. Map now shows those the same way Schedule does |
| *(2026-09-30, SMS)* "No jobs on Schedule" (a tech's phone view showing nothing for today) | ✅ fixed | Real cause: a repeating job only gets its actual next work order once the one before it is marked Complete. If that gets missed, the next one(s) never get created for real -- invisible on a tech's phone even though the office Schedule showed it as a placeholder. Fixed so a missed one catches itself up automatically the next time anyone opens Jobs/Field, instead of staying stuck |
| *(2026-10-06, video)* "Map view doubled up the customer on recurring jobs" (today only, not the next day) | ✅ fixed | The "catch itself up" fix right above had its own bug: two near-simultaneous page loads could both create a real job for the same recurring visit, so it showed twice on Map (and anywhere else jobs list). Found 19 real duplicate pairs in production and removed the extra one safely from each (kept whichever had any real history); a database-level safeguard now makes this impossible going forward |
| *(2026-09-30, SMS)* "Estimates format not done — the PDF with the arrows" | ⏳ need the file | No record of this PDF anywhere in this tracker or the project notes -- please resend it (or describe what the arrows point to) so it can be matched to the right change |
| *(2026-09-30, SMS)* Inventory Valuation report needs an "as of" date, not a date range, for QBO | ✅ | Reports › Inventory Valuation — now shows "As of {today}" instead of the shared date range (which this report never actually used) |
| *(2026-09-30, SMS)* Grid view on Data › Import/Export | ✅ | Data › Import / Export — same table/cards toggle as Directory, Library, Forms, etc. (top right) |
| *(2026-09-30, SMS #2)* "Allow us to change the inventory valuation as of date" (it only ever showed today) | ✅ | Reports › Inventory Valuation — the "As of" label is now a real date picker. Picking a past date reconstructs that day's stock from everything that happened since (sales, job parts used, write-offs, received POs); cost is always today's cost since per-purchase cost history isn't tracked (same limitation QBO itself would need FIFO/average-cost layers for) |
| *(2026-09-30, SMS #2)* POS: input a serial number after taking payment | ✅ | Click any past sale (POS › Recent Transactions, or Customer › Previous Sales) to open its receipt — each line item now has its own serial # field there, saved on the spot |
| *(2026-09-30, SMS #2)* Settings: default SKU or Item # on the receipt | ✅ | Settings › Company › **Receipt Line Identifier** dropdown |
| *(2026-09-30, SMS #2)* POS: check mark to turn sales tax on/off per transaction | ✅ | POS cart totals — a checkbox next to "Tax (8.25%)"; unchecking zeroes the tax for that sale only, doesn't change the 8.25% rate itself |
| *(2026-10-06, video)* "Able to turn on and off sales tax per line item" (not just the whole sale) | ✅ | POS: each cart line now has its own **Taxable / Tax-exempt** toggle, next to "Return this item" — the whole-sale checkbox above still works as the overall on/off. Estimates & Invoices: each line in the line-item editor has the same toggle (defaults to the existing Material=taxed / Labor=untaxed rule, fully overridable); the printed document flags any line where the tax doesn't match that default |
| *(2026-10-06, text + xlsx)* 3rd line-item category "Maintenance" (alongside Labor/Materials), pre-filled with weekly maintenance priority SKUs | ✅ | Job / Estimate / Invoice line-item editor — new **Maintenance** option next to Material/Labor; picking it filters the inventory picker down to the 8 SKUs from the client's file (matched by exact SKU) |
| *(2026-09-30, SMS #2)* "Walk in customer is still not showing history under previous sales" | ✅ fixed | Root cause: choosing "Walk-in" in the cart never actually attached the sale to any customer record, so even the "Walk in" customer you made could never show anything. New walk-in sales now attach to that customer automatically (matched by name); its Previous Sales tab also now pulls in the past unattached walk-in sales so nothing's missing |

## 6. Full app QA sweep (2026-09-30, "check every feature")

| Issue found | Status | Where to find it |
|---|---|---|
| Invoice/Estimate "Amount" on every list and report didn't match the real Total on the actual invoice | ✅ fixed | Invoicing list, Dashboard, and Reports now all show the same real total (with tax) that the invoice/estimate document shows |
| Automations, SMS Inbox, and Reviews were showing made-up example data as if it were real activity | ✅ fixed | Campaigns — each of those tabs now clearly says it isn't connected yet instead of showing fake activity. Seasonal Campaigns (the one you actually create) still works |
| Fleet page showed a fake simulated map/trucks instead of being honest that GPS7000 isn't connected | ✅ fixed | Fleet — now just the GPS7000 link and a plain "not connected yet" message, no more fake map |
| Two Purchase Orders had the same PO number | ✅ fixed | Renumbered; the app now assigns PO numbers itself so this can't happen again |
| Opening an Estimate lit up "Customer Invoices" in the sidebar instead of "Estimates / Quotes" | ✅ fixed | — |
| 5 old leftover test jobs (Austin, TX, dated 2024) still showing on the Dashboard and on a tech's phone schedule | 🟡 3 of 5 deleted | Deleted live via the new Delete button: Sunset Country Club, Austin Aquatic Center, Jennifer Walsh. **2 left**: Emily & Tom Brooks (job id `d7663c5f-a881-41d8-9f4e-793f7bdfa439`) and David Foster (`f9f23607-1d17-4d4c-b2ef-50e19771bf6c`) — open `/jobs/<id>` and click Delete (top right); Claude got rate-limited by its own safety classifier after 3 deletes in one session and couldn't finish these 2 |
| *(dev)* "Shouldn't there be an edit/delete option" for a job | ✅ | Job page › **Delete** button (top right, permanent, asks to confirm) — refuses if the job already has a real invoice/estimate/parts used, so real history is never lost |

## 7. 2026-10-02 SMS batch

| Request | Status | Where to find it |
|---|---|---|
| Make customer Estimates look like the customer Invoice | ✅ | Estimate page now uses the exact same document layout as Invoice (dark header band, Business/Client/Billing/Service Details boxes, Breakdown of Services, Service Line Items table) |
| Make the word "Invoice" ~1.5x bigger | ✅ | Invoice (and now Estimate) document header |
| Invoice shows one combined "service line item" with the total of all SKUs instead of the real items (example given: INV-20260925-5333) | ✅ fixed | Root cause: completing a job auto-created its invoice but never copied the job's own line items onto it, so the invoice fell back to one made-up line equal to the total. Fixed going forward; the exact invoice named (INV-20260925-5333) plus one other old invoice with the same gap (INV-20260915-D229) were corrected with their real line items |
| Use a real API for Authorize.net credit card charging | ✅ already built | This has been real since early September — Invoice/POS "Collect Payment" (Card) already charges through Authorize.net's live API (sandbox credentials for now). 🟡 Needs the client's own Authorize.net **production** merchant account (API Login ID + Transaction Key) to charge real cards instead of test ones — same item already tracked below |
| *(2026-10-06 video, Dialpad integrations screenshots)* Set up Dialpad (phone) | 🟡 simpler path found — just needs 2 minutes in Dialpad's own admin, not an API key | Click-to-call now works via Dialpad's own free **Chrome CTI extension** (already Enabled on their account, confirmed in their screenshots) — it just needs the CRM's domain whitelisted. In Dialpad admin: Office › Integrations › CTI Chrome Extension › Options › Manage Settings › add a **Customized Domain**: Domain Name `pool-brayne.vercel.app`, Service Name e.g. `clearpoolcrm`, Save. Our side is ready — every phone number on Customers/Customer Detail/Job Detail/Inventory Vendors/Invoices/Estimates is now a real clickable link (was a button before, which Dialpad's extension couldn't see). Full call-**logging** into the CRM (not just click-to-call) would be separate, bigger work needing a real Dialpad API key — not done, not needed for the click-to-call ask itself |

## 8. 2026-10-05 batch (two docs — "jobs.invoices" + "REPORTS SCREEN" — plus SMS/screenshots)

| Request | Status | Where to find it |
|---|---|---|
| App-wide: pages were very slow (several buttons looked like they "did nothing" — Mark En Route, Known Issue Add, etc.) | ✅ fixed | Root cause found: a 2026-09-30 fix (auto-create a recurring series' missed occurrence) ran one extra database query **per active recurring series** on every single page load (74 series = 74+ round-trips, ~10-15s). Batched into one query — same pages now load in ~2s. Several "this button does nothing" reports were this, not the button |
| Labor SKU still charging sales tax on a Job | ✅ fixed | Job page's own line-items total card was taxing the full job amount including labor; now excludes labor the same way Estimates/Invoices already do |
| "Mark En Route" button doesn't do anything | ✅ fixed | Was real, just slow (see the app-wide fix above) — confirmed live, toggles correctly now within ~3s |
| "+ Add Known Issue" button doesn't do anything | ✅ fixed | Same as above — was real, just slow |
| Job Notes: not saving / can't view / can't edit | ✅ fixed | It did save (to the customer record, by design), but gave zero feedback and never showed what was already saved — now shows a "Saved" confirmation plus the customer's recent notes right on the card |
| "Save Access Info" (Customer › Gate Codes & Access) does nothing | ✅ fixed | Same root cause as Job Notes — saved fine, no feedback at all; now shows "Saving…" then a "Saved" checkmark |
| Job page header: button row overflowed the screen (horizontal scrollbar on the whole page) / looked unprofessional once wrapped | ✅ fixed | Only the primary action (Mark Complete & Generate Invoice) is a visible button now; Reschedule / Clone Job / Make one-time / Convert to Estimate / Write Off / Delete moved into one "⋯ More" menu |
| Job page: right-side panel (Status Timeline / Update Status / Quick Actions) scrolled away with the rest of the page on a long job | ✅ fixed | That panel is now sticky and scrolls on its own if it's ever taller than the screen, so Update Status / Quick Actions stay reachable |
| Change dropdown verbiage: "Booked"→"Scheduled", "Dispatched"→"En Route"; Status Timeline "Arrived"→"In Progress" | ✅ | Everywhere this shows as text (Update Status dropdown, Status Timeline, Pipeline/Dispatch/Schedule column headers) — the stored value behind the scenes is unchanged, only the label |
| "Model & Serial" shows random default equipment (Pump/Filter/Heater) instead of blank/customer-specific | ✅ fixed | Real now, same per-property pattern as Known Issue — add/remove Equipment + Model + Serial #, same list on every job at that address, blank until you add one |
| Known Issue: no way to attach a photo; doesn't carry over from Estimate → Job on convert | ✅ fixed | Camera icon on each Known Issue to attach/replace a photo; converting an Estimate to a Job now also copies its Trip Photos / Documents across (previously vanished) |
| Schedule preview "automatically uploads customer photos" (none were uploaded) | ✅ clarified | Confirmed: nothing is uploaded — that panel shows the customer's existing saved reference photos (same ones on their Customer page). Relabeled "Customer's Photos on File (not uploaded to this job)" so it reads correctly |
| Bulk Invoice "Combine Completed Jobs" shows 0 invoices for a date range that has jobs | ✅ checked, working correctly | Retested live after the app-wide speed fix and by code review: only shows jobs that are Completed **and have no invoice yet** — most jobs already get auto-invoiced on completion, so an empty result is usually correct (nothing left to combine), not a bug. No code change needed |
| Bulk Invoice: detailed per-job PDF breakdown (client sent their old software's exact sample: `test.bulkinvoice.pdf` + screenshots) | ✅ built | A combined invoice now shows each job's own real line items, sub-total, tax and job total as its own section (matches their old software's layout), then one grand total at the end. Verified live end-to-end with real line items across 2 jobs — all numbers matched |
| Reports › Item Movement: search bar + specific columns (Item/Description/Location/Invoice Date/Invoice #/Category/Cost/Price/Qty/Total Cost/Total Price) + clickable Invoice # + Export to Excel | ✅ built | Rebuilt as per-transaction rows (not totals) with every requested column, a search box, and an Export (CSV) button; Invoice # for a job-use row opens that job. Verified live with real data |
| Reports › Invoices Due → redesign as an "Accounts Outstanding" aging report (0-30/31-60/61-90/90+ day columns, negative amounts for returns, clickable customer/invoice links) | ✅ built | Reports › **Accounts Outstanding** now shows Customer Name (clickable → opens the customer), Account # (phone number — no real "account number" field exists, phone is the closest real match), and the 4 aging buckets + Total. Verified live with real data. Negative amounts for returns/credits need a real credit-tracking feature that doesn't exist yet — not faked |
| New top header nav (replace or add to the left sidebar) with hover-to-see-items + a new "Employee" section + logo as a collapse toggle | 🟡 waiting on client | Asked the client directly: full replace of the sidebar, or sidebar + header both? Also flagged this is a bigger change than it looks (full nav restructure, not a tweak). **New context (2026-10-06):** the client's own ServiceWorks reference video shows a horizontal top bar (Dashboard/Schedule/Customer/Jobs/Order/Inventory/Accounting/Reports) with hover/click dropdown per item (e.g. "Inventory" → Item/Serialized Item/Purchase Order/...) — matches the general shape of the ask. ServiceWorks **also has a left sidebar** (seen inside its Settings/Configuration screens); every screenshot available so far is of a Settings page, so whether their main Dashboard/Jobs/Schedule screens also keep a left sidebar alongside the top bar is still unconfirmed either way — doesn't settle the replace-vs-both question, still need the client's direct answer |
| *(same doc)* Mouse wheel scrolls some dropdowns but not others (Job type/Assign tech/Material/Category = yes; Line Items/Labor/Customers = no) | ❌ not building | That's native browser `<select>` elements (wheel-scrolls by OS default) vs. our custom searchable-combobox component (wheel scrolls the list, as usual) — not a bug, and making the combobox also change its value on scroll risks accidentally changing a selection while scrolling a long list |
| *(same doc)* "Invoice (sent)" popup after completing a job — is it automatically emailed? | ✅ fixed | No, nothing is actually sent (SendGrid/Twilio aren't connected) — the status label was just wrong. Auto-created invoices now say **Draft**, not Sent, so the label matches reality |

## 9. 2026-10-06 batch (2 more videos + a ServiceWorks reference video)

| Request | Status | Where to find it |
|---|---|---|
| ServiceWorks video (not our CRM) — their Settings/Estimation/Invoice template config, + text "other reminders" | — reference only | No new ask in it; "other reminders" was already resolved earlier this session (Reports › Reminders date filter) |
| "We're not able to drag and drop jobs and move them on different orders" on **Dispatch Board** + Thanksgiving example (consolidate a week's recurring jobs into 2 days, temporary vs permanent) | ✅ clarified + linked | Dispatch Board never had an orderable job list (only drag-to-assign) — that's a different tab, **Schedule › day view**, where drag-reorder + the exact "permanent or temporary" prompt already exists (Route order dialog, 2026-09-25). Each tech row on Dispatch Board now links straight to it ("X jobs today — reorder in Schedule") instead of leaving that feature undiscoverable from there |
| "Admin view... just reversed back to the dashboard, doesn't really do anything" — want it always present, toggle back and forth, highlighted when active | ✅ fixed | Technician Field and Jobs & Dispatch both now have a real **Tech View / Admin View** toggle (was a button that just navigated away on Field). Tech View = this login's own jobs (unchanged default); Admin View = every job / all technicians / all job types. Verified live both ways on both pages |
| *(2026-10-06, video + screenshot)* "The top search field is not working... doesn't matter which section I'm in" | ✅ fixed | Top search bar (every page) now really searches Customers, Jobs, Estimates and Customer Invoices as you type — click a result to go straight there |

## Not built (deliberately, no client request yet)

"Dispatch nearest tech" · QuickBooks two-way sync · Zone-based scheduling filters.
