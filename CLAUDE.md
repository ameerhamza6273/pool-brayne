# PoolBrayne / Clear Pool CRM — Project Memory

> Yeh file Claude Code khud-ba-khud har naye session ki shuruwaat mein read kar leta hai.
> Naye terminal mein sirf kehna: "project read kar lo" — is file se sab context mil jayega.
> **Rule for Claude:** har meaningful session ke aakhir mein (ya jab user kahe) `## Session
> Changelog` mein neeche ek nayi dated **one-liner** entry add karo — kya build/fix hua, kya
> pending reh gaya. **Verbose play-by-play mat likho** (exact click sequences, step-by-step
> browser-testing narration, restated context) — agar koi decision ya gotcha future sessions ke
> liye genuinely reusable hai, usko uske sahi structural section mein daalo (Architecture /
> Known Gotchas / Open Items), changelog mein nahi. Yeh file 2026-09-10 ko condense ki gayi thi
> (pehle ~2500 lines ki verbose session history thi) — usi tarah bloat dobara mat hone dena.

## Project Overview

**Clear Pool CRM** (user-facing brand name; internally still "PoolBrayne" in repo/infra names) —
pool service management SaaS for a real client, **Bryan**, whose business is "Pool Supply
Atlanta" (Atlanta, GA). Originally scaffolded from Bolt.new, then substantially rebuilt.

**Stack:** Vite + React 18 + TypeScript, React Router v7, Tailwind CSS + shadcn/ui (Radix
primitives), recharts, react-hook-form + zod, `@supabase/supabase-js` (auth + storage only —
see below), **`backend/` — a separate Fastify 5 + TypeScript API** that all app data goes
through.

**Client note — Bryan owns two separate businesses/products, don't cross-assume:** this repo
(PoolBrayne / Clear Pool CRM) and a sibling repo `D:\React\yardward-pro` ("Engage CRM", a
hydrovac/fleet business) are **two different businesses with separate fleets, GPS vendors, and
integration decisions** — see `[[client_two_projects]]` memory. Only use yardward-pro as a
**pattern/architecture reference**, never copy its business decisions (e.g. Engage uses Geotab
GPS; PoolBrayne's trucks use a different, API-less consumer tracker — see Integrations below).

## Architecture

- `src/App.tsx` — routing. Public routes: `/sales`, `/login`, `/signup`, `/onboarding`,
  `/estimate/:token` (customer-facing public estimate approval), `/form/:token` (customer-facing
  public submitted-form view). Everything else under `ProtectedRoute` + `AppShell`
  (collapsible sidebar sections, mobile hamburger + bottom "More" sheet).
- `src/lib/supabase.ts` — Supabase client, used **only** for `.auth.*` (login/signup/session) and
  `.storage.*` (direct-from-browser file uploads for job/customer photos, signatures, documents,
  library files — buckets: `job-attachments` [reused for tasks/library/estimate docs via path
  prefixes], `customer-attachments`). **No `supabase.from(...)` calls anywhere in the frontend**
  — all DB reads/writes go through the backend API (`src/lib/apiClient.ts` + `src/lib/api/*.ts`).
- `backend/` — Fastify API server (see "Backend API" below) — this is what the frontend actually
  talks to for every table.
- `src/lib/data.ts` — **no longer a data source.** Only holds frontend-only static
  config/enum arrays that have no DB table (job types, statuses, cancellation reasons, call
  types, UOM lists, Spanish translations, etc.).
- `src/lib/auth-context.tsx` — real `supabase.auth` (signUp/signIn/signOut), session restore
  with loading state. `signUp` passes `full_name`/`company_name` (or `existing_tenant_id` for
  staff invites) via `options.data`, consumed by the `handle_new_user` DB trigger.
- `src/lib/geocode.ts` — free Nominatim (OpenStreetMap) address search/geocode, rate-limited
  queue + cache; `src/lib/smarty.ts` — optional paid Smarty US-Autocomplete, used instead of
  Nominatim when `VITE_SMARTY_EMBEDDED_KEY` is set (client hasn't provided a key yet).
- `src/lib/authorizenet.ts` — loads Authorize.net **Accept.js**, tokenizes card data client-side
  (PCI-safe — raw card number never touches our server).
- `src/pages/` — Dashboard, Customers/CustomerDetail, Jobs/JobDetail (+ Map/Schedule/Dispatch/
  Pipeline tabs), Field (technician mobile view), Inventory (Catalog/Vendors/Purchase Orders/
  Vendor Bills/Variance/Write-Offs), Fleet, Timesheets, PointOfSale, Invoicing/InvoiceDetail/
  EstimateDetail, Campaigns, Settings, SalesPortal, Onboarding, Login, Signup, Library,
  Manufacturers, Directory, Reports, FormBuilder, PublicEstimate, PublicForm.
- Shared components worth knowing: `LineItemsEditor` (Estimate/Invoice/Job line items, inventory
  picker), `SearchableSelect` (type-ahead combobox for large lists — customers/inventory now
  number in the thousands, see Known Gotchas), `AddressAutocomplete`, `CardPaymentForm`
  (Authorize.net Accept.js), `DocumentsSection`, `CategoryPicker` (4-level taxonomy), `DynamicForm`
  (renders a `form_templates` row — see Form Builder below).
- `src/hooks/use-config-lists.ts` (`useConfigLists()`, added 2026-09-18) — fetches all 7
  `tenant_config_lists` lists (job types/statuses, estimate statuses, call types/sources,
  reschedule types, cancellation reasons) via `src/lib/api/configLists.ts`, falls back to the
  matching static array in `src/lib/data.ts` while loading so nothing flashes empty. Replaces the
  old pattern of importing those arrays directly from `data.ts` — **any page that needs one of
  these lists should call this hook, not import the static array** (the static arrays still exist
  only as the hook's loading-state fallback). Settings > Job Settings tab is the only editor
  (Add/Delete wired to the same table); consumers seen so far: Jobs.tsx (New Job dialog + Pipeline
  badges), JobDetail.tsx (badges, reschedule/cancellation reason selects), FormBuilder.tsx
  (Applies-To selector).
- i18n: `src/lib/language-context.tsx` (`useLanguage()` → `{ lang, setLang, toggle, t }`, `lang`
  persisted to `localStorage`) + `src/hooks/use-translator.ts` (the separate live-translate widget
  used only by JobDetail's Job Notes card). Client feedback 2026-09-11: `t()` used to be a pure
  dictionary lookup (untranslated dictionary miss → English), so translation only ever worked on
  JobDetail's own hardcoded labels. `t()` now falls back to the same free Google Translate
  endpoint for any dictionary miss and caches the result in `localStorage` — call `t("Any string")`
  anywhere (including dynamic tenant-authored content like Form Builder field labels) and it just
  works, no dictionary entry needed. **Gotcha:** never wrap a string in `t()` if it's also used as
  an object/lookup key or compared with `===` elsewhere (e.g. `statusColors[x]`, `job.status ===
  "Completed") — translate only the rendered display copy, never the underlying value. **Gotcha:**
  the Google endpoint is unauthenticated/unofficial and does soft-rate-limit under a burst of
  concurrent calls (observed directly during dev) — `fetchTranslation()` serializes requests
  through a small queue with spacing + one retry rather than firing them all at once; don't remove
  that queue. **Gotcha:** never name a `.map()`/`.filter()` loop variable `t` in a file that also
  destructures `const { t } = useLanguage()` — it silently shadows the translate function within
  that callback (several sessions have hit this; rename the loop var instead, e.g. `tpl`/`row`).
- No automated tests in the repo.
- **Gotcha (bit a live deploy 2026-09-18):** `npx tsc --noEmit -p .` is **not** the same check
  Vercel/Railway run and can pass while the real build fails. Both `package.json`s' actual
  `build` script is `tsc -b && vite build` (frontend) / `tsc -b` (backend) — `tsc -b` (project-
  reference build mode) enforces `noUnusedLocals`/`noUnusedParameters`, which plain `--noEmit`
  here does not. An unused type-only import (`ConfigListKey` in `Settings.tsx`) passed
  `--noEmit` clean, got pushed, and Vercel's build failed in prod while the site kept silently
  serving the previous deploy — no crash, no alert, just stale code live for ~15 minutes.
  **Always run the actual `npm run build` in both `/` and `/backend` before pushing**, not just
  `--noEmit`, and after any push that changes frontend code, check
  `vercel.com/<team>/pool-brayne/deployments` (or the CLI) for a Ready/Error status rather than
  assuming a successful `git push` means the site updated.

## Current State (as of 2026-09-10)

- **All original 9 core modules + a long tail of client-requested features are built and live**,
  end-to-end tested against real Supabase data (not mocks) and, for most features, verified on
  production too. See "Feature completeness" below for what's built vs deliberately out of scope.
- Real auth, real DB, real file storage, real QuickBooks OAuth (sandbox), real Authorize.net
  card charging (sandbox, tested live) are all working.
- `npm install` + `npm run dev` (root, frontend) and `cd backend && npm run dev` (backend) to run
  locally. **Check for port conflicts before assuming defaults** — `D:\React\yardward-pro`
  (sibling project, same client) often has dev servers running on 5173/5174 too; this project has
  used 5175 as its fallback. If you change the frontend port, update `backend/.env`'s
  `CORS_ORIGIN` to match, or the browser will silently fail with no console error.
- Git: single remote `origin/main`, `ameerhamza6273/pool-brayne` on GitHub. **Never `git push`
  without the user's go-ahead** — Claude's auto-mode classifier blocks direct pushes in this repo
  (commit is fine, push needs the user to run it or explicitly confirm in the moment).

## Backend

### Supabase (Postgres + Auth + Storage) — live since 2026-07-28

- **Project:** "PoolBrayne", ref `zesllxjijkwxmjiwjmdc`, region `us-east-1`, compute **Micro**.
  Org: `kahn@brayneai.io's Org` (Pro plan, multi-project agency account — also hosts
  `yardward-pro`'s Supabase project and unrelated client projects). **Always double-check you're
  pointed at the PoolBrayne project specifically.**
- **Credentials** live in `.env` / `backend/.env` (gitignored): `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`.
- **DB connection gotcha:** the direct host (`db.<ref>.supabase.co`) only resolves over IPv6,
  which this dev environment can't reach — `DATABASE_URL` uses the **connection pooler**
  (`aws-0-us-east-1.pooler.supabase.com:5432`, username `postgres.<project-ref>`) instead.
- **No `SUPABASE_ACCESS_TOKEN` stored on this machine**, so `supabase db push` / `gen types`
  aren't directly runnable. **Established pattern for new migrations:** write the SQL file in
  `supabase/migrations/`, then apply it with a throwaway script (`backend/_tmp-run-migration.ts`,
  using the `postgres` package + `DATABASE_URL` directly) — run it, then delete it. Same pattern
  for one-off data imports/cleanups (`backend/_tmp-*.ts` or `.cjs`, always deleted after running).
  `database.types.ts` gets the new columns added **by hand** afterward (can't regenerate).
- **Auth:** "Confirm email" is OFF (instant signup, no email step) — reconsider before real
  production launch once transactional email is wired up.
- **Schema** (`supabase/migrations/`, ~25+ files by now) covers: `tenants`/`profiles` (multi-tenant,
  role enum), `customers`/`customer_notes`/`customer_attachments`/`customer_reminders`
  (multi-type reminders) + legacy `next_reminder_date` single-reminder columns, `jobs` +
  `job_service_history`/`job_line_items`/`job_parts_used`/`job_attachments`/`job_forms`/
  `job_crew_members`, `recurring_jobs` (+ legacy `recurring_routes`), `estimates`/
  `estimate_line_items`/`estimate_attachments`/`estimate_templates`, `invoices`/
  `invoice_line_items`/`recurring_billing`/`payments`, `vendor_bills`/`vendor_bill_line_items`,
  `inventory_items`/`inventory_stock`/`inventory_locations`/`inventory_variance`/
  `inventory_writeoffs`/`suppliers`/`supplier_locations`/`purchase_orders`/`category_taxonomy`,
  `pos_orders`/`pos_order_items`/`pos_order_payments` (split tender), `vehicles`/`trip_history`/
  `geofence_alerts`, `timesheets`/`job_costing`, `automations`/`seasonal_campaigns`/
  `sms_conversations`/`sms_messages`/`reviews`, `integrations`/`subscription_plans`/
  `billing_history`, `tasks`, `directory_contacts`, `form_templates`, `library_documents`,
  `tenant_config_lists` (generic tenant-editable small lists — Job Types/Statuses, Estimate
  Statuses, Call Types/Sources, Reschedule Types, Cancellation Reasons — added 2026-09-18, see
  Architecture note below). Every business table carries `tenant_id`; RLS (`tenant_isolation`
  policy) is on everything. `current_tenant_id()` helper resolves the caller's tenant via
  `profiles`.
- **RLS gotcha (fixed):** `profiles` originally only allowed self-update — a tenant admin
  couldn't edit a teammate's row (silent no-op, no error). Fixed with an added
  `profiles_update_tenant` policy (`tenant_id = current_tenant_id()`). No other table has this
  restriction (the generic `tenant_isolation` policy already allows tenant-wide read/write) — if
  a future "edit someone else's row" feature surfaces a similar silent no-op, check RLS first.
- **Seed data:** `scripts/seed-supabase.ts` (idempotent for staff only, not for business tables —
  don't rerun blindly) seeded demo customers/jobs/inventory/etc. Real production data has since
  been imported on top: **3629 real legacy customers** (from a client-provided Excel export,
  type Residential/Commercial guessed via keyword heuristic — may need manual correction per
  row) and **2,545 real inventory products + 67 labor SKUs** (from client-provided Excel exports).

### Backend API (`backend/`) — Fastify 5, added because the client's original spec required
"Backend API: Node.js + Fastify"

- Supabase Postgres + Auth stay as-is (already real, RLS-protected); the frontend no longer talks
  to Supabase directly for data — every request goes through this Fastify layer instead.
- **Pattern (`backend/src/db.ts`, `withTenantContext()`):** each request verifies the caller's
  Supabase JWT (via JWKS, since this project uses asymmetric ES256 keys), then opens a Postgres
  transaction and runs `set_config('request.jwt.claims', ...)` + `set local role authenticated`
  — **exactly what Supabase's own PostgREST does** — so the original RLS policies keep working
  unmodified. Route handlers (`backend/src/routes/*.ts`) reproduce the same
  select/insert/update shape the frontend used to do directly.
- **Gotchas worth knowing before touching `backend/`:**
  - `postgres.js` auto-parses `date` columns into full ISO timestamps and `numeric` into JS
    strings by default — `db.ts` has custom type parsers to keep the shape the frontend expects.
  - `postgres.js` query results are loosely typed — cast with `as unknown as SomeInterface[]`
    right after the query, not inside `.map`/`.filter` callbacks (TS errors otherwise).
  - Fastify's 404 **throws** inside `apiClient.request()` (unlike Supabase's old
    `.maybeSingle()`, which returned `null` silently) — every detail-page loader needs a
    `try/catch`.
  - **jsonb column writes must use `sql.json(value)` (postgres.js helper), never
    `JSON.stringify()` + a manual `::jsonb` cast** — the latter double-encodes or corrupts the
    value. This bit the QBO-account-mapping feature once; applies to any future jsonb write.
  - Date-only strings (e.g. `"2026-09-15"`) must be parsed/formatted with an explicit `Z` suffix
    and UTC getters/setters (`new Date(s + "T00:00:00Z")`, `getUTCDate()`, etc.) — parsing without
    `Z` uses local time, which silently shifts the date by a day depending on the server's
    timezone. Bit the recurring-jobs "next occurrence" calc once.
  - `apiClient.ts`'s `request()` only sets `Content-Type: application/json` when a body is
    present — a bodyless POST with that header set fails on Fastify ("Body cannot be empty...").

## Hosting

- **Frontend — Vercel**, project `pool-brayne`, domain `pool-brayne.vercel.app`. Currently on the
  **developer's own personal Vercel account** (`ameers-projects-cdd40da5`), not the client's —
  client said "move it when it's completed", no urgency yet (unlike Railway, see below).
  `vercel.json` has an SPA rewrite (`/(.*) → /index.html`) — without it, direct navigation to any
  non-root route 404s.
- **Backend — Railway**, project `celebrated-luck` in the **client's own Railway workspace**
  (`brayne-ai's Projects`, Pro plan) — moved here 2026-09-10 from the developer's personal trial
  account, whose 30-day trial had hit 0 days remaining. URL:
  `https://pool-brayne-production-dcf7.up.railway.app`. Source repo
  `ameerhamza6273/pool-brayne`, **root directory must be set to `/backend`** in Railway's service
  settings (the repo root is the frontend). Env vars are a straight copy of `backend/.env`.
- **Multiple Chrome browsers may be connected** to this account (developer + a teammate both use
  Claude) — **always confirm which browser via `AskUserQuestion`/`select_browser` before taking
  any browser action**, never assume.
- **Vercel/Railway UI gotchas:** their dashboards use React portals and sometimes silently no-op
  coordinate clicks after a hard page reload (before hydration finishes) — prefer
  `javascript_tool` DOM queries/clicks over blind coordinate clicks when a click seems to do
  nothing, especially right after `navigate()`. Also double-check you're in the right
  account/team scope before assuming a 404 or empty state means something is broken — this
  client's org has multiple Vercel teams (`Brayne AI`, `Brayne AI Development Team`) and multiple
  Railway workspaces, and it's easy to land in the wrong one.

## Integrations status

- **QuickBooks Online** — real OAuth (sandbox), connect/disconnect flow, auto-refreshing access
  tokens. **Push-only** sync: "Sync to QuickBooks" buttons on Customer/Invoice push a
  `Customer`/`Invoice` to QBO (whole invoice as one line item — no per-product granularity since
  PoolBrayne inventory isn't mapped to QBO Items). Per-inventory-item QBO account mapping
  (Income/COGS/Asset) also built, pulls the real chart of accounts live from QBO.
  **`QBO_REDIRECT_URI` still points at `localhost:4000`** — needs updating (both the env var and
  the Intuit app's registered redirect URIs) before QuickBooks connect works outside local dev.
  Production QuickBooks keys not yet requested from the client.
- **Authorize.net** — real, **live-tested** card charging via Accept.js (client-side
  tokenization, PCI-safe). Sandbox credentials (developer's own dev account, standard practice —
  client will supply their own production merchant account at launch). **Accept.js requires
  HTTPS** — card charging cannot be tested on `localhost`, only on the deployed HTTPS URL.
  Used in Collect Payment (Invoice/Bulk/POS), with Check/manual as non-card fallbacks.
- **GPS7000** (the client's actual truck GPS vendor) — a budget consumer tracker with **no public
  API** (confirmed via their marketing site + client's own login, which was never used to
  authenticate — see safety rules). Fleet page just links out to `platform.gps7000.com`; no live
  position data flows into the app.
- **Not connected yet** (client hasn't provided accounts): Twilio (SMS), Stripe (unused — client
  confirmed Authorize.net is the real processor, not Stripe), SendGrid (email), Gusto/ADP
  (payroll export).

## Feature completeness

Built (non-exhaustive, biggest items): multi-contact "household" customers at one address,
customer photo/gate-code/equipment editing, address autocomplete (Nominatim free / Smarty paid
opt-in) + map geocoding, Jobs Map + interactive Schedule (drag-to-reschedule, click-to-create) +
Dispatch board (drag-and-drop assign) + color-by-tech + recurring jobs (auto-generates next
occurrence on completion, no cron available in this environment so it's roll-forward-on-complete
instead), job line items + crew (multi-tech) + parts-used (auto-deducts inventory) + real photo/
signature capture + submitted checklist forms, Estimates (templates, public approval link,
convert to Invoice or Job) + Invoices (line-item detail, down payment, write-off, bulk-invoice
either by combining open invoices or by combining completed-but-uninvoiced jobs) + Vendor Bills,
Inventory (vendor management incl. multi-location, write-offs, Avery/Zebra label printing,
per-item QBO account mapping, 4-level category taxonomy), POS (split tender incl. multiple card
charges per sale, returns via negative qty, custom non-stock line items), Reports (sales tax,
item movement, deposits, invoices due, reminders, inventory valuation), a **custom Form Builder**
(tenant-editable form templates rendered generically via `DynamicForm`, replacing what used to be
3 hardcoded checklist components; forms can be customer-visible via a public link), Library
(generic document repo), Manufacturers/Directory pages, real notifications (computed from recent
activity, not a stored table), Settings > Team (real add/edit/delete staff via Supabase admin
API).

**Deliberately out of scope / not built:**
- Global search bar (topbar input still does nothing).
- "Dispatch nearest available tech" — decorative text only, no real geo logic.
- JobDetail's 10 content-category tabs (Trip Details, Documents-beyond-what's-built, Customer Not
  Available, etc.) — would need several new schema tables, flagged as a bigger scope item.
- A form-*builder*-builder is done (Form Builder page); a from-scratch "create a job intake
  form" wizard beyond that wasn't separately requested.
- Generic per-tenant pluggable integrations (so a resold-to pool company could bring its own
  GPS/accounting vendor instead of hardcoded ones) — client has floated a resale/white-label plan
  (multi-tenant signup itself already supports this — every signup gets an isolated tenant), but
  a pluggable-integration framework is unbuilt, new architecture work, not yet scoped/confirmed.

## Reference project — `D:\React\yardward-pro`

Same client's other, more mature product ("Engage CRM", hydrovac/fleet niche — **not** the same
business as PoolBrayne, see client-context note above). Newer stack (React 19, TanStack Router/
Query, Tailwind v4), real Supabase backend with 79+ migrations, Edge Functions for QuickBooks/
Twilio/Geotab/etc., Playwright tests, deployed on Vercel. **Use it as an architecture/pattern
reference only** (e.g. how to structure a growing migrations folder, typed Supabase query
patterns, per-role routing) — never copy its business/integration decisions into this repo, and
never assume an answer from an Engage conversation applies here (different fleet, different GPS
vendor, different payment processor).

## Open / Pending Items (as of 2026-09-10)

1. **Vercel hosting** still on the developer's personal account — move to client's account when
   they're ready (no urgency signal yet, unlike Railway which was forced by a trial deadline).
2. **`QBO_REDIRECT_URI`** still `localhost:4000` — update env var + Intuit app config before
   QuickBooks connect works in production.
3. **QuickBooks production keys**, **Authorize.net production merchant account**, **Twilio/
   SendGrid/Gusto accounts** — all pending the client providing their own credentials/signups
   (Claude cannot create accounts on the client's behalf — see safety rules). SendGrid (or
   equivalent) specifically blocks **PO vendor email notifications** (client asked for
   Pending/Sent/Received status emails 2026-09-11) — status vocabulary and everything else about
   PO line items is built, only the actual email send is waiting on this.
4. **Legacy customer import** — 3629 imported rows have a best-effort Residential/Commercial
   guess (keyword heuristic); some may be misclassified and need manual correction via the Edit
   Customer dialog.
5. **Resale/pluggable-integrations framework** — client interested, scope not yet confirmed with
   them (see Feature completeness above).
6. **Global search bar**, **dispatch-nearest-tech logic**, **QuickBooks two-way sync** (currently
   push-only), **JobDetail's remaining content-category tabs** — known, deliberately deferred
   gaps, no client urgency currently attached.
7. Empty leftover Railway project (`content-commitment`) in the developer's old trial workspace —
   its service was deleted 2026-09-10, but Railway's UI has no self-service "delete whole
   project" button, so a serviceless shell remains (costs nothing, safe to ignore).
8. **From the 2026-09-14 client video-call transcript — one item left, needs the client to
   re-verify on the now-deployed build, not a build task**: PO item-selection/edit — client
   described it as broken, but this was already built 2026-09-11 and (per the deploy-gap found
   that same session) likely just wasn't live yet when they tested on the call. The other 3
   originally-ambiguous items all turned out to be already-built, confirmed live in the browser
   2026-09-14: job-level write-off (built that day, see below), the Estimate "Documents" section
   (already IS the Library + DocumentsSection "attach from Library" flow — EstimateDetail.tsx
   already wires `libraryDocuments`/`onAttachExisting`, no separate Documents page needed), and
   Field.tsx's technician inventory picker (already IS the "Parts Used" search+stepper block in
   Field.tsx, confirmed live by searching "filter" and getting 50+ real inventory results with
   add/remove steppers — client just hadn't seen the undeployed build). Nothing left to build from
   this transcript; only re-confirm with the client once they're on the current deploy.
9. **Slow/stuck-looking initial page loads, app-wide — likely explains a chunk of the "you broke
   what was working" client frustration on 2026-09-17** — confirmed live 2026-09-18 on `npm run
   dev` against production Supabase: POS, Inventory, Customers, Jobs, Invoicing, and Settings all
   sat on their own "Loading …" spinner for anywhere from ~3 to ~9 seconds on first load (then
   rendered correctly, no errors, no retry needed). This generalizes the 2026-09-14 note below
   about `/api/invoices/by-job` specifically — it's not that one route, it's most first-loads on
   most pages, each of which fires many parallel GETs on mount, each opening its own
   `withTenantContext` transaction. Connection-pool-exhaustion-under-burst (Supabase pooler) is
   still the leading theory but is **still unconfirmed** — nobody has looked at pooler
   metrics/logs or tried raising the pool size. Given the client already associates "slow/frozen
   page" with "broken," this deserves a dedicated investigation session rather than being folded
   into a feature-request session again. Original 2026-09-14 note, now subsumed by the above:
   flaky `GET /api/invoices/by-job` intermittent 500s on JobDetail load (JobDetail alone fires
   ~12 parallel GETs on mount — notifications, form-templates, library, profiles, job detail,
   invoices/by-job, parts, line-items, attachments, crew, forms, inventory/summary).
10. **Three items from the client's 2026-09-18 "work flow" feedback list are genuinely ambiguous
    and were deliberately left unbuilt pending the client's own clarification** (dev was asked
    directly and didn't know either, so a clarifying text was drafted for the dev to send rather
    than guessed at): (a) "Remove the original in inventory list (default list we started with)"
    — unclear whether this means a leftover seed/demo category or the whole legacy-import product
    set; (b) "Need a Document folder to put from 'Document List'" — unclear whether this wants a
    folder structure inside Library or a new Documents-type section on Job/Estimate; (c) on
    Inventory edit, "need a drop down" — unclear which field. **Worth noting once an answer comes
    back:** live-testing the Inventory edit dialog 2026-09-18 found Category/Subcategory are
    already real `<Select>` dropdowns (via `CategoryPicker`) but **Manufacturer is still a plain
    text `<Input>`**, no dropdown — a very plausible reading of (c) if the client means that field
    specifically.

## Session Changelog

*(Short one-liners only — see the rule at the top of this file. Older detailed session-by-session
history was condensed into the structural sections above on 2026-09-10.)*

- **2026-09-11** — Client sent a large feedback dump (PO broken, roles/tech-login, Field view
  missing items/forms/documents, search bars, document-picker, mandatory forms). Built: PO
  product line items (new `purchase_order_line_items` table + editor UI) and renamed PO status
  vocabulary Draft/Ordered → Pending/Sent (Received unchanged); added an explicit view/edit icon
  to the PO list (view/edit itself was already built, just not discoverable); real role
  enforcement (`profiles.role`) restricting technician/contractor accounts to `/field` only, nav
  hidden accordingly (Settings > Team tech creation + login already worked, just wasn't
  enforced); Field.tsx now shows job line items, tagged forms (DynamicForm), and a documents
  section (previously desktop-JobDetail-only); `form_templates.required` + enforcement blocking
  job completion in both Field.tsx and JobDetail.tsx until required forms are submitted; a
  reusable "attach from Library" dropdown added to `DocumentsSection` (used by both
  JobDetail/EstimateDetail); search boxes added to Library, Inventory's Vendors tab, and
  Manufacturers. Verified end-to-end in the browser (PO create/edit with a real product line
  item, totals recompute correctly). **Not done: PO vendor email notifications** (needs client's
  SendGrid or equivalent, see Open/Pending #3).
- **2026-09-11 (same day, follow-up)** — Client SMS: "English/Spanish translation is only working
  in tech notes. Needs to work across software." Root cause: `t()` was a pure dictionary lookup
  covering only JobDetail's own labels. Fixed `t()` to auto-translate+cache any dictionary miss
  (see Architecture > i18n) and persisted `lang` to localStorage (previously reset to English on
  every refresh). Wired `t()` into AppShell (nav/topbar, so every page inherits it), Field.tsx
  (full page), the shared DocumentsSection/DynamicForm components, and the header area (title,
  subtitle, primary button, search placeholder) of 16 more pages (Campaigns, FormBuilder, Library,
  Directory, Fleet, Jobs, Dashboard, Inventory, Invoicing, Forms, PointOfSale, Customers, Reports,
  Manufacturers, Settings, Timesheets). Verified live in browser: switching to ES translates the
  sidebar, Dashboard, and the entire Field page including dynamically-authored Form Builder field
  labels, and survives a full page reload. Deeper page content (dialogs, table columns, tab bodies
  beyond the header) was deliberately left for a future pass — this covers nav + the tech-facing
  Field view (highest real-world value, Spanish-speaking techs) + every page's top-level heading.
- **2026-09-12** — Client: "components didn't update — popups/modals, cards etc... EVERYTHING
  should change." Did the deep sweep the prior entry deferred: every dialog/modal, table column,
  card, badge, and form field across every page and every shared component (LineItemsEditor,
  PoLineItemsEditor, SearchableSelect, NotificationsPanel, DocumentsSection, DynamicForm,
  CardPaymentForm, CategoryPicker, AddressAutocomplete) now calls `t()`. Also: `lang` choice
  itself now also gated per the client's follow-up ("everything translated except Login/Signup,
  those stay English-only" — no toggle exists pre-login anyway, matches the client's own
  reasoning); Onboarding and the public SalesPortal ARE translated per that same instruction.
  Found and fixed two real gaps while verifying live in the browser: (1) the free Google
  Translate endpoint `t()` falls back to got soft-rate-limited from the sheer volume of parallel
  translation calls during this session's own testing (confirmed directly: a plain curl to it
  started returning a "Sorry... automated queries" page) — added a serialized request queue with
  spacing + one retry in `language-context.tsx` so real usage (a page translating ~30-50 strings
  at once on first Spanish view) doesn't trigger the same thing; (2) a couple of short, genuinely
  ambiguous English words auto-translated wrong ("Add Tech" → "Agregar tecnología" instead of
  "Agregar Técnico", i.e. Google read "Tech" as "technology") — hand-pinned in the dictionary
  rather than relying on the auto-translate guess. **Gotcha reinforced**: multiple sub-agents
  independently hit the same `.map((t) => ...)` variable-shadowing footgun this session (a loop
  variable named `t` shadowing the translate function) — always rename the loop var instead.
- **2026-09-10** — Client's Railway free trial (developer's own account) hit 0 days remaining;
  client added developer as admin on their own Railway Pro workspace. Migrated the backend
  service there, repointed Vercel's `VITE_API_URL`, verified live end-to-end, deleted the old
  trial's service. Condensed this file's several-months-long verbose session history into the
  structural sections above (this changelog included) per user request.
- **2026-09-14** — Client sent a video-call transcript (Bryan + Michael) covering ~16 feedback
  items. Found and fixed a critical gap first: the entire 2026-09-11/12 session's work (43 files
  — translation sweep, PO line items, form-required toggle, search additions, etc.) had never
  been committed, so production was running ~5 days stale and several of the transcript's
  complaints were actually already fixed locally. Committed that backlog, then built every item
  that didn't need client clarification: word-order-independent multi-field search (new
  `matchesQuery()` helper, applied to Inventory/POS/Customers), Library category+manufacturer
  dropdowns sourced from the same taxonomy Inventory uses plus per-PDF tagging after upload (new
  `library_documents.manufacturer` column), per-field "Mandatory" toggle in Form Builder
  (distinct from the existing whole-form required flag) enforced in DynamicForm, labor/material
  line-item picker now filters by the existing `category === "Services"` convention, JobDetail
  primary-tech reassignment, Field.tsx photo capture now offers gallery as well as camera, Reports
  click-to-sort on every table, POS grid/list view toggle, merged the redundant sidebar "Dispatch"
  entry into "Jobs / Dispatch", renamed "POS" to "Point of Sale". Also fixed unrelated pre-existing
  build errors (Settings.tsx null-description type errors, unused PoLineItemsEditor import) found
  while verifying the build. Verified live in the browser (Library tagging round-trip, Reports
  sort, Form Builder per-field mandatory) — no console errors. **Not done, needs client
  clarification first** — see Open/Pending Items #8: PO item-selection (likely already fixed, just
  undeployed), Estimate "Documents" section, Field view inventory picker. All pushed to origin/main
  and confirmed live on Vercel/Railway production the same day.
- **2026-09-14 (same day, follow-up)** — Client clarified the job-write-off ambiguity: a specific
  past Job (e.g. completed, customer refuses to pay) needs its own write-off, separate from both
  SKU write-offs (Inventory, untouched) and the existing Invoice write-off. Added
  `jobs.write_off_reason`/`write_off_date` columns and a "Write Off" button on JobDetail (shown
  once a job reaches Completed), mirroring the Invoice write-off's UI/copy exactly, reusing the
  jobs route's existing generic PATCH (no new backend route needed). Verified the button and
  dialog render correctly in the browser on a real Completed job; did not submit the action itself
  to avoid mutating a real record during testing. Also noted (see Open/Pending Items #9, not
  fixed): `GET /api/invoices/by-job` intermittently 500s on JobDetail load — pre-existing,
  unrelated to this change, not investigated further this session.
- **2026-09-14 (same day, second follow-up)** — Re-examined the remaining 2 ambiguous transcript
  items by re-reading the exact quotes and checking code directly instead of guessing: both turned
  out to already be built, just not something the client had seen live yet. (1) Estimate
  "Documents" section — Bryan's ask ("a section that has about four or five documents we can
  upload at any time" + not being "forced to upload") is exactly what Library + DocumentsSection's
  "attach from Library" dropdown already does; confirmed `EstimateDetail.tsx` already passes
  `libraryDocuments`/`onAttachExisting` to it. (2) Field.tsx inventory for techs — Bryan/Michael's
  ask ("a pump, a filter... an anode" + "add stuff on the fly") is exactly the existing "Piezas
  Usadas"/"Parts Used" search+stepper block; confirmed live by searching "filter" in the field view
  and getting 50+ real inventory results with working +/- steppers. No code changes needed for
  either — only Open/Pending Items #8's PO item-selection needs the client to actually re-check.
- **2026-09-14 (same day, third follow-up)** — Final pass over the transcript's action items caught
  one still-missing piece: "Merge Jobs and Dispatch... make drag-and-drop" (item combined with the
  earlier nav merge) only had the nav merge done — the Pipeline kanban board's stage columns
  themselves had no drag-and-drop (cards were click-only), unlike the Dispatch Board and Schedule
  tabs which already had it. Added it, reusing the exact same native-HTML5-drag pattern already
  used elsewhere in `Jobs.tsx`. Verified live: `left_click_drag` (synthetic mouse events) doesn't
  trigger real HTML5 drag events — confirmed this is a browser-automation limitation, not a code
  bug, by testing the same technique against the already-working Dispatch Board drag and seeing it
  also fail — so verified instead by dispatching real `DragEvent`s via the console, which moved a
  job between stage columns, persisted after reload, then dragged it back to restore state. This
  was the last remaining item from the 2026-09-14 transcript; everything from that meeting is now
  either built or (PO item-selection only) just needs the client to re-check the live deploy.
- **2026-09-15** — Client sent a new "work flow.pdf" (workflow/requirements doc, not a transcript).
  Cross-checked it against the live app and built the 6 real gaps found: POS freeform notes field,
  PO full-screen PDF/print view, PO status split into Sent - Email/Sent - Portal, PO payment terms
  (Net 30/customizable, new `purchase_orders.payment_terms` column), Vendor Bills PO-number
  search + PO link (new `vendor_bills.po_id`), and PO "Received" now actually pushes ordered
  quantities into `inventory_stock` (SKU-matched) instead of just flipping a status label —
  previously fully manual. Also fixed a real bug hit while verifying live: the shared
  `DialogContent` component (`src/components/ui/dialog.tsx`) let long unbreakable content (e.g. a
  long vendor name in a select trigger) push a dialog's grid column past `max-w-lg`, causing
  horizontal bleed/scroll instead of clipping — fixed app-wide with `overflow-x-hidden` +
  `[&>*]:min-w-0` on the dialog's grid children, not just patched locally. Verified all 6 items
  live in the browser (PO detail dialog, New PO dialog, Vendor Bills tab, POS cart) with real
  tenant data; no console errors. Migration applied directly to production Supabase via the
  established `_tmp-run-migration.ts` pattern.
- **2026-09-17** — Relayed client SMS: frustrated that recent changes "broke what was working,"
  feels over-consulted on detail, explicitly referenced having already lost the Engage Hydrovac
  account to a similar pattern (see `[[project_client_trust_crisis_2026_09_17]]` memory). Checked
  build health + git/deploy sync on the spot: both clean, nothing unpushed — no evidence of an
  actual regression from the vague report, matching the 2026-09-14 pattern where "broken" turned
  out to be an undeployed-build confusion. No specific item was ever named, so nothing was "fixed"
  this session — asked for concrete specifics before touching anything, per the memory's guidance.
- **2026-09-18** — Client sent a new detailed feedback list (POS, Inventory, Jobs, Library,
  Settings) plus an Excel sheet ("Copy of Library category.manufacture.xlsx") of Library's own
  category/manufacturer vocabulary. Built the unambiguous items: POS list/spreadsheet view now
  default (was grid), POS/Inventory search now include Item #, POS category+manufacturer now
  pulled from the real catalog instead of a hardcoded 6-value list, with a star-to-favorite quick-
  access row for each (new `localStorage` prefs, not DB); Library's category/manufacturer
  dropdowns now use the client's own fixed list (`src/lib/data.ts`
  `libraryCategories`/`libraryManufacturers`) instead of sharing Inventory's taxonomy; per-job form
  selection at job creation (new `jobs.selected_form_ids` jsonb column, "Forms for this Job"
  checklist in the New Job dialog, pre-checked from each template's existing Applies-To/Required
  setting but fully overridable — JobDetail/Field.tsx fall back to the old applies_to-derived set
  only for jobs created before this column existed); JobDetail's Service Forms now render directly
  under Documents instead of as a separate card; and — the biggest find — **the entire Settings >
  Job Settings tab (Job Types, Job Statuses, Estimate Statuses, Call Types, Call Sources,
  Reschedule Types, Cancellation Reasons) was purely decorative** (hardcoded arrays, Add
  buttons and delete icons with no handlers at all) — client's "make the add buttons active" /
  "edit all fields" complaints were literally true. Replaced with a new tenant-scoped
  `tenant_config_lists` table + `useConfigLists()` hook (see Architecture) used by Settings (full
  add/delete CRUD) and every page that previously imported those arrays statically (Jobs.tsx,
  JobDetail.tsx, FormBuilder.tsx) so an edit in Settings now actually propagates. Baked the
  client's explicit Job Types edit into the seed defaults: added "Weekly Maintenance" + "In Store
  Repair", renamed "Install / New Build" → "Install". **Not built, needs client clarification
  first** (dev didn't know either, clarifying text drafted for them to send) — see Open/Pending
  Items #10. **Also found (not this session's fault, pre-existing)** — see Open/Pending Items #9:
  live-tested nearly every page and found first-page-load spinners consistently taking 3-9 seconds
  app-wide (POS, Inventory, Customers, Jobs, Invoicing, Settings), not just the one route flagged
  2026-09-14 — plausibly a real contributor to the client's "everything feels broken" perception,
  worth a dedicated investigation session. Verified all built items live in the browser with real
  tenant data (POS category/favorites, Inventory item-# search, Library dropdowns, New Job forms
  picker, JobDetail Documents/Forms order, Settings Job Types add+delete with a full page reload
  to confirm persistence, FormBuilder's Applies-To list). `tsc --noEmit` clean on both frontend and
  backend throughout.
