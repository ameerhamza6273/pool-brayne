# PoolBrayne — Project Memory

> Yeh file Claude Code khud-ba-khud har naye session ki shuruwaat mein read kar leta hai.
> Naye terminal mein sirf kehna: "project read kar lo" — is file se sab context mil jayega.
> **Rule for Claude:** har meaningful session ke aakhir mein (ya jab user kahe) `## Session History`
> mein neeche ek nayi dated entry add karo — kya kiya, kya decide hua, aage kya karna hai.
> Purani entries mat delete/edit karo, sirf naya add karo (append-only log).

## Project Overview

**PoolBrayne** — pool service management SaaS (jaise ServiceTitan/Jobber but pool industry ke liye).
Bolt.new se scaffold hua tha.

**Stack:** Vite + React 18 + TypeScript, React Router v7, Tailwind CSS + shadcn/ui (Radix primitives),
recharts, react-hook-form + zod, `@supabase/supabase-js`.

**Backend: real Supabase project, live since 2026-07-28** (see "Supabase Backend" section below) —
auth is wired to real `supabase.auth`, but **most pages still read from `src/lib/data.ts` mock
arrays** — only auth (login/signup/logout/session) is real so far. Migrating each page's data
fetching to the live tables is the main remaining backend task (see Session History).

### Architecture
- `src/App.tsx` — routing. Public routes: `/sales`, `/login`, `/signup`, `/onboarding`.
  Baqi sab `ProtectedRoute` + `AppShell` (sidebar/topbar layout) ke andar. `ProtectedRoute` ab
  `isLoading` bhi handle karta hai (session restore ke dauran).
- `src/lib/supabase.ts` — Supabase client (`createClient<Database>`), env se URL/anon key leta hai.
- `src/lib/database.types.ts` — generated types (`supabase gen types typescript`), **regenerate
  after every schema migration** (`npx supabase gen types typescript --project-id zesllxjijkwxmjiwjmdc`).
- `src/lib/auth-context.tsx` — **real auth** (rewritten 2026-07-28): `signUp`/`signIn`/`signOut` call
  real `supabase.auth`. `signUp` passes `full_name`/`company_name` via `options.data`, which a DB
  trigger (`handle_new_user`, see below) turns into a new `tenants` row + `profiles` row
  (role `owner`). `user` in context is loaded by joining `profiles` + `tenants`. No more
  `localStorage`-based fake auth.
- `src/lib/data.ts` (~685 lines) — **still the source of mock data for almost every page** —
  customers, jobs, technicians, inventory, invoices, campaigns, fleet, timesheets, POS products,
  etc. This is the next thing to replace, page by page, with real Supabase queries against the
  schema in `supabase/migrations/`.
- `src/pages/` — Dashboard, Customers/CustomerDetail, Jobs/JobDetail, Field (technician mobile view +
  maintenance/water-testing/one-off-job checklists), Inventory, Fleet, Timesheets, PointOfSale,
  Invoicing/InvoiceDetail, Campaigns, Settings, SalesPortal, Onboarding, Login, Signup.
- `src/components/ui/` — pura shadcn component library already installed.
- i18n: `src/lib/language-context.tsx` + `src/hooks/use-translator.ts`.

### Known state (as of 2026-07-28)
- Real auth end-to-end tested (signup creates tenant+profile, logout, login) — see Session History.
- Per-page data is still mock (`src/lib/data.ts`) — dashboard/customers/jobs/etc. don't hit Supabase
  yet, only auth does.
- No automated tests found in repo.
- Git history: sirf ek commit (`a170459 change`) — is se pehle ka koi granular history nahi hai
  (is session ke changes abhi tak commit nahi hue — user se commit karne se pehle confirm lena).
- Dev server chalane ke liye: `npm install` (agar `node_modules` na ho) phir `npm run dev`.

## Supabase Backend (live, created 2026-07-28)

- **Project:** "PoolBrayne", ref `zesllxjijkwxmjiwjmdc`, region `us-east-1`, compute tier **Micro**
  ($10/mo add-on — matches the tier the sibling `yardward-pro` project uses on the same org).
  Org: `kahn@brayneai.io's Org` (Pro plan) — the same multi-project agency org that hosts
  `yardward-pro` ("Engage Hydrovac Services - CRM") and 7 other unrelated client projects. **Always
  double-check you're pointed at the `PoolBrayne` project specifically**, not one of the others.
- **Credentials:** live in `.env` (gitignored) — `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
  (client-safe), and server-only `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_DB_PASSWORD` /
  `SUPABASE_PROJECT_REF` (never VITE_-prefixed, never commit). If `.env` is ever lost, regenerate
  keys from the Supabase dashboard → Project Settings → API Keys (legacy anon/service_role tab).
- **CLI linking:** the project is linked via `supabase/config.toml` (created by `supabase init`).
  To run CLI commands (`db push`, `gen types`, etc.) you need `SUPABASE_ACCESS_TOKEN` — there's no
  stored login on this machine; generate a personal access token at
  supabase.com/dashboard/account/tokens (an agency-wide token controlling the *whole* account, all
  8+ projects — name it clearly and set an expiry) and pass it inline, e.g.:
  `SUPABASE_ACCESS_TOKEN='sbp_...' npx supabase db push`.
- **Auth setting:** "Confirm email" is turned **OFF** for this project (Authentication → Sign In /
  Providers) so signup logs the user in immediately without needing a real inbox — matches the
  original mock app's instant-signup UX. **Reconsider this before real production launch** (turn
  it back on once transactional email — e.g. SendGrid per the integrations list — is wired up).
- **Schema** (`supabase/migrations/`, applied via `supabase db push`):
  1. `20260728061400_initial_schema.sql` — full multi-tenant schema: `tenants`, `profiles` (one per
     `auth.users` row, role enum owner/manager/technician/contractor/office_manager), and one table
     per module mapped from `data.ts` — customers/customer_notes, jobs/job_service_history/
     recurring_routes, inventory_items/inventory_stock/inventory_locations/suppliers/
     purchase_orders/inventory_variance, pos_orders/pos_order_items, vehicles/trip_history/
     geofence_alerts, timesheets/job_costing, invoices/invoice_line_items/recurring_billing/
     payments, automations/seasonal_campaigns/sms_conversations/sms_messages/reviews,
     integrations/subscription_plans/billing_history. Every business table carries `tenant_id`.
     `current_tenant_id()` helper resolves the caller's tenant via `profiles`.
  2. `20260728061500_rls_policies.sql` — RLS enabled on every tenant table, `tenant_isolation`
     policy (`tenant_id = current_tenant_id()`) applied via a DO-block loop; `profiles` gets
     separate select (whole tenant) + update (self only) policies; `tenants` select/update scoped
     to own row; `subscription_plans` readable by any authenticated user (global reference data).
  3. `20260728061600_handle_new_user.sql` — `handle_new_user()` trigger on `auth.users` insert:
     reads `raw_user_meta_data->>'company_name'` / `'full_name'`, creates a new `tenants` row +
     a `profiles` row with role `owner`. **Every signup currently creates a brand-new tenant** —
     there's no "join an existing tenant via invite" flow yet (not needed by the current UI, which
     has no team-invite screen either).
  4. `20260728061700_seed_subscription_plans.sql` — seeds the 3 global plans (Starter/Pro/Enterprise)
     matching Settings > Subscription & Billing.
  - **Not yet done:** demo/seed data for a tenant (customers, jobs, inventory, etc. from `data.ts`)
    hasn't been loaded into the DB — only the schema + subscription plans exist. When doing this,
    write a Node/ts seed script (service-role key, bypasses RLS) rather than hand-written SQL
    INSERTs — mirrors `yardward-pro/scripts/seed-supabase.ts` and avoids manually mapping mock
    string IDs ("1", "j1", "p1"...) to real UUIDs by hand.
- **Auth wiring tested end-to-end** (2026-07-28, via browser): signup (bryan@poolbrayne.com) →
  trigger created tenant "Bryan's Pool Co" + owner profile → dashboard loaded with real
  tenant/profile data in the sidebar → logout → login — all worked. Verified the `profiles`/
  `tenants` rows directly via the REST API too.

### Original build spec — `docs/PoolBrayne_Lovable_Prompts.md`
Yeh PoolBrayne originally in tarah ke Lovable prompts (Prompt 0 – foundation/design-system/dashboard,
Prompt 1 – Customer CRM, Prompt 2 – Job/Dispatch, Prompt 3 – Inventory, Prompt 4 – Fleet, Prompt 5 –
Timesheets, Prompt 6 – Invoicing/QuickBooks, Prompt 7 – Campaigns, Prompt 8 – Settings/Onboarding) se
banaya gaya tha — user ne yeh original doc (jo yardward-pro banane wale ne diya tha) provide kiya,
maine `docs/` mein save kar diya taake future reference ke liye repo mein hi rahe.
- Design tokens (aqua `#0891B2`, navy `#0C2A3A`, etc.) is doc se hi aaye hain aur exactly current
  code mein match karte hain.
- **Note:** `Field`, `PointOfSale`, aur `SalesPortal` pages iss original 9-prompt spec mein nahi
  hain — yeh baad mein alag se add hue features hain.
- Tip #4 us doc mein khud kehta hai: "Connect Supabase later... auth, customers, jobs, and invoices
  map cleanly to tables" — yehi ab agla kaam hai.

## Reference Project — `D:\React\yardward-pro` (sibling folder, same `D:\React\` parent)

User ke system par ek dusra project hai jo **isi tarah ke backend/features** rakhta hai aur bohat
zyada mature/production hai — jab bhi PoolBrayne ko real backend, integrations, ya production-grade
patterns chahiye hon, pehle yahan dekho.

- **Kya hai:** "YardwardPro" — fleet/field-service management app (vehicles, drivers, mechanics,
  work orders, client portal). Different niche (yard/fleet) but same shape of problem as PoolBrayne
  (jobs, dispatch, invoicing, fleet, timesheets).
- **Stack (zyada modern/upgraded):** Vite + React 19 + TypeScript, **TanStack Router + TanStack
  Query** (PoolBrayne abhi React Router v7 use karta hai), Tailwind v4, shadcn/ui, Supabase
  (**real** — DB + auth + edge functions + RLS), Playwright e2e tests, deployed on Vercel, PWA
  (`vite-plugin-pwa`).
- **Backend (real, PoolBrayne ke liye direct reference):**
  - `supabase/migrations/` — 79 migration files, incremental schema evolution (initial schema →
    RLS policies → seed → feature-specific migrations). Good example of how to structure a growing
    Supabase schema.
  - `supabase/functions/` — Edge functions for: QuickBooks Online OAuth + push (invoice/time),
    Twilio (SMS send, webhooks, conversations, verify), Geotab (GPS sync/list devices),
    Fleetio import, Formstack import, client-portal, weekly digest emails, preventive-maintenance
    checks, error reporting.
  - `src/contexts/AuthContext.tsx`, `DataContext.tsx`, `AppContext.tsx`, `OfflineContext.tsx` — real
    auth + data-fetching + offline-queue context patterns. PoolBrayne's own auth is now real too
    (see "Supabase Backend" section above), but `DataContext`-style per-page data fetching is still
    the missing piece — worth looking at this file when migrating pages off `data.ts`.
  - `src/lib/supabase.ts`, `db-queries.ts`, `db-mappers.ts`, `database.types.ts` — pattern for
    typed Supabase queries + mapping DB rows to frontend types.
  - `src/routes/` — role-based routes: `admin.*`, `driver.*`, `mechanic.*`, tokenized public links
    (`t.$token.tsx`, `portal.$code.tsx`) — relevant since PoolBrayne also has role concepts
    (Owner/Technician/Office Manager in `data.ts`) but no real per-role routing/auth yet.
- **Docs:** `QA-REPORT.md` (Playwright coverage summary), `docs/Yardward-Pool-User-Guide.pdf`
  (ignore — check actual filename before citing), `docs/screenshots/`.
- **No CLAUDE.md in yardward-pro** — it doesn't have its own memory file (as of 2026-07-28).

**How to use this:** Jab PoolBrayne mein real Supabase auth, migrations, ya kisi integration
(Twilio SMS, QuickBooks, GPS/fleet tracking) par kaam karna ho, yardward-pro ke corresponding
migration/function/context file ko pattern ke tor par dekho — code copy-paste mat karo (different
schema/domain), bas approach/structure follow karo.

## Session History

### 2026-07-28
- Poora project explore kiya (structure, routing, auth, mock data, saari pages) — user ko summary
  di gayi.
- User ne request ki: ek persistent file banayi jaye jismein history save ho, taake naye terminal
  session mein dobara sab kuch explain na karna pade. Is CLAUDE.md file ko is maqsad ke liye banaya.
- User ne bataya ke `D:\React\yardward-pro` naam ka ek dusra sibling project hai jiske backend/
  features similar hain — usko reference ke tor par explore kiya aur upar "Reference Project"
  section mein record kar diya.
- **Next / open items:** Koi specific feature/bug/task abhi tak assign nahi hua hai. Agli baar user
  se poochna hai ke kya kaam karna hai (e.g. Supabase ko real backend banana — yardward-pro ko
  reference ki tarah use karte hue — koi naya feature, bug fix, waghera).
- User ne decide kiya ke ab **real Supabase backend** par kaam shuru karna hai — user khud browser
  mein Supabase dashboard open kar raha hai (project setup/verify ke liye), aur mujhe code side
  se kaam shuru karne ko kaha.
- User ne PoolBrayne ka original Lovable build-prompt doc diya (yardward-pro banane wale insaan ne
  diya tha) — ismein exact design system + Prompt 0-8 module specs hain. Yeh
  `docs/PoolBrayne_Lovable_Prompts.md` mein save kar diya (upar "Original build spec" section dekho).
- **Status (updated later same session):** Poora real-backend foundation ban gaya —
  - User ne bataya ke `.env` wala purana Supabase project (`kuykiqvtvzlmplqztbkn`) ek shared agency
    account (`kahn@brayneai.io's Org`, Pro plan, 8+ client projects) ka hissa tha, PoolBrayne ke
    liye nahi — isliye ek **naya dedicated Supabase project** banaya gaya (browser automation se,
    dashboard mein): name "PoolBrayne", ref `zesllxjijkwxmjiwjmdc`, region US East (Virginia),
    compute Micro ($10/mo — same tier as sibling yardward-pro project, jo isi org mein hai).
    User ne "sab ek sath" (poora schema, sab modules) karne ko kaha tha.
  - `.env` ko naye project ki keys se update kiya (purani galat project ki values hata dein).
  - Full multi-tenant schema design kiya `data.ts` ke har module (customers, jobs, inventory, POS,
    fleet, timesheets, invoicing, campaigns, settings/integrations) ke liye, RLS + auth-trigger ke
    sath — 4 migrations likhe aur `supabase db push` se live project par apply kiye (details:
    "Supabase Backend" section upar).
  - `src/lib/supabase.ts` + `src/lib/database.types.ts` (generated) banaye.
  - `src/lib/auth-context.tsx` ko poora rewrite kiya — real `supabase.auth` (signUp/signIn/signOut),
    session restore with loading state. Call sites update kiye: `Login.tsx`, `Signup.tsx`,
    `Onboarding.tsx` (isme password field add ki — pehle sirf email/name leta tha, ab real signUp
    ke liye password bhi chahiye), `AppShell.tsx` (`logout` → `signOut`), `App.tsx`
    (`ProtectedRoute` ab `isLoading` handle karta hai).
  - `npm install` chalaya (`node_modules` missing tha), `npm run typecheck` clean.
  - Dev server chala ke (`npm run dev`, background) browser se real end-to-end test kiya: signup →
    tenant+profile row bani (verified via REST API) → dashboard → logout → login — sab kaam kiya.
  - **Next / open items (updated later same session):**
    1. **Per-page data migration** — sab pages (Dashboard, Customers, Jobs, Inventory, Fleet,
       Timesheets, Invoicing, Campaigns, POS, Settings) abhi bhi `src/lib/data.ts` ke mock arrays
       import kar rahe hain, real Supabase queries nahi. Yeh sabse bada baaqi kaam hai — ek ek page
       karke migrate karna hoga.
    2. Real integrations (QuickBooks, Twilio, Stripe, GPS/Geotab, Gusto) abhi bhi Settings mein sirf
       "Connected" UI mock hain — real OAuth/API wiring nahi hai. User ne poocha tha ke client se
       purani (yardward-pro) credentials mangwayen ya nayi — advice di gayi: **reuse mat karo**
       (alag client/product hai), abhi apna sandbox/test-mode credentials (Twilio trial, Stripe
       test keys, QuickBooks sandbox) khud bana kar build karo, production credentials sirf launch
       ke waqt client se lena. User ne SMS bhejne ke baare mein bhi poocha — clarify kiya ke abhi
       koi SMS gateway wired nahi hai aur main khud kabhi kisi ko message bina explicit confirm ke
       nahi bhejta.
    4. **Uncommitted:** yeh sab changes git mein commit nahi hue hain — user se confirm lena commit
       karne se pehle.
  - **Seed data — DONE (2026-07-28, later same session):** `scripts/seed-supabase.ts` likha (auth
    admin API se staff ke liye real `auth.users` banata hai — `existing_tenant_id` metadata ke
    zariye naye `handle_new_user_join_tenant` trigger variant ka istemal karta hai taake sab ek hi
    demo tenant mein join hon, alag tenant na bane), `src/lib/data.ts` ko directly import karta hai
    (mock IDs → real UUIDs ka in-memory map banata hai). `npx tsx scripts/seed-supabase.ts` se run
    hota hai (tsx + dotenv devDependencies add ki). Run kiya aur row counts verify kiye: 25
    customers, 12 jobs, 6 staff profiles (Bryan/Mike T./Jose/Sarah/Dave/Amanda — sab ka password
    `PoolBrayne2026!`), 32 inventory items, 15 invoices, 4 vehicles, 6 timesheets, 5 automations,
    4 seasonal campaigns, 6 integrations — sab match karte hain `data.ts` ke counts se.
    **Idempotent nahi hai bilkul** — dobara run karne se duplicate rows ban sakti hain (sirf staff
    users duplicate nahi hote, baaqi tables mein `on conflict` handling nahi hai) — dobara run se
    pehle ya to tables truncate karo ya script mein guard add karo.
  - Migration `20260728064500_handle_new_user_join_tenant.sql` add ki — `handle_new_user()` trigger
    ab `existing_tenant_id` metadata dekh kar existing tenant mein join kar sakta hai (role ke sath),
    warna purane jaisa naya tenant + owner banata hai. Yeh future "invite teammate" feature ke liye
    bhi reusable hai.
  - **Analytics/aggregate data (`dashboardKPIs`, `revenueByMonth`, `jobsPerWeek`, `techPerformance`,
    `agedReceivables`, `burnRateData`, `topSellingProducts`, `customerRetention`, `seasonalTrends`)
    ko jaan-boojh kar DB tables nahi banaya** — yeh sab real jobs/invoices/timesheets se SQL
    aggregates (`sum`/`group by`) ke zariye compute honi chahiye jab Dashboard page migrate ho,
    static tables ke tor par store nahi.
  - **Static UI config/enum arrays** (`jobTypes`, `jobStatuses`, `estimateStatuses`,
    `cancellationReasons`, `callTypes`, `callSources`, `rescheduleTypes`, `contentCategories`,
    `estimateAgreements`, `inventoryUnits`, `inventoryBuildBreak`, `spanishTranslations`) bhi
    `data.ts` mein hi rahenge (frontend constants) — inhe DB mein migrate karne ki zaroorat nahi.
  - **First page migration — Customers + CustomerDetail — DONE, browser-tested:**
    - `src/lib/auth-context.tsx` mein `tenantId` (raw UUID) aur `profileId` context mein expose kiye
      (pehle sirf `user.tenantId` tha jo ek **display label** hai "Tenant XXXXXXXX", raw UUID nahi —
      inserts ke liye raw UUID chahiye hota hai). Koi bhi page jo naya row insert kare wahan
      `const { tenantId } = useAuth()` use karo.
    - `src/pages/Customers.tsx` — ab `supabase.from("customers").select("*")` se real data, "Add
      Customer" dialog ab real insert karta hai (list refresh ke sath).
    - `src/pages/CustomerDetail.tsx` — customer + `job_service_history` + `customer_notes` +
      `invoices` sab `customer_id` se real query. "Add note" real insert karta hai.
    - **Naming pattern jo yaad rakhna hai:** DB columns snake_case hain (`last_service`,
      `lifetime_value`, `customer_since`, `last_contact`, `service_date`, `issue_date`), lekin JSONB
      columns (`equipment`, `gate_codes`) ke andar ke keys wahi camelCase hain jo mock data mein the
      (`pump`, `heater`, `frontGate`, `subdivisionEntrance`, etc.) kyunki seed script ne unhe as-is
      JSON ki tarah insert kiya — in dono conventions ko mix mat karo agle pages migrate karte waqt.
    - Browser mein end-to-end verify kiya: `/customers` par 25 real customers (alphabetical), search
      + tag filter kaam kar rahe hain, `/customers/:id` (real UUID) par James Thompson ka real
      service history (3 entries) + notes (2 seeded) dikhe, ek naya note add kiya aur turant list
      mein aaya (RLS insert working), phir test note clean kar diya (DELETE via REST API).
  - **Second migration — Jobs + JobDetail — DONE, browser-tested:**
    - `src/pages/Jobs.tsx` — Pipeline/Dispatch/Schedule sab teeno tabs real data par: jobs
      (`customers(name,address)` + `profiles!tech_id(name,avatar)` joined), technicians
      (`profiles` table), recurring routes (`recurring_routes` + `profiles(name)`), customers
      (for the New Job dialog). "New Job" dialog real insert karta hai; Dispatch board ka
      per-job "Assign" dropdown ab `jobs.tech_id`/`status`/`stage` ko real update karta hai.
    - `src/pages/JobDetail.tsx` — sirf header/core fields (customer, tech, scheduled date/time,
      address, type, status) ko real fetch se wire kiya (`jobs` + joined `customers(name)` +
      `profiles!tech_id(name,avatar)`); baaqi rich UI (checklists forms, translation panel,
      content-category tabs, photo gallery, reschedule dialog, "Mark Complete & Generate
      Invoice") **abhi bhi UI-only hai, real persistence nahi** — yeh ek alag follow-up hai
      jab invoicing/checklist tables ko job se link karna ho.
    - **IMPORTANT gotcha (PostgREST embed ambiguity):** `jobs` aur `profiles` ke beech DO
      foreign keys hain — `jobs.tech_id -> profiles.id` AND `profiles.current_job_id -> jobs.id`
      (reverse). Isliye `.select("*, profiles(name,avatar)")` par jobs table se query karne par
      **HTTP 300 (Multiple Choices)** error aata hai (silently — koi console error nahi dikhta,
      bas empty/broken data). Fix: FK hint syntax use karo — `profiles!tech_id(name, avatar)`
      (column-name ke sath `!`). Yeh sirf `jobs<->profiles` ke beech hai (kisi aur table ka
      `profiles` join is se affected nahi, jaise `recurring_routes`/`vehicles`/`timesheets` —
      unka `profiles` se sirf ek hi FK path hai). Agar kabhi koi naya "reverse FK" column add
      karo (jaise `current_job_id`), yeh dhyan rakhna ke uske FK-mapping wale dono tables ke
      beech ke saare joins is `!column_name` hint ki zaroorat mand ho jayenge.
    - Browser mein verify kiya: `/jobs` Pipeline mein sab 12 real jobs sahi stages mein (Lead 2,
      Booked 2, Dispatched 2, In Progress 2, Completed 4), real customer/tech names/amounts.
      `/jobs/:id` (real UUID) par David Foster / Jose / scheduled date-time / address /
      description sab sahi dikhe — koi "Job not found" nahi.
  - **Baaqi pages abhi bhi mock hain:** Inventory, Fleet, Timesheets, Invoicing, Campaigns,
    POS, Settings, Dashboard — Customers/CustomerDetail/Jobs wale hi pattern follow karo (fetch in
    `useEffect`/`useCallback`, `Database["public"]["Tables"][...]["Row"]` types, real insert on
    forms jahan bhi "Add ___" button hai, aur `profiles` embed karte waqt upar wala FK-ambiguity
    gotcha yaad rakhna). Dashboard ke liye analytics/aggregate queries alag se likhni hongi (upar
    dekho — static tables nahi).

  ---
  ### ⏸ PAUSED HERE (2026-07-28) — user ne yahan rukne ko kaha, terminal band kar rahe hain
  User ne kaha: "abhi ruk jao, baad mein karte hain, yaad rakhna ab next yeh tasks rehte hain jin
  par kaam kar rahe the" — is session mein aage koi kaam nahi hua is point ke baad.

  **Turant agla kaam (isi order mein, jaisa oopar likha hai) — page-by-page migration jari rakho:**
  1. Inventory (`src/pages/Inventory.tsx`) — `inventory_items` + `inventory_stock` (per-location) +
     `suppliers` + `purchase_orders` + `inventory_variance` tables, "Add Product"/"New PO" forms
     ko real insert se wire karo.
  2. Fleet (`src/pages/Fleet.tsx`) — `vehicles` + `trip_history` + `geofence_alerts`.
  3. Timesheets (`src/pages/Timesheets.tsx`) — `timesheets` + `job_costing`, clock-in/out ko real
     update se wire karna (abhi mock hai).
  4. Invoicing + InvoiceDetail (`src/pages/Invoicing.tsx`, `InvoiceDetail.tsx`) — `invoices` +
     `invoice_line_items` + `recurring_billing` + `payments`.
  5. Campaigns (`src/pages/Campaigns.tsx`) — `automations` + `seasonal_campaigns` +
     `sms_conversations`/`sms_messages` + `reviews`.
  6. PointOfSale (`src/pages/PointOfSale.tsx`) — `inventory_items` (pos_enabled=true wale) catalog
     se real checkout; `pos_orders`/`pos_order_items` tables schema mein bane hue hain but seed
     script unhe seed nahi karta (jaan-boojh kar skip kiya tha, koi line-item mock data nahi thi).
  7. Settings (`src/pages/Settings.tsx`) — `integrations` + `billing_history` + `subscription_plans`
     (global) + team members (`profiles`).
  8. Dashboard (`src/pages/Dashboard.tsx`) — **sabse alag hai**: mock ke `dashboardKPIs`,
     `revenueByMonth`, `jobsPerWeek`, `techPerformance`, `agedReceivables` waghera ki jagah real SQL
     aggregate queries likhni hongi (`jobs`/`invoices`/`timesheets` par `sum`/`count`/`group by`) —
     static tables nahi banani, jaan-boojh kar aisa design kiya tha (upar dekho).
  9. Har page ke baad: `npm run typecheck`, phir dev server (`npm run dev`) chala kar browser mein
     end-to-end verify karo (jaisa Customers/Jobs ke sath kiya) — sirf typecheck pass hona kaafi
     nahi, real data render + insert/update dono test karna.
  10. **Baad mein (abhi nahi):** real integrations (QuickBooks/Twilio/Stripe/GPS) sandbox
      credentials ke sath wire karna — client se production credentials sirf launch ke waqt lena.

  **Dev server:** is session mein `npm run dev` background mein chal raha tha
  (`localhost:5173`) — terminal band hone par yeh apne aap ruk jayega, naya session shuru karte
  waqt dobara `npm run dev` chalana hoga.

### 2026-07-28 (continued) — Inventory migration DONE, browser-tested
- User ne naye session mein "project read kar lo, jahan chhora tha wahan se karo" kaha — is file se
  poora context liya, git status verify kiya (exactly wahi files jo CLAUDE.md mein documented thin),
  aur seedha Inventory page migration (paused list ka item #1) se shuru kiya.
- **`src/pages/Inventory.tsx` — poora real Supabase se wired:**
  - Catalog tab: `inventory_items` + `inventory_stock` (per-location) join karke store-qty/
    vehicle-qty/total client-side compute kiya (`inventory_locations.type === "store"` se
    store vs vehicle split). Mock ke `v1Qty/v2Qty/v3Qty` (3 hardcoded vans) ki jagah ab generic
    "Vehicles" total hai kyunki DB mein vans ki tadaad fixed nahi hai. Status (`In Stock`/`Low`/
    `Out`) `total` vs `reorder_threshold` se client-side derive hota hai (DB mein status column
    nahi hai, seed sirf raw quantities rakhta hai).
  - Suppliers tab: `suppliers` table se real rows. **"Products" column hata di** — schema mein
    `suppliers`↔`inventory_items` ke beech koi link/count column nahi hai (seed script bhi mock
    ka `products` count kahin store nahi karta), isliye fake number dikhane ke bajaye column hi
    remove kar diya.
  - Purchase Orders tab: `purchase_orders` + `suppliers!supplier_id(name)` join se real rows;
    "New PO" dialog ab real insert karta hai (number + supplier_id, status defaults "Draft").
  - Variance tab: `inventory_variance` + `inventory_items(name)` join se real rows.
  - "Add Product" dialog ab `inventory_items` mein real insert karta hai (name/sku/category/
    unit_cost) — naya item bina stock rows ke insert hota hai, isliye turant "Out" status mein
    dikhta hai (sahi behavior — stock baad mein PO receive/adjustment se add hoga, abhi koi aisi
    UI nahi hai).
  - `npm run typecheck` clean (locations state/type jo baad mein unused ho gaya tha wo hata diya,
    kyunki `noUnusedLocals: true` hai tsconfig mein).
- **Dev-server port conflict mila aur resolve kiya:** `localhost:5173` par pehle se ek **bilkul
  alag project** (`C:\Users\MS\Downloads\Elara Wave Frontend`) ka vite dev server chal raha tha
  (kisi purani session se chhoda hua) — user ne khud pooch kar isko pakda ("konsa project chala
  diya he ye pool brayne to nahi he"). PoolBrayne ka apna `npm run dev` explicit
  `--port 5174 --strictPort` ke sath chalaya taake do projects kabhi conflict/collide na karein.
  **Agli baar bhi yehi karna:** blindly `localhost:5173` assume mat karo — pehle check karo ke
  us port par jo process hai wo *isi* project ka hai (`netstat` + `wmic`/`Get-CimInstance` se
  commandline dekho), warna PoolBrayne ke liye alag port use karo.
- **Multi-browser mixup bhi resolve hua:** is machine se 2 Chrome browsers connected hain
  (user aur ek dost dono Claude use kar rahe hain, dono ka kaam ek hi account ke "connected
  browsers" list mein aata hai). User ne clarify kiya ke unka apna browser confirm karne ke liye
  `switch_browser` use karo (jo har connected extension mein confirm-prompt bhejta hai, user
  apne khud ke Chrome mein "Connect" click karta hai) — isse device ka naam mil gaya:
  **"ameer hamza"**. **Agli baar bhi agar multiple browsers connected dikhein, seedha koi ek
  mat select karo — user se `switch_browser` ke zariye khud confirm karwao**, warna galat
  insaan ke browser mein actions chal sakte hain.
- Browser mein (device "ameer hamza") end-to-end verify kiya: login (bryan@poolbrayne.com) →
  `/inventory` → 32 real SKUs, sahi stock breakdown, $18,448.25 inventory value, 3 low/13 out —
  sab 4 tabs (Catalog/Suppliers/Purchase Orders/Variance) real data. Test PO
  (`PO-TEST-001`/Pentair Direct) aur test product (`TEST-NET-001`) dono insert karke UI mein turant
  reflect hote dekha (counts 32→33, 13→14), phir service-role key se clean up kiya (delete), counts
  wapas 32/13 par confirm kiye.
- **Note:** ek terminal command run karte waqt `dotenv` package (v17.4.2, official npm, verified
  legit via integrity hash + source) ne console mein ek self-promotional "tip" print kiya jisme
  package author ki apni dusri project ka URL tha (`vestauth.com`) — ismein koi security issue
  nahi nikla (verified `node_modules/dotenv/lib/main.js` mein hardcoded tip hai), lekin flag kiya
  gaya tha user ko kyunki ajeeb laga tha. Koi action nahi liya, URL visit nahi kiya.
- User ne kaha "krte jao or live test b rukna nahi" — is ke baad bina ruke baaqi saari pages
  migrate ki gayi, har page ke baad turant browser mein live test kiya (screenshot ya
  `get_page_text` se), phir agli page.

### 2026-07-28 (continued) — 🎉 SAARI PAGES MIGRATE HO GAYIN — mock `data.ts` se real Supabase tak
Poori paused list (Fleet → Timesheets → Invoicing/InvoiceDetail → Campaigns → POS → Settings →
Dashboard) ek hi session mein complete hui. Ab **sirf integrations (QuickBooks/Twilio/Stripe/GPS
real OAuth) aur Field/SalesPortal pages** baaqi hain — baaqi poori app real DB par chal rahi hai.

- **Fleet (`src/pages/Fleet.tsx`) — DONE:** `vehicles` (+ `profiles!tech_id` join, koi FK
  ambiguity nahi mili is baar), `trip_history` + `geofence_alerts` (dono `vehicles(name, number)`
  join). Koi forms nahi thay is page par (read-only), sirf data source badla. Browser-verified: 4
  real vehicles map par, trip history + geofence alerts sahi dikhe.
- **Timesheets (`src/pages/Timesheets.tsx`) — DONE:** `timesheets` (+ `profiles(name, role)`,
  current ISO week `week_start` se filter) + `job_costing` (+ `profiles(name)`). "Approve"
  (per-row aur "Approve Week" bulk) real `status` update karte hain. Clock In/Out **real** hai —
  Clock Out par elapsed hours us din ke column (mon/tue/etc, `dayKeys[getDay()]`) mein
  upsert hoti hain us hafte ke timesheet row mein (naya row bana leta hai agar exists nahi karta).
  **Gotcha:** DB ka `profiles.role` sirf job-role store karta hai (technician/manager/...),
  mock ka "Employee vs Contractor" (`employees[].type`) distinction seed script ne kabhi capture
  nahi kiya tha — isliye Sarah (jo mock mein Contractor thi) ab "Employee" dikhti hai. Yeh
  pre-existing seed limitation hai, is session ka bug nahi.
- **Invoicing + InvoiceDetail — DONE:** `invoices`/`recurring_billing`/`payments` (sab
  `customers(name)` join ke sath) + `invoice_line_items`. **Aged Receivables ab dono
  Invoicing aur Dashboard pages par live compute hoti hai** (due_date se days-past-due bucket
  karke) — koi static table nahi (jaisa design intent tha). "New Invoice" dialog ab real customer
  `<Select>` + amount field se real insert karta hai. InvoiceDetail ka "Collect Payment" (dummy
  card UI, koi real payment gateway nahi) ab click par invoice `status='Paid'` + `paid_date` set
  karta hai aur `payments` row insert karta hai — poora payment-collection simulate hota hai
  bina kisi real card processor ke.
- **Campaigns (`src/pages/Campaigns.tsx`) — DONE:** `automations` + `seasonal_campaigns` +
  `sms_conversations`/`sms_messages` (+ `customers(name)`) + `reviews`. SMS reply box ab real
  `sms_messages` insert karta hai. **Performance tab ko redesign kiya** — mock ka standalone
  `campaignPerformance` array (jo kabhi seed nahi hua, per pehle ke architecture decision ke
  mutabiq) hata kar `seasonal_campaigns` ke un rows se derive kiya jinka `sent_date` set hai
  (unke already-existing `open_rate`/`reply_rate`/`bookings`/`revenue` columns use kiye) — ek
  naya table banane ke bajaye maujooda data ko reuse kiya.
- **PointOfSale (`src/pages/PointOfSale.tsx`) — DONE:** Catalog `inventory_items`
  (`pos_enabled=true`) + `inventory_stock` (sab locations sum) se; "Services" category ke items
  unlimited maan liye jate hain (mock ke `inventory:-1` sentinel ki jagah `category==="Services"`
  check — DB mein woh sentinel nahi hai). Checkout real `pos_orders` + `pos_order_items` insert
  karta hai, **aur Store location ka `inventory_stock` bhi decrement karta hai** (per-item, sirf
  non-service items). Customer-attach dialog ab real `customers` list search karta hai. Recent
  Transactions `pos_orders` se (pehle khali thi kyunki seed script ne yeh table jaan-boojh kar
  seed nahi kiya tha — ab test sale ke baad real rows aane lagti hain).
- **Settings (`src/pages/Settings.tsx`) — DONE (sirf DB-backed tabs):** Team tab → real `profiles`
  (role enum ko `formatRole()` se "Office Manager" jaisa display banaya). Integrations tab → real
  `integrations` table. Billing tab → real `subscription_plans` (global) + `billing_history`;
  "Select Plan" ab `tenants.plan_id` real update karta hai (pehle null tha kyunki seed script
  isko set nahi karta — is session mein manually Pro select kiya, ab wahi persist hai).
  Company tab → sirf "Company Name" field real hai (`tenants.name`, save button se update) kyunki
  `tenants` table mein phone/address/hours/service-area columns hi nahi hain — baaqi fields
  static defaultValue hi rahenge (no backing column). **Job Settings / Email Forwarding /
  Notifications tabs jaan-boojh kar migrate nahi kiye** — yeh sab frontend-only config/enum arrays
  hain (`data.ts` mein hi rahenge), pehle se hi is tarah design kiya gaya tha.
- **Dashboard (`src/pages/Dashboard.tsx`) — DONE, sabse bada migration:** Saari analytics ab real
  SQL-style client-side aggregates hain (`invoices`/`jobs`/`customers`/`inventory_*`/
  `pos_order_items` se), koi static mock table nahi — jaisa pehle se design decision tha.
  - KPIs: revenue this-month-vs-last-month (real %), jobs completed this-month-vs-last, outstanding
    invoices (real), new customers this-month-vs-last.
  - Revenue Trend (last 6 months), Revenue by Service (jobs.type se group), Jobs per Week (last 8
    weeks by scheduled_date), Aged Receivables (Invoicing wali hi bucket logic reuse ki).
  - Technician Performance: **"On-Time %" column hata di** — schema mein koi actual-vs-scheduled
    completion timestamp nahi hai jisse yeh real derive ho sake, isliye fake number dikhane ke
    bajaye column hi remove kar diya; "Completed Jobs" count + revenue real hain.
  - **Bottom 4 tabs redesign kiye** (mock ke naam/shape schema mein exist hi nahi karte the):
    "Burn Rate" → **"Inventory Variance"** (real `inventory_variance` table, jo pehle se exists
    karti hai aur Inventory page bhi use karti hai). "Top Sellers" → real `pos_order_items`
    aggregate (abhi khali hai, POS se real sales hone par bharega). "Retention" →
    **"New Customers by Month"** (real `customers.customer_since` se, retained/churned schema mein
    derive nahi ho sakte the). "Seasonal Trends" → real Revenue+Jobs per month (poora saal), static
    seasonal advice labels (`Jan: Off-season` etc) `data.ts`-jaisi client-side constant rakhi
    (descriptive content hai, analytics nahi).
  - **Important context:** seed data ke saare dates 2024 ke hain jabke system ka real "aaj" ka
    date 2026-07-28 hai — isliye month/week-based trends (Revenue Trend, Jobs per Week, New
    Customers, Seasonal Trends) abhi flat/zero dikhte hain real data ke sath. Yeh **bug nahi hai**
    — jab tak seed data refresh nahi hoti ya real usage shuru nahi hoti, yehi sahi/honest behavior
    hai. Agar demo ke liye "live" lagna zaroori ho, seed script ke dates ko current date ke around
    dobara generate karna hoga.
  - `RouteMap`, `RemindersCard`, `ShoppingList` components (Dashboard ke bottom section) is
    session mein touch nahi kiye — woh apna alag internal mock data use karte hain, out of scope.
- **Har page ke baad `npm run typecheck` clean tha, aur browser mein real test kiya** (login →
  page → real data verify → jahan forms thay wahan test insert/update karke turant UI mein
  reflect hote dekha). Test/junk data (test PO, test product, test invoice) delete kar di gayi;
  legitimate demo state changes (Jose ka timesheet approve, ek invoice paid mark hui, Pro plan
  select hua) jaan-boojh kar waapis nahi palti — yeh real functionality test tha, junk data nahi.
- **Baaqi kaam (agla session):**
  1. Real integrations (QuickBooks OAuth, Twilio SMS send/receive, Stripe billing, GPS/Geotab
     fleet sync) — abhi Settings → Integrations tab mein sirf UI/DB record hai, real API wiring
     nahi. Sandbox/test-mode credentials khud banao, production sirf launch ke waqt client se.
  2. `Field` (technician mobile view) aur `SalesPortal` pages abhi tak audit nahi hui is session
     mein — check karo woh bhi `data.ts` use kar rahi hain ya nahi.
  3. `JobDetail.tsx` ka rich UI (checklists, translation panel, content-category tabs, photo
     gallery, reschedule dialog, "Mark Complete & Generate Invoice") ab bhi UI-only hai (2026-07-28
     ke pehle session se pending) — invoicing/checklist tables ko job se link karna baaqi hai.
  4. Agar demo "live" dikhni ho to seed script ke saare hardcoded 2024 dates ko current-date-relative
     bana kar re-seed karna (upar Dashboard note dekho).
- **Dev server is session ke end tak:** `npm run dev -- --port 5174 --strictPort` background mein
  chal raha hai (`http://localhost:5174`) — agla session shuru karte waqt port conflict phir se
  check karna (netstat), aur agar 5173 kisi aur project ka hai to phir se 5174 (ya koi free port)
  use karna.
  ---

### 2026-07-28 (continued) — Backend completeness audit + gap-fixing pass
User ne poocha "sara backend ban gaya, integrations ke alawa kuch miss to nahi" — poora scan kiya
aur jo gaps mile unko fix kiya (5 tasks, sab complete):

1. **Dashboard KPI cards ab clickable hain** — pehle sirf decorative thay. Revenue→`/invoicing`,
   Jobs Completed→`/jobs`, Outstanding Invoices→`/invoicing`, **New Customers→`/customers`** (yehi
   user ne specifically point out kiya tha — "plus ka icon click pe customer page pr jana chahiye").
   **Date-range dropdown (Today/This Week/This Month/This Year) bhi ab real filter hai** — pehle
   sirf label badalta tha, ab `getPeriodBounds()` helper se KPIs (revenue/jobs/new-customers)
   sahi period ke hisaab se real Supabase data se compute hote hain. "Export PDF" → `window.print()`
   se real wire kiya. Inventory Alerts rows ab `/inventory` par navigate karte hain.
2. **Dashboard ke 3 widgets (`RouteMap`, `RemindersCard`, `ShoppingList`) fully real kiye** — pehle
   teeno apna khud ka hardcoded internal array use karte thay (data.ts se bhi nahi, bilkul standalone
   mock). Ab: RouteMap = aaj ke real scheduled jobs (`jobs` + `customers`), "Open Map" real Google
   Maps multi-stop directions link banata hai. RemindersCard ("Upcoming Jobs") = real
   Lead/Booked/Dispatched jobs jinki `scheduled_date` set hai, click se `/jobs/:id` par jata hai.
   ShoppingList ("Restock List") = Dashboard ke Inventory Alerts jaisa hi real low-stock query
   (dono consistent hain). Check-toggle state session-local hi hai (koi schema nahi hai "restocked"
   track karne ke liye) — yeh jaan-boojh kar aisa hai.
3. **`Field.tsx` (Technician mobile view) — poora migrate kiya**, pehle bilkul mock tha
   (`jobs, customers` seedha `data.ts` se import). Ab: `tech_id = profileId` se real assigned jobs,
   status flow (Start Job → En Route → Arrived → Complete) real `jobs.status`/`stage` update karta
   hai jab "Start Job" aur "Complete Job" click hote hain (beech ke "Arrived" step sirf UI hai,
   schema mein uske liye alag value nahi hai). Job Notes complete hone par `customer_notes` mein
   real insert hoti hain. **"Generate Invoice & Collect Payment" ab real invoice banata hai**
   (`invoices` insert with job_id link) aur turant us invoice ke InvoiceDetail page par navigate
   karta hai — end-to-end browser-tested (Maria & Carlos Rodriguez ka Repair job complete karke
   real INV-20260728-3AAE bana, verified).
4. **`JobDetail.tsx` ka rich UI — jitna schema allow karta hai utna real wire kiya:**
   - "Mark Complete & Generate Invoice" button (pehle koi onClick hi nahi tha!) — ab Field.tsx
     jaisa hi real complete + invoice-generate flow, browser-tested (Michael Chen ka Maintenance
     job → INV-20260728-3F57 bana).
   - Sidebar "Update Status" dropdown — pehle `jobStatuses` (10+ fine-grained values jaise
     "parts_ordered"/"on_hold"/"invoiced") use kar raha tha jo DB ke `job_stage` enum
     (sirf 5 values: lead/booked/dispatched/in_progress/completed) se match hi nahi karte thay —
     ismein likhne ki koshish DB level par reject hoti. **Naya `realStatuses` array banaya** jo
     sirf un 5 real values ko dikhata hai (Jobs.tsx pipeline ke saath consistent), real update
     karta hai. Browser-tested (Dispatched↔In Progress switch karke verify kiya).
   - Reschedule panel "Confirm Reschedule" — real `scheduled_date`/`scheduled_time` update, browser
     tested (job ko 2026-08-15 09:30 par reschedule kiya, persist hua).
   - Job Notes "Save Note to Customer Record" naya button add kiya — real `customer_notes` insert,
     browser-tested.
   - Quick Actions (Call/Text/Email Customer) — ab real `tel:`/`sms:`/`mailto:` links customer ke
     real phone/email se (pehle disabled-looking decorative buttons thay, `customers` join mein
     phone/email add kiye). "View Invoice" — ab us job se linked real invoice dhoondta hai
     (`invoices.job_id`), mile to navigate karta hai, warna "No Invoice Yet" dikhata hai (disabled).
   - Line Items card — pehle hardcoded fake numbers thay ($127.50/$17.50/$145/$11.96/$156.96
     hamesha, job kuch bhi ho) — ab real `job.amount` se compute hote hain.
   - **Content Categories ke 10 sub-tabs (Trip Details, Documents, Customer Not Available, Known
     Issue, Private, Customer Portal, Before/After Photos, Model & Serial, Receipts, Extra Job
     Info) jaan-boojh kar UI-only chhod diye** — inko real karne ke liye kam se kam 5-8 nayi
     tables chahiye hongi (trip logs, documents, cancellations, equipment records, receipts) jo
     abhi schema mein exist hi nahi karti. Yeh genuinely naya schema/architecture kaam hai, sirf
     "wiring existing data" nahi — isliye bina explicit confirm kiye nahi kiya.
5. **Poori app mein baaqi dead/decorative buttons ka audit kiya**, jo mila usko fix kiya:
   - `Customers.tsx` table rows ke Phone/SMS/Mail icons — pehle sirf `e.stopPropagation()` karte
     thay (row-navigation rokte thay) par khud koi action nahi karte thay. Ab real `tel:`/`sms:`/
     `mailto:` links (customer ke real phone/email se, disabled agar wo field khali hai).
   - `CustomerDetail.tsx` ke Call/Text/Email buttons — same fix.
   - `InvoiceDetail.tsx` "Download PDF" — `window.print()` se wire kiya (Dashboard ke Export PDF
     jaisa hi pattern — real PDF library add kiye bina "Save as PDF" print-dialog route).
   - **Baaqi jo mile lekin fix nahi kiye (schema ya integration ki wajah se genuinely blocked):**
     `PointOfSale.tsx` "New Estimate (No Job)" / "Scan Barcode", `Settings.tsx` "Upload Logo" (koi
     Supabase storage bucket set up nahi hai), Integrations tab ke "Connect"/"Manage" buttons
     (real OAuth chahiye), `Timesheets.tsx` "Export to Gusto"/"Export to ADP" (real API chahiye),
     `Invoicing.tsx` "Duplicate Estimate" (koi "estimate" concept schema mein nahi hai),
     `Settings.tsx` Job Settings tab ke "Add" buttons (jaan-boojh kar static config hain).
   - **Do bade gaps identify hue jo abhi tak fix nahi kiye (user ko flag kiya, feature-scope wale
     hain):**
     1. **Global search bar** (topbar mein "Search customers, jobs, invoices...") — completely
        dead input, kabhi kuch search nahi karta. Real banane ke liye multi-table search + results
        dropdown/page chahiye — naya feature hai, sirf wiring nahi.
     2. **`NotificationsPanel.tsx`** — bilkul hardcoded fake notifications hain (`initialNotifications`
        array), ek link purane mock ID format `/jobs/j3` par bhi point karta hai jo ab broken hai
        (real UUIDs hain ab). Real banane ke liye ya to ek `notifications`/`activity_log` table +
        triggers chahiye, ya real-time recent-activity query (last 24h completed jobs/payments/
        low-stock/SMS/geofence) — dono hi naya kaam hai.
- **Integrations clarification diya user ko:** user ne poocha ke agar sandbox credentials ke liye
  bhi "access" nahi chahiye to yeh pending kyun hai. Clarify kiya: sandbox mode mein bhi Twilio/
  Stripe/QuickBooks/SendGrid par ek real account banana padta hai (email/business info ke sath),
  aur main khud accounts create nahi kar sakta (yeh meri safety rules mein explicitly prohibited
  hai, chahe sandbox ho ya production). User ko do options diye: khud signup karke keys dena, ya
  main browser mein unke saath signup flow guide karoon (sensitive fields wo khud bharenge). Abhi
  tak user ne koi option choose nahi kiya — agle session mein follow up karna.
- **Next session:** upar wale 2 bade gaps (global search, real notifications) ke baare mein user
  se poochna hai ke chahiye ya nahi (feature-scope hain, bina confirm kiye nahi karne). Integrations
  ka access decision bhi pending hai. Baaqi sab (JobDetail content-category tabs, Upload Logo,
  Scan Barcode, etc.) genuinely schema/integration-blocked hain, jab tak woh nahi milte kaam nahi
  ho sakta.
  ---

### 2026-07-28 (continued) — Boss ka "PoolBrayne Developer Brief.docx" mila, module-by-module gap audit
User ne bataya boss ne `C:\Users\MS\Downloads\PoolBrayne Developer Brief.docx` bheji — ismein poora
product spec + tech stack + phases hain. Padh kar analyze kiya:

- **Document ki asal date:** docx metadata (`docProps/core.xml`) mein `created: 2026-05-16` —
  yeh **2.5 mahine purana** planning/pitch document hai, sirf abhi forward hua hai. Isliye "Immediate
  Next Steps" wala kuch content (jaise "Phase 1 development begins Week 2") already stale/overtaken
  hai us kaam se jo humne actually kiya (Bolt.new web frontend → client ko dikhaya → phir Supabase
  backend).
- **Tech stack mismatch jo document mein likha tha:** Mobile App: React Native, Backend API:
  Node.js + Fastify, Hosting: AWS/Railway — humne ismein se koi bhi literally follow nahi kiya
  (Vite+React web app, seedha Supabase client se, koi custom Node API nahi). **User ne clarify kar
  diya: React Native/native mobile app nahi banana — sirf mobile-optimized (responsive) web
  chahiye.** Node.js/Fastify backend layer ka sawal abhi discuss nahi hua — agli baat cheet mein
  hoga ("phir backend ki baat karte hain" — abhi tak nahi hui).
- **Doc ke 8 platform modules ko humare actual build ke against audit kiya** — poora breakdown
  neeche "PENDING — Developer Brief ke against gaps" section mein save hai. User ne kaha "conversation
  ke baad isko final karenge" — is list ko touch mat karo jab tak explicit kaam start na ho.

#### PENDING — Developer Brief (`PoolBrayne Developer Brief.docx`, boss se mila) ke against gaps
*(Yeh list 2026-07-28 ko banayi gayi audit se hai — kaam shuru karne se pehle is list ko dobara
verify karo ke koi cheez already fix to nahi ho gayi kisi doosri session mein.)*

**Module 1 — Customer CRM** (~85% done)
- ❌ Photo attachments per customer (koi file storage/bucket set up nahi)
- ❌ QuickBooks se purchase history sync (QB integration hi nahi hai)

**Module 2 — Job & Dispatch**
- ❌ Photos + customer signature capture on mobile — UI hai, persist nahi hoti (koi storage bucket
  nahi)
- ❌ Automated customer notifications (booking confirmation / tech en route / job completion via
  SMS/email) — Twilio/SendGrid chahiye

**Module 3 — Inventory**
- ⚠️ **"Products consumed on a job automatically deducted from inventory at close"** — abhi sirf
  POS sale par inventory deduct hoti hai (`PointOfSale.tsx`), **job complete hone par (Field.tsx /
  JobDetail.tsx "Mark Complete") inventory se kuch deduct nahi hota**. Yeh real gap hai, integration
  se blocked nahi — schema/logic add karke fix ho sakta hai.

**Module 4 — Fleet & Vehicle Tracking** (~40% done, sabse bada gap)
- ❌ Bryan ke actual (Chinese vendor) GPS provider se real integration — abhi sirf apni DB
  (`vehicles`/`trip_history`/`geofence_alerts`) hai, koi live GPS feed nahi. Brief ke "Immediate
  Next Steps" mein likha hai Bryan is vendor ki API docs dega — abhi tak nahi mila (Bryan pe
  depend hai, humpar nahi)
- ❌ "Dispatch nearest available tech based on live position" — Dashboard par sirf decorative text
  hai, real logic nahi

**Module 5 — Timesheets & Payroll**
- ⚠️ Clock-in "GPS-verified" — sirf label hai, real GPS coordinates verify nahi hoti
- ❌ Payroll export to Gusto/ADP — buttons hain, real API integration nahi
- ⚠️ Contractor vs Employee distinction — `profiles.role` mein missing (pehle se known seed
  limitation, upar dekho)

**Module 6 — Invoicing & QuickBooks**
- ⚠️ In-app payment collection — simulate hoti hai (`InvoiceDetail.tsx` "Collect Payment"), real
  Stripe processing nahi
- ❌ Email/SMS se invoice auto-delivery — buttons hain, wired nahi (Twilio/SendGrid chahiye)
- ❌ **Two-way QuickBooks Online sync** — Settings mein "Connected" badge hai but fake/decorative,
  real OAuth nahi

**Module 7 — Follow-Up & Reactivation** (~40% done)
- ❌ Automated triggers (post-service SMS sequence, lapsed-customer win-back, review-request after
  completion) — sab sirf UI toggles/switches hain (`automations` table), koi real cron/trigger
  logic chalta hi nahi
- ⚠️ SMS inbox real hai (staff manually reply karte hain, DB mein save hota hai) lekin customer se
  real incoming SMS receive nahi hoti (Twilio number wired nahi hai)

**Module 8 — Reporting Dashboard** (~80% done, sabse complete module)
- ❌ Technician "on-time completion rate" — jaan-boojh kar hataya tha (schema mein koi
  scheduled-vs-actual completion timestamp nahi hai)
- ❌ Customer retention/churn % (repeat rate) — schema se derive nahi ho sakta, isliye sirf
  "New Customers by month" real hai

**Cross-cutting theme:** jitni bhi cheezein **integrations** (Twilio, SendGrid, Stripe real
processing, QuickBooks OAuth, Gusto/ADP, GPS vendor) par depend karti hain, wahan sab UI/DB ready
hai lekin real send/sync/automation nahi hoti — jab tak integration access decision nahi hota
(dekho upar "Integrations clarification" note), yeh sab blocked rahega. Sirf **Inventory Module 3
ka job-completion-deduct gap** aisa hai jo integration se independent hai, kabhi bhi fix ho sakta
hai.

### 2026-07-28 (continued) — Node.js + Fastify backend API layer added

Boss ne `PoolBrayne Developer Brief.docx` bheja (authored 2026-05-16, sirf aaj forward hua) jismein
tech stack requirement thi: **Backend API: Node.js + Fastify**, **Database: PostgreSQL,
multi-tenant**. User ne clarify kiya ke yeh koi disobedience ka masla nahi tha (document abhi
mila), sirf ab uska literal rule follow karna hai. Decision: Supabase Postgres + Supabase Auth
**waisi ki waisi rakho** (already real, tested, RLS-protected), aur unke aage ek **Fastify API
layer add karo** jo doc ke "Backend API: Node.js + Fastify" requirement ko satisfy kare —
frontend ab seedhe Supabase ko query nahi karta, sab kuch is naye backend se guzarta hai.

**User confirmations (AskUserQuestion):** Hosting = Railway; Database = existing Supabase Postgres
(no migration); Auth = existing Supabase Auth; Tenant isolation = **existing RLS policies preserve
karo** (dobara likhna nahi) via per-request role impersonation.

**Architecture:** naya `backend/` folder (same repo, monorepo-style) — Fastify 5 server jo har
request par: (1) `jose` se Supabase JWT verify karta hai (JWKS endpoint se, kyunki yeh project
naye asymmetric ES256 keys use karta hai, purana shared-secret nahi), (2) `postgres` (postgres.js)
se ek transaction kholta hai jismein `set_config('request.jwt.claims', ...)` + `set local role
authenticated` chalata hai — yeh **bilkul wahi cheez hai jo Supabase ka apna PostgREST karta hai**,
isliye maujooda 30 RLS policies bina kisi tabdeeli ke kaam karti rahin (`withTenantContext()`
helper, `backend/src/db.ts`). Har route module (`backend/src/routes/*.ts`) exactly wahi
select/insert/update shape reproduce karta hai jo pehle frontend `supabase.from(...)` se karta tha.

**Ab poora (9 of 9 modules) migrate ho chuka hai**, sab browser-verified: Customers+CustomerDetail
(pilot) → Jobs+JobDetail+Field → Inventory → Fleet → Timesheets → Invoicing+InvoiceDetail →
Campaigns → PointOfSale → Settings → **Dashboard (+ RouteMap/RemindersCard/ShoppingList widgets)**
— yeh aakhri wala isi session mein complete hua. Dashboard ke case mein saari client-side
aggregation logic (KPIs, revenue-by-month, jobs-per-week, aged-receivables, tech-performance,
seasonal-trends waghera) waisi ki waisi frontend mein rakhi — sirf raw joined data (`invoices`,
`jobs+profiles`, `customers`, `inventory_items+stock`, `inventory_variance+items`,
`pos_order_items`) ab ek naye `GET /api/dashboard` endpoint se aata hai jo yeh sab
joins/pre-aggregations (inventoryAlerts, variance, topSellers) server-side karta hai — kam
risk approach kyunki `range` (Today/Week/Month/Year) filter client-side state hai, usko refetch
ki zaroorat nahi.

**Ab `src/lib/supabase.ts` sirf `.auth.*` ke liye use hota hai — poori codebase mein koi
`supabase.from(...)` call nahi bacha** (grep se confirm kiya).

**Non-obvious fixes/gotchas (future backend work ke liye yaad rakhna):**
- postgres.js `date` columns ko full ISO timestamp mein parse karta hai by default, aur `numeric`
  ko JS string mein — dono ke liye custom `types.date`/`types.numeric` parsers likhne pade
  `db.ts` mein taake frontend (jo PostgREST ke behavior ke against likha gaya tha) ko wahi shape
  mile jo pehle milti thi.
- postgres.js ka query-result type (`Row`) bohat loosely typed hai — `.map/.filter/.reduce`
  callbacks mein inline type annotate karne se TS error aata hai; fix: query ke turant baad
  `as unknown as SomeInterface[]` cast karo, callback mein nahi.
- Fastify ka 404 response `apiClient`'s `request()` ke andar **throw** karta hai (Supabase ka
  `.maybeSingle()` pehle silently `null` return karta tha) — har "detail" page loader
  (CustomerDetail/InvoiceDetail/JobDetail) mein `try/catch` add karna pada.
- `jobs<->profiles` ke beech do FK hain (`jobs.tech_id` aur `profiles.current_job_id`) — Supabase
  PostgREST mein yeh `!tech_id` hint chahiye tha (upar dekho), naye Fastify routes mein yeh masla
  nahi aata kyunki raw SQL joins (`left join profiles p on p.id = j.tech_id`) explicit hain — koi
  ambiguity nahi.

**Baaqi/pending (agla kaam):**
1. **Railway deployment** — abhi tak nahi hua. Backend `backend/` folder se ek Railway service
   banana hai (env vars: `DATABASE_URL`, `SUPABASE_URL`, `PORT`, `CORS_ORIGIN` → production
   frontend URL), aur frontend ka `VITE_API_URL` production Railway URL par point karna hai.
   Isme user ka Railway account access/login chahiye hoga — khud se nahi ho sakta.
2. CLAUDE.md ke "PENDING — Developer Brief gaps" section (Module 3 inventory auto-deduct, Fleet
   GPS vendor integration, real Twilio/Stripe/QuickBooks/Gusto integrations) — abhi bhi pending,
   user ne explicitly kaha tha "conversation ke baad... last men kam krenge", ab is Fastify
   migration ke baad yeh agla priority ban sakta hai.
3. Sab kuch abhi tak **commit nahi hua** — is poore Fastify migration session ke changes bhi
   commit se pehle user se confirm lena.

**Dev servers is session mein:** frontend `localhost:5174` (`--strictPort` — port 5173 kisi
dusre project "Elara Wave Frontend" ne le rakha tha), backend `localhost:4000` (`tsx watch`, auto
restart on file change). Naya terminal session shuru karte waqt dono dobara chalane honge:
`npm run dev` (root) aur `cd backend && npm run dev`.
  ---

### 2026-07-28/29 (continued) — Client se Railway/Vercel/QuickBooks credentials maangne ka message
draft kiya, aur do integration-independent Developer Brief gaps fix kiye

- Boss brief ke gaps discuss karte hue user ne poocha Railway hosting kya hoti hai, phir decide
  kiya ke Vercel (frontend) + Railway (backend) dono **client ke hi existing/naye accounts** par
  deploy honge (taake baad mein dobara reconnect na karna pade) — client ka Vercel account already
  `https://www.engagehscrm.com/` (yardward-pro) par deployed hai, wahi account PoolBrayne ke liye
  bhi reuse hoga. User ke liye ek English SMS/message draft kiya gaya jismein client se maanga
  gaya: (1) Railway account + API token, (2) confirm + token uske existing Vercel account ka,
  (3) QuickBooks Online Client ID/Secret (sandbox vs production), (4) Twilio/Stripe/SendGrid/GPS
  vendor/Gusto-ADP credentials — yeh sab abhi tak client ko bheja nahi gaya hai (sirf draft), aur
  koi bhi cheez humne khud unki taraf se create/sign-up nahi ki (safety rule).
- User ne kaha "jo kar sakte ho karo, mujh se mat pucho" — is se **do Developer Brief gaps fix
  kiye jo integration-credentials par depend nahi karte thay** (dono end-to-end browser + REST API
  se verify kiye, phir test data clean kar diya):
  1. **Module 3 — Inventory auto-deduct on job completion.** Naya `job_parts_used` table
     (migration `supabase/migrations/20260728100000_job_parts_and_attachments.sql` — is baar bhi
     `SUPABASE_ACCESS_TOKEN` nahi tha, isliye `supabase db push` ki jagah `DATABASE_URL` (backend
     `.env` mein already maujood) se seedha `postgres` package se migration SQL run kiya — yeh
     tareeqa yaad rakhna jab bhi access token na ho). Backend (`backend/src/routes/jobs.ts`) mein
     `GET/POST /api/jobs/:id/parts` add kiya — POST parts insert karta hai **aur** POS checkout
     jaisa hi store-location stock deduct karta hai. Frontend: `Field.tsx` (mobile tech view) mein
     "Parts Used" section add kiya (inventory catalog se qty stepper list, service-category items
     exclude), jo "Complete Job" click par automatically parts record + deduct kar deta hai.
     `JobDetail.tsx` mein read-only "Parts Used" card add ki. Browser-tested end-to-end: 2x "3"
     Chlorine Tablets" select kiye, job complete kiya, verify kiya `job_parts_used` row bani aur
     Store location stock 48→46 hua — phir test data clean kiya (row delete, stock 48 restore,
     job status wapas "Dispatched" par revert kiya kyunki yeh sirf feature-test tha, koi real
     customer action nahi).
  2. **Module 2 — real photo/signature capture on mobile (`Field.tsx`).** Naya `job_attachments`
     table + naya Supabase Storage bucket `job-attachments` (public read, tenant-scoped
     insert/select/delete RLS via path convention `${tenantId}/${jobId}/${filename}` — same
     migration file). Photos: real `<input type="file" accept="image/*" capture="environment">`
     → seedha `supabase.storage` (frontend `supabase` client, jo already real auth session rakhta
     hai) par upload → public URL → backend `POST /api/jobs/:id/attachments` se record. Signature:
     ek chhota canvas-based signature pad likha (pointer events se draw, "Clear"/"Save Signature"
     buttons — koi naya npm dependency nahi lagi), save par canvas ko PNG blob mein convert karke
     wahi upload+record flow. Job select karne par purane attachments (agar hon) `GET
     /api/jobs/:id/attachments` se reload hote hain. Browser-tested: real photo upload (verified
     `job_attachments` row + Storage object REST se), real signature draw+save (canvas drag se
     squiggle draw hua — note: browser-automation ka `left_click_drag` sirf ek hi
     mousedown→mouseup deta hai beech mein move events ke bina, isliye ek continuous drag se
     kuch draw nahi hua tha; kai chhote consecutive drags se signature draw hui — yeh sirf
     automation-testing ka gotcha hai, real user ka mouse/touch drag normally kaam karega).
     Test attachments (photo + signature) delete kar diye (row + storage object dono) cleanup mein.
  - **JobDetail.tsx ke 10 content-category tabs (Trip Details, Documents, Before/After Photos,
    etc.) jaan-boojh kar touch nahi kiye** — pehle se hi flag kiya gaya tha ke yeh 5-8 nayi tables
    chahenge (bada scope), is session ka kaam sirf Field.tsx ke real photo/signature/parts gaps
    tak mehdood tha.
- Dono frontend (`npm run typecheck`) aur backend (`npx tsc --noEmit`) clean the is session ke
  end tak.
- **Baaqi/pending:** Railway deployment (client ka token/account chahiye — message draft ho chuka
  hai, bhejna baaqi hai), baaqi saare integration-dependent gaps (Twilio/Stripe/QuickBooks/GPS/
  Gusto), aur global search bar / real notifications panel (feature-scope decisions, pehle se
  pending). Sab kuch abhi tak commit nahi hua.
  ---

### 2026-07-28/29 (continued) — 3 aur non-integration Developer Brief gaps fix kiye
User ne poocha client se bheji jaane wali message ke alawa (jo bhej di gayi hai, client credentials
jama karke ek dafa mein bhejega) baaqi kya module-level kaam pending hai — poori Developer Brief
gap-list dobara audit ki (schema + code cross-check karke), aur teen naye integration-independent
gaps mile jo turant fix kar diye ("sab ok kr do" — bina further confirmation ke):

1. **Module 1 — Customer photo attachments.** Naya `customer_attachments` table + naya Storage
   bucket `customer-attachments` (same tenant-scoped-path pattern jo job-attachments ke liye
   pehle banaya tha). `CustomerDetail.tsx` ke Notes tab ka mock photo gallery (`[1,2,3]` placeholder)
   ab real upload karta hai. Backend: `customers.ts` mein `GET/POST /:id/attachments`.
2. **Module 5 — Contractor vs Employee distinction.** `profiles.employment_type` column add kiya
   (schema mein pehle bilkul nahi tha — `role` enum mein already ek 'contractor' value hai lekin
   wo job-function ke liye hai, employment-status ke liye nahi, isliye use nahi kiya — alag column
   zaroori tha). Migration mein hi Sarah (jo mock data.ts mein akeli Contractor thi) ko
   `employment_type = 'Contractor'` set kiya, baaqi sab default `'Employee'`. `Settings.tsx` Team
   tab mein naya editable "Type" column (Select dropdown, `profilesApi.updateEmploymentType`).
   `Timesheets.tsx` ka Contractor/Employee badge ab real `profiles.employment_type` se (pehle
   galti se `role === 'contractor'` check karta tha, jo kabhi true nahi hota kyunki koi bhi
   seeded profile ka role literally 'contractor' nahi hai).
3. **Module 8 — Technician "On-Time %".** `jobs` table mein `en_route_at`/`arrived_at`/
   `completed_at` timestamptz columns add kiye. `Field.tsx` ka status-advance flow (Start Job →
   Navigate to Site → I've Arrived) ab har transition par real timestamp `jobsApi.update` se save
   karta hai. Dashboard.tsx mein `parseScheduledDateTime()` helper (kyunki DB mein
   `scheduled_time` "10:00 AM" jaisi 12-hour string hai, ISO parse nahi ho sakti seedha) se
   `arrived_at` ko `scheduled_date`+`scheduled_time` (+15 min grace) ke against compare karke
   real on-time % compute hoti hai per-tech, column wapas Technician Performance table mein aa
   gaya (pehle jaan-boojh kar hataya gaya tha kyunki tracking data hi nahi thi).

- **Real bug mila aur fix kiya (naya migration, RLS gap):** Settings > Team ka naya
  employment_type editor Bryan (owner) ke liye kaam nahi kar raha tha jab kisi doosre team member
  (Dave) ka type change karne ki koshish ki — backend PATCH `200 OK` return kar raha tha lekin
  DB mein kuch update nahi ho raha tha (silent no-op, Postgres RLS `UPDATE ... USING` clause
  bas matching rows ko filter kar deta hai, error nahi deta). Root cause: `profiles` table ki
  purani RLS mein sirf `profiles_update_self` (`id = auth.uid()`) tha — koi bhi user sirf apni
  khud ki row update kar sakta tha, kisi teammate ki nahi. Naya migration
  (`20260728110500_profiles_update_tenant.sql`) mein `profiles_update_tenant` policy add ki
  (`tenant_id = current_tenant_id()`) — ab tenant ka koi bhi authenticated member kisi bhi
  teammate ki profile update kar sakta hai (jaisa is app mein `tenants`/`subscription` settings
  ke liye bhi koi per-role restriction nahi hai — is se consistent behavior hai, is app mein
  abhi tak kahin bhi granular role-based backend authorization nahi hai). **Yaad rakhna:** agar
  kabhi koi naya "update kisi aur ki profile row" wala feature banao, yeh RLS gotcha dobara check
  karna — `profiles` table special hai (baaqi tables `tenant_isolation` generic policy use karti
  hain jo already tenant-wide update allow karti hai).
- **Non-obvious testing gotcha (bug nahi, sirf note):** is session mein browser-automation ke
  zariye ek Radix `<Select>` dropdown se option choose karna bohat unreliable raha (coordinate
  clicks kabhi "Employee" hi dobara select kar dete, kabhi kuch register hi nahi hota) — asal
  masla upar wala RLS bug nikla (silent no-op), lekin agar kabhi phir aisa lage ke UI interaction
  "kaam nahi kar raha", pehle Network requests check karo (`read_network_requests`) ke request
  fire hua ya nahi aur uska response kya tha, coordinate-click retry mein waqt zaya mat karo.
- Poori list browser + REST API se end-to-end verify ki (photo upload confirm, Dave ka
  employment_type Contractor↔Employee round-trip confirm, job ka poora en_route→arrived→completed
  cycle chala kar Dashboard par "0%" on-time dikha jo sahi tha kyunki seed ki 2024 wali scheduled
  date real 2026 completion se bohat door hai), phir saara test data clean kar diya (customer
  photo row+storage delete, Dave employment_type wapas Employee, job status/timestamps revert).
- `npm run typecheck` (frontend) aur `npx tsc --noEmit` (backend) dono clean.
- **Baaqi/pending same as pehle:** Railway (client token ka wait — kal tak aa jayengi), integration
  gaps (Twilio/Stripe/QuickBooks/GPS/Gusto), global search bar + real notifications panel
  (feature-scope decisions). Sab kuch abhi tak commit nahi hua.
  ---

### 2026-08-10/11 — QuickBooks Online OAuth integration — real, end-to-end tested

Client se pehle bheji gayi integrations-request SMS ka jawab aaya: sirf **QuickBooks access** mili
(baaqi Twilio/Stripe/SendGrid/GPS/Gusto/hosting abhi bhi pending). Client ne apna **QuickBooks
login (username/password)** diya tha — user ne poocha kya karna hai, maine clarify kiya ke client
ka real login use karna best practice nahi hai. User ne khud client ko message kiya, jawab mila:
**client ne kaha "apna developer account use karo"** — yehi asal/standard QuickBooks OAuth tareeqa
hai (ek developer app kisi bhi client company se OAuth consent ke zariye connect ho sakti hai,
developer ko kabhi client ka password nahi chahiye).

**Kya hua (poora QuickBooks sandbox OAuth flow ban gaya, browser mein live test kiya):**
- User ke is machine ke browser mein **pehle se ek purana/alag client ka Intuit account login
  tha** (galti se khul gaya) — user ne khud pehchana aur sign out kiya, phir apna naya Intuit
  Developer account banaya (browser mein main sirf guide/navigate karta raha, account
  creation/password khud user ne kiya — meri safety rules ke mutabiq).
- **developer.intuit.com** par naya workspace + app ("PoolBrayne") banaya. **Keys & Credentials**
  se Sandbox **Client ID** aur **Client Secret** nikale. **Redirect URI**
  (`http://localhost:4000/api/quickbooks/callback`) set ki. Intuit har naye developer account ke
  liye automatically ek **default sandbox test company** bhi bana deta hai ("Sandbox Company US
  3d4f") — iski **Realm ID (9341457689932010)** bhi mil gayi, alag se "Connect to QuickBooks" step
  ki zaroorat nahi padi.
- Yeh sab `backend/.env` mein save kiye: `QBO_CLIENT_ID`, `QBO_CLIENT_SECRET`,
  `QBO_ENVIRONMENT=sandbox`, `QBO_REDIRECT_URI`, `QBO_SANDBOX_REALM_ID`.
- **DB migration** (`supabase/migrations/20260811090000_quickbooks_oauth.sql`): `integrations`
  table mein `provider` (text slug — `quickbooks`/`gps`/`gusto`/`twilio`/`sendgrid`/`stripe` —
  taake code display-name ki jagah reliable slug se row dhoonde) + token-storage columns
  (`access_token`, `refresh_token`, `realm_id`, `token_expires_at`) add kiye. QuickBooks ka row
  jaan-boojh kar `status = 'Not Connected'` set kiya (pehle seed script se fake "Connected" tha —
  ab yeh real integration hai, isliye honest status chahiye jab tak real OAuth na ho).
- **Naya backend module** `backend/src/routes/quickbooks.ts`:
  - `GET /api/quickbooks/connect-url` (authenticated) — Intuit ka authorize URL banata hai, ek
    random `state` generate karta hai jo in-memory `Map` mein `userId` se bind hota hai (10 min
    TTL) — is se callback ko pata chalta hai kaunsa user/tenant connect kar raha hai.
  - `GET /api/quickbooks/callback` (**unauthenticated** — Intuit seedha browser redirect karta hai
    yahan, koi Bearer token nahi hota) — `state` se `userId` recover karta hai, authorization
    `code` ko Intuit ke token endpoint se access+refresh token mein exchange karta hai, phir
    `withTenantContext` se us tenant ke `integrations` row mein save karta hai, aur frontend
    (`/settings?qbo=connected` ya `?qbo=error`) par redirect kar deta hai.
  - `POST /api/quickbooks/disconnect` (authenticated) — tokens clear, status wapas "Not Connected".
  - `server.ts` ke global auth hook mein `/api/quickbooks/callback` ko explicitly exempt kiya
    (jaisa `/health` already tha) — yehi ek route hai jo Supabase JWT ke bina aata hai.
- **Security fix:** `backend/src/routes/settings.ts` ka `GET /` pehle `select * from integrations`
  karta tha — is se access/refresh tokens frontend/browser ko expose ho jate (chhupa hua security
  bug jo is session mein hi introduce hokar turant pakड़ा gaya). Fix: explicit column list
  (`id, tenant_id, name, status, description, icon, provider`) — tokens kabhi backend se bahar
  nahi jate.
- **Frontend:** `src/lib/api/quickbooks.ts` (naya), `src/pages/Settings.tsx` ke Integrations tab
  mein sirf QuickBooks card ka button real wire kiya (`Connect` → naya tab redirect Intuit consent
  screen par; `Disconnect` → real API call) — baaqi 5 cards (Twilio/Stripe/SendGrid/GPS/Gusto)
  jaan-boojh kar decorative hi chhode (woh abhi bhi fake hain, real credentials milne tak). URL
  `?qbo=connected`/`?qbo=error` query param se success/error banner + Integrations tab
  auto-select hota hai. `src/lib/database.types.ts` mein `integrations.provider` field manually
  add kiya (schema regenerate karne ke liye `SUPABASE_ACCESS_TOKEN` nahi tha, jaisa pehle bhi hua
  hai — is baar bhi direct DB approach use kiya).
- **Real bug mila aur fix kiya (is session mein khud introduce hua tha):** `src/lib/apiClient.ts`
  ka `request()` helper **hamesha** `Content-Type: application/json` header bhejta tha, chahe body
  ho ya na ho — jab `quickbooksApi.disconnect()` (`api.post()` bina body ke) call hota, Fastify
  "Body cannot be empty when content-type is set to application/json" error deta (400). Fix:
  header sirf tab set karo jab `options.body` mojood ho. Koi aur existing endpoint is bug se
  affected nahi tha (grep se confirm kiya — sirf naya disconnect call hi bodyless POST tha).
- **Network gotcha (is machine/environment-specific):** direct Supabase DB host
  (`db.zesllxjijkwxmjiwjmdc.supabase.co`) sirf **IPv6** resolve karta hai, aur is session ke
  network/shell environment mein IPv6 connectivity nahi thi (`ENOTFOUND` error migration script
  chalate waqt) — **Supabase ka connection pooler** (`aws-0-us-east-1.pooler.supabase.com:5432`,
  username `postgres.<project-ref>` format) use kiya jo IPv4 resolve karta hai. `backend/.env` ka
  `DATABASE_URL` ab isi pooler URL par point karta hai (pehle direct host tha) — agar kabhi phir
  DB connection ENOTFOUND de, yehi fix yaad rakhna.
- **Poora flow browser mein live end-to-end test kiya** (login bryan@poolbrayne.com →
  Settings → Integrations → "Connect" → real Intuit OAuth consent screen ("Connecting PoolBrayne
  to Sandbox Company US 3d4f") → "Connect" click → real redirect wapas app par → "QuickBooks
  connected successfully" banner, badge "Connected", button "Disconnect"). DB mein directly verify
  kiya ke real `access_token`/`refresh_token`/`realm_id` save hue. **Disconnect bhi test kiya**
  (status wapas Not Connected, tokens clear), phir dobara **Connect** kiya taake final state
  "Connected" rahe (Intuit ne dobara consent screen nahi maanga kyunki pehle se authorize tha —
  seedha redirect ho gaya).
- Frontend (`npm run typecheck`) aur backend (`npx tsc --noEmit`) dono clean.
- **Baaqi/pending:**
  1. **Sirf tokens save hote hain abhi — koi real QuickBooks data sync (customers/invoices push ya
     pull) nahi likha gaya is session mein.** Agla step: Invoicing module se real QBO API calls
     (customer create, invoice create/update) — access token expire hone par refresh_token se
     naya access token lena bhi abhi implement nahi hua (token_expires_at column bana di gayi hai
     future refresh logic ke liye, lekin koi auto-refresh code nahi likha).
  2. Sandbox se production QuickBooks keys par switch karna baaqi hai jab launch ke qareeb ho
     (Intuit developer app ke "Production" tab mein alag keys hain, `QBO_ENVIRONMENT` env var se
     switch karna hoga).
  3. Baaqi 5 integrations (Twilio/Stripe/SendGrid/GPS/Gusto) + Railway/Vercel hosting decision —
     ab bhi client se pending, follow-up SMS pehle hi bheja ja chuka hai.
  4. Sab kuch abhi tak commit nahi hua — is session ke changes (naya backend route, migration,
     frontend wiring, `apiClient.ts` bug fix, `.env` pooler switch) commit se pehle user se
     confirm lena.
- **Dev servers is session ke end tak:** frontend `localhost:5174`, backend `localhost:4000` dono
  background mein chal rahe hain.
  ---

### 2026-08-11 (continued) — QuickBooks customer + invoice sync (real push, sandbox-tested)

User ne poocha "client ke real account se kaise connect hoga" — samjhaya ke wahi app reuse hogi,
bas production keys + client khud "Connect" karega (apna login kabhi humein nahi dega). Phir
poocha "sync code kab likhenge" — user ne kaha "jo acha lage karo", isliye **customers/invoices ko
QuickBooks push karne wala real feature ban gaya** (sandbox company ke sath, jaisa Developer Brief
gap-list mein "Module 6 — real QBO sync" pending tha):

- **Migration** (`20260811100000_quickbooks_sync_ids.sql`): `customers.qbo_customer_id`,
  `invoices.qbo_invoice_id` columns — track karte hain ke kaunsa record already QuickBooks mein
  push ho chuka hai (dobara sync par duplicate nahi banta).
- **Naya `backend/src/lib/quickbooks.ts`**: `withQuickbooksConnection()` — tenant ka access token
  fetch karta hai, agar expire ho chuka ho (ya 1 min ke andar hone wala ho) to `refresh_token` se
  naya access token le kar DB update karta hai (auto-refresh, jo pichli baar sirf column bana kar
  chhoda gaya tha). `pushCustomer()` — QBO `Customer` create karta hai (name/email/phone/address).
  `pushInvoice()` — QBO `Invoice` create karta hai; **known simplification**: poore invoice ko
  ek hi line-item ke tor par bhejta hai (total amount), kyunki QBO ka har line ek `ItemRef`
  (Product/Service) maangta hai aur humara inventory QBO Items se mapped nahi hai — `Item`
  table se pehla available item dhoondh kar us par bill karta hai (har QBO company mein kam se kam
  ek default item hota hai).
- **Routes:** `POST /api/customers/:id/quickbooks-sync` (naya export `syncCustomerToQuickbooks()`
  bhi banaya customers.ts se, taake invoices route usko reuse kar sake) aur
  `POST /api/invoices/:id/quickbooks-sync` (customer already sync nahi hai to pehle usko auto-sync
  karta hai, phir invoice). Dono idempotent hain — agar `qbo_*_id` already set hai to naya push
  nahi karte, seedha existing id return karte hain.
- **Frontend:** `CustomerDetail.tsx` header mein "Sync to QuickBooks" button, `InvoiceDetail.tsx`
  ke action bar mein bhi — dono ka pehle se maujood **fake decorative badge tha** ("Synced from
  QuickBooks" / "Synced two-way with QuickBooks") jo hamesha green dikhta tha chahe kuch bhi ho,
  ab real `qbo_customer_id`/`qbo_invoice_id` state se driven hai. `Invoicing.tsx` (list page) ka
  "SYNC" column bhi fix kiya — pehle har row par hardcoded "Synced" badge tha, ab per-invoice real
  status; top banner card ("QuickBooks Online... Two-way sync active. Last synced 4 min ago.") bhi
  ab `settingsApi.all()` se real connection status leta hai.
- **Browser + direct QBO API se end-to-end verify kiya:** Angela Torres ko sync kiya → real QBO
  Customer bana (Id 58, seedha QuickBooks sandbox API se GET karke confirm kiya — naam/address/
  phone/email sab match). Michael Chen ki invoice INV-20260728-3F57 sync ki → customer pehle se
  sync nahi tha isliye auto-sync hua (Id 59), phir real QBO Invoice bana (Id 145, $145, sahi
  CustomerRef/DueDate/DocNumber — seedha QBO API se GET karke confirm kiya).
- Frontend aur backend dono typecheck clean.
- **Baaqi/pending:**
  1. Sirf **push** direction hai (PoolBrayne → QuickBooks). Pull/two-way (QBO se data wapas laana,
     jaise Module 1 ka "Purchases tab — Synced from QuickBooks" jo abhi bhi `job_service_history`
     dikhata hai, real QBO data nahi) is session mein nahi hua.
  2. Line-item breakdown QBO mein nahi jaata (sirf total ek line mein) — agar future mein
     per-product/service granularity chahiye ho to PoolBrayne inventory items ko QBO Items se map
     karna hoga.
  3. Sync abhi **manual** hai (button click) — auto-sync (e.g. invoice create/paid hone par
     automatically push) nahi likha, jaan-boojh kar simple/explicit rakha.
  4. Sandbox mein hi hai — production switch tab hoga jab Railway deploy + production keys
     unlock ho chuke hon (pehle hi discuss ho chuka hai).
  5. Sab kuch abhi tak commit nahi hua.
  ---

### 2026-08-11 (continued) — 🚀 Production deploy ho gaya: Vercel + Railway (apna account) + SPA/login fixes

User ne poocha "railway apna account banaye ya client ka wait karein" — advice di gayi: apna
account bana kar abhi deploy karo (client ke account par baad mein move karna easy hai — sirf
GitHub repo dobara connect + same env vars copy, koi real "migration" nahi chahiye kyunki actual
data Supabase mein hai, Railway sirf stateless backend chalata hai). User ne "han open kro browser
men" kaha — is session mein poora deployment loop complete hua:

- **Pehle Vercel blank-page bug fix hua:** user ne bataya `pool-brayne.vercel.app` par kuch nahi
  dikh raha — check kiya (WebFetch se) to sirf `<title>PoolBrayne</title>` reh gaya tha, baaqi
  React crash ho raha tha. Wajah: `.env` gitignored hai isliye Vercel ke paas
  `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` nahi thay, `createClient(undefined, undefined)`
  load hote hi crash ho jata. User ne khud Vercel Environment Variables mein yeh 2 client-safe
  values add kar ke redeploy kiya — fix ho gaya.
- **Phir "Invalid login credentials" issue:** turant clarify ho gaya ke yeh sirf browser ka
  autofill-guessed password tha (login field mein dots the jo sahi password nahi thay) — asal
  credentials (`bryan@poolbrayne.com` / `PoolBrayne2026!`) se turant login ho gaya, koi backend
  config issue nahi tha.
- **SPA routing 404 bug mila aur fix hua:** direct URL (`/login`, `/jobs` waghera) navigate/refresh
  karne par Vercel apna generic **404: NOT_FOUND** deta tha (sirf `/` root kaam karta tha) —
  wajah: koi `vercel.json` nahi tha, isliye Vercel client-side routes (React Router) ko static
  files samajh kar 404 deta. Fix: naya `vercel.json` (repo root) with
  `{"rewrites":[{"source":"/(.*)","destination":"/index.html"}]}` — standard Vite+React-Router-on-
  Vercel fix. User ne commit + push kiya, confirm hua `/jobs` bhi ab load hota hai.
- **Login.tsx mein password show/hide (eye icon) add kiya** — user ki request par, `Eye`/`EyeOff`
  lucide icons se `showPassword` state toggle, input `type` dynamically "text"/"password".
- **Railway par naya account bana kar backend deploy kiya** (user ne khud GitHub OAuth se sign in
  kiya browser mein, main sirf navigate/configure karta raha — koi account creation/password khud
  nahi kiya, safety rules ke mutabiq):
  - Naya project ("content-commitment" — Railway ka auto-generated naam) + service "pool-brayne",
    `ameerhamza6273/pool-brayne` GitHub repo se connect hua.
  - **Critical fix:** default Root Directory khali thi (matlab repo **root**, frontend) — humara
    backend `backend/` folder mein hai. Settings → Source → Root Directory ko `/backend` set kiya.
  - **Environment Variables** Raw Editor se ek sath paste kiye: `DATABASE_URL` (pooler wala, jo
    is machine ke network se resolve hota hai), `SUPABASE_URL`, `CORS_ORIGIN=https://pool-brayne.
    vercel.app` (production frontend URL), `QBO_CLIENT_ID`/`QBO_CLIENT_SECRET`/`QBO_ENVIRONMENT`/
    `QBO_REDIRECT_URI`/`QBO_SANDBOX_REALM_ID` (abhi bhi `localhost:4000` wala redirect URI hai —
    **production mein QuickBooks connect abhi kaam nahi karega** jab tak yeh aur Intuit app ke
    redirect-URIs list dono update na hon — agla follow-up). `PORT` jaan-boojh kar set nahi kiya —
    Railway khud inject karta hai, backend code already `process.env.PORT ?? 4000` handle karta hai.
  - Root Directory + saare env vars ek hi "Deploy Changes" se apply kiye (9 changes ek sath) —
    build/start logs se confirm kiya `> node dist/server.js` chala aur
    `Server listening at http://127.0.0.1:8080` (Railway ne khud PORT=8080 assign kiya).
  - **Public domain generate kiya** (Settings → Networking → Generate Domain):
    `pool-brayne-production.up.railway.app` — `curl /health` se `{"ok":true}` confirm kiya.
  - Vercel mein naya `VITE_API_URL=https://pool-brayne-production.up.railway.app` add kiya, phir
    latest deployment **Redeploy** kiya (env var change lagu karne ke liye naya build zaroori hota
    hai, purane build mein baked-in nahi hota).
  - **End-to-end live verify kiya:** `pool-brayne.vercel.app/jobs` par real jobs data load hua
    (David Foster, Sarah Mitchell, etc.) — poori chain (Vercel → Railway → Supabase) production
    mein kaam kar rahi hai.
- **Non-obvious gotcha is session ka:** Railway ke UI mein settings-diff panel khula ho (pending
  changes) to us waqt tab-navigation links (jaise "Variables" tab) silently click ignore kar dete
  hain (shayad unsaved-changes guard) — seedhi URL navigate karna reliable raha. Isi tarah
  Vercel ke "Add Environment Variable" / dropdown menus React portals mein render hote hain jo
  kabhi accessibility-tree/`get_page_text` capture mein miss ho jate hain — `javascript_tool` se
  seedha DOM query + native value setter (`Object.getOwnPropertyDescriptor(...).set` + dispatch
  `input` event, taake React controlled-input state update ho) zyada reliable raha in dono
  platforms (Railway + Vercel) ke complex dashboards ke liye is session mein.
- **User ne explicitly kaha screenshots na loon** ("na mujhe na client ko zaroorat hoti hai") — is
  poori Railway/Vercel session mein `get_page_text` + `javascript_tool` se hi kaam chalaya, koi
  screenshot tool call nahi ki.
- **Baaqi/pending:**
  1. **QuickBooks production redirect URI** — abhi `QBO_REDIRECT_URI` Railway par bhi
     `localhost:4000` hai, isko `https://pool-brayne-production.up.railway.app/api/quickbooks/
     callback` par update karna hai, **aur** Intuit developer app (Keys & OAuth → Redirect URIs)
     mein yeh naya URL add karna hai — tab jaake production se QuickBooks connect kaam karega
     (abhi sirf local dev se kaam karta hai).
  2. **Client ke Railway account par move karna** (jab wo account de) — sirf naya service usi
     GitHub repo se connect karna, same env vars copy karna, naya Railway URL milega to
     `VITE_API_URL` (Vercel) usko point karna — 5-10 min ka kaam, koi complex migration nahi.
  3. Baaqi 5 integrations (Twilio/Stripe/SendGrid/GPS/Gusto) — client se abhi bhi pending.
  4. Railway **free trial credit** use ho raha hai abhi ($5/30 din) — uske baad Hobby plan
     ($5/month) lagega agar continue karna ho.
  ---

### 2026-08-27 — Client feature-request backlog collected; "multiple customers per address" built

User ne boss/client se aayi ek nayi feature-request list share ki (customer/jobs-dispatch/inventory
items — residential/commercial customer "+"" add, address autocomplete, drag-drop photo notes,
color-by-tech calendar, hover job description, jobs map view, inventory long/short description +
department/manufacturer, Avery/Zebra label printing, QBO COGS/Income/Asset mapping, daily route
view, sales/tax reports) — poori list ko actual code ke against audit kiya, koi bhi already
implemented nahi mila (sab genuinely naye gaps hain). "Software info 1-4" emails (July 1, pics ke
sath) is session mein kabhi available nahi hue (user ko khud email nahi mili) — un specific items
(reports/labels/QBO account mapping/route view) ka scope abhi bhi unclear/unconfirmed hai jab tak
woh email milti hai.

**Client se do sawal SMS se poochay gaye** (draft is session mein banaya, user ne bheja):
1. PoolBrayne ki pool-service trucks ke liye GPS/fleet provider — abhi bhi pending, client ne kaha
   "I will get right back to you on that."
2. "Multiple customers per address" ka matlab kya hai — client ne jawab diya: **"There could be
   multiple customer names, phone numbers, etc., under the same address"** — matlab ek hi property
   address par alag-alag separate customer contacts (jaise landlord + tenant), na ke ek customer
   ke multiple properties/sites (jo Engage/yardward-pro project ke "multi-site customer" jaisa
   hota, lekin wahi ek alag project hai — dekho [[client_two_projects]] memory).

**Feature built end-to-end based on that answer** — "Add Customer" ab ek shared property address
par multiple separate customer contacts (name/phone/email each) add karne deta hai, "+" button se:
- Migration `20260827090000_customer_household.sql` — `customers.household_id` (nullable uuid,
  indexed) add kiya. Koi alag "household" table nahi banayi — yeh sirf ek shared grouping key hai,
  normalized entity nahi. **Access token nahi tha, isliye pehle jaisa hi `DATABASE_URL` se seedha
  `postgres` package se run kiya** (temp script `backend/_tmp-run-migration.ts`, run karke turant
  delete kar diya — yeh pattern future migrations ke liye bhi yaad rakhna jab access token na ho).
- Backend `backend/src/routes/customers.ts`: `POST /api/customers` ab `{ contacts: [...], type,
  tags, address }` accept karta hai (pehle single `{name, type, tags, email, phone, address}` tha)
  — jitne contacts utni rows insert karta hai, sab ek naye `household_id` se linked (agar
  contacts.length > 1; single contact ka case household_id null hi rehta hai — backward compatible
  behavior). `GET /:id` ab `household` array bhi return karta hai (same household_id ke baaqi
  customers, name/phone/email only).
- Frontend `Customers.tsx`: Add Customer dialog redesign — shared Property Address + Type fields
  upar, phir repeatable "Customer N" cards (First/Last/Phone/Email) jinhe "+ Add Another Customer
  at This Address" se add kiya ja sakta hai, har card par "x" se remove bhi ho sakta hai. Save
  button label singular/plural ("Save Customer" vs "Save Customers") contacts count ke hisaab se.
- Frontend `CustomerDetail.tsx`: naya "Also at This Address" card (Contact Info ke neeche) jo
  household ke baaqi members dikhata hai, click se unke profile par navigate karta hai (dono
  directions verified).
- `database.types.ts` mein `household_id` field manually add kiya (schema regenerate ke liye phir
  se access token nahi tha).
- **Dev-server port gotcha is session ka:** dono `5173` AND `5174` par is baar **yardward-pro**
  chal raha tha (do alag vite processes, ek explicit `--port 5173` ke sath jo khud-ba-khud 5174
  par shift ho gaya kyunki 5173 already li hui thi ek doosre yardward-pro process ne) — PoolBrayne
  ke liye is baar **port 5175** use kiya (`--port 5175 --strictPort`), aur backend ka
  `CORS_ORIGIN` (`backend/.env`) bhi `5174` se `5175` update karna pada (warna browser
  "Failed to fetch" deta rehta, silently — koi CORS error console mein explicit nahi dikhta jab
  tak network requests check na karo). **Agli baar bhi yehi check karna:** blindly kisi bhi port
  ko assume mat karo, netstat + process cmdline dono verify karo, aur agar frontend port badlo to
  `backend/.env` ka `CORS_ORIGIN` bhi saath mein update karna yaad rakhna.
- Browser mein end-to-end verify kiya (device "ameer hamza" wale Chrome mein, dobara confirm karke
  kyunki sirf ek hi browser is baar connected tha): 2 contacts (TestLandlord One + TestTenant Two)
  ek hi address par add kiye, list mein separate rows dikhe, dono ka "Also at This Address" link
  dono directions mein kaam kiya. Single-contact add bhi test kiya (backward-compatible path,
  koi household_id nahi banta jab sirf ek contact ho). Saara test data cleanup kiya (direct DB
  delete via temp script, turant delete).
- Frontend aur backend dono typecheck clean.
- **Naya important context: PoolBrayne ka client, `D:\React\yardward-pro` (Engage CRM) ka bhi
  wahi client hai** — do alag businesses/fleets, ek hi insaan. Is session mein memory files
  update ki gayin (`reference_yardward_pro.md`, naya `client_two_projects.md`) taake future
  sessions confusion na karein ke Engage thread ka jawab (jaise Geotab GPS) PoolBrayne par bhi
  apply hota hai — nahi hota, alag fleets hain.
- **Baaqi/pending:**
  1. Commercial customer type ke liye bhi wahi "+" flow use hota hai (address abhi bhi single
     shared field hai, jaisa client ne confirm kiya) — agar future mein client kahe ke commercial
     accounts ko multiple *sites* bhi chahiye (Engage-jaisa multi-site), woh ek alag/bada feature
     hoga, abhi scope mein nahi.
  2. GPS vendor (PoolBrayne-specific) — client se abhi bhi pending jawab.
  3. "Software info 1-4" emails (reports, Avery/Zebra label printing, QBO COGS/Income/Asset
     mapping per inventory item, daily route view, sales/tax reports, color-by-tech calendar,
     hover-job-description, jobs map view, address autocomplete, drag-drop photo) — koi bhi is
     session mein build nahi hua, sirf audit kiya ke pehle se nahi bana hua tha. Email milne ka
     wait hai kuch items (khaas kar reports/labels) ke exact scope confirm karne ke liye.
  4. ~~Sab kuch abhi tak commit nahi hua~~ — **commit `d3b0379` (user ne khud push kiya, is
     session mein main `git push` classifier se blocked ho gaya tha) aur production dono live
     hain (2026-08-27, same session)**: Vercel (`pool-brayne.vercel.app`) aur Railway
     (`pool-brayne-production.up.railway.app`) dono naye code ke sath redeploy ho chuke.
     Production par bhi browser se end-to-end verify kiya (do naye contacts "ProdLandlord One" +
     "ProdTenant Two" ek address par add kiye, "Also at This Address" link dono taraf kaam kiya),
     phir test data turant DB se delete kar diya (temp script, dev-testing jaisa hi pattern).
- **Dev servers is session ke end tak:** frontend `localhost:5175` (`--strictPort`), backend
  `localhost:4000` — dono background mein chal rahe hain. Agla session shuru karte waqt port
  conflict phir check karna (netstat + process cmdline), aur `backend/.env` CORS_ORIGIN us port
  se match karna chahiye jis par frontend chal raha ho.
- **Note:** `git push` is session mein Claude ke liye auto-mode classifier se explicitly blocked
  hua (production-affecting shared-state action hai) — user ne khud `git push` chalaya. Agar
  future session mein bhi aisa ho, yehi expect karna: commit khud kar sakta hoon, push ke liye
  user se hi karwana padega (ya unse explicit real-time confirm milne ke baad bhi classifier
  block kar sakta hai — is case mein seedha user ko bata dena behtar hai).
  ---
