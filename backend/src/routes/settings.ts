import type { FastifyInstance } from "fastify";
import { withTenantContext } from "../db.js";

type ConfigListRow = { item_id: string; label: string; color: string | null; sort_order: number };

// Client PDF 2026-09-18: same defaults the old src/lib/data.ts static arrays had, minus the
// requested Job Types edits (Weekly Maintenance + In Store Repair added, "New Build" dropped
// from the Install label). Used only to lazily seed a tenant's row the first time each list is
// requested — after that, Settings CRUD is the source of truth.
const CONFIG_LIST_DEFAULTS: Record<string, { id: string; label: string; color?: string }[]> = {
  job_types: [
    { id: "maintenance", label: "Maintenance", color: "#0891B2" },
    { id: "weekly_maintenance", label: "Weekly Maintenance", color: "#0E7490" },
    { id: "repair", label: "Repair", color: "#F59E0B" },
    { id: "in_store_repair", label: "In Store Repair", color: "#D97706" },
    { id: "install", label: "Install", color: "#8B5CF6" },
    { id: "open_close", label: "Pool Open / Close", color: "#0E7490" },
    { id: "inspection", label: "Inspection", color: "#F97316" },
    { id: "estimate", label: "Estimate / Quote", color: "#6366F1" },
    { id: "consultation", label: "Consultation", color: "#EC4899" },
    { id: "equipment", label: "Equipment Service", color: "#14B8A6" },
    { id: "renovation", label: "Renovation / Remodel", color: "#D97706" },
  ],
  job_statuses: [
    { id: "new", label: "New", color: "#6366F1" },
    { id: "scheduled", label: "Scheduled", color: "#0891B2" },
    { id: "assigned", label: "Assigned", color: "#0E7490" },
    { id: "en_route", label: "En Route", color: "#F59E0B" },
    { id: "on_site", label: "On Site", color: "#F97316" },
    { id: "in_progress", label: "In Progress", color: "#3B82F6" },
    { id: "parts_ordered", label: "Parts Ordered", color: "#A855F7" },
    { id: "on_hold", label: "On Hold", color: "#D97706" },
    { id: "completed", label: "Completed", color: "#16A34A" },
    { id: "invoiced", label: "Invoiced", color: "#0E7490" },
    { id: "paid", label: "Paid", color: "#15803D" },
    { id: "cancelled", label: "Cancelled", color: "#DC2626" },
    { id: "rescheduled", label: "Rescheduled", color: "#F59E0B" },
    { id: "no_answer", label: "No Answer / Customer Not Available", color: "#EF4444" },
    { id: "callback", label: "Needs Callback", color: "#EC4899" },
    { id: "written_off", label: "Written Off", color: "#64748B" },
  ],
  estimate_statuses: [
    { id: "draft", label: "Draft", color: "#64748B" },
    { id: "pending_review", label: "Pending Review", color: "#F59E0B" },
    { id: "sent", label: "Sent to Customer", color: "#0891B2" },
    { id: "viewed", label: "Viewed", color: "#0E7490" },
    { id: "accepted", label: "Accepted", color: "#16A34A" },
    { id: "declined", label: "Declined", color: "#DC2626" },
  ],
  call_types: [
    { id: "inbound_customer_call", label: "Inbound — Customer Call" },
    { id: "outbound_sales_call", label: "Outbound — Sales Call" },
    { id: "outbound_service_follow_up", label: "Outbound — Service Follow-up" },
    { id: "outbound_collection_call", label: "Outbound — Collection Call" },
    { id: "inbound_estimate_request", label: "Inbound — Estimate Request" },
    { id: "inbound_complaint", label: "Inbound — Complaint" },
    { id: "referral_call", label: "Referral Call" },
  ],
  call_sources: [
    { id: "website", label: "Website" },
    { id: "google_ads", label: "Google Ads" },
    { id: "referral_existing_customer", label: "Referral — Existing Customer" },
    { id: "yelp", label: "Yelp" },
    { id: "angi_homeadvisor", label: "Angi / HomeAdvisor" },
    { id: "facebook", label: "Facebook" },
    { id: "repeat_customer", label: "Repeat Customer" },
    { id: "drive_by_signage", label: "Drive-by / Signage" },
  ],
  reschedule_types: [
    { id: "customer_request", label: "Customer Request" },
    { id: "weather", label: "Weather" },
    { id: "technician_unavailable", label: "Technician Unavailable" },
    { id: "parts_delay", label: "Parts Delay" },
    { id: "customer_not_home", label: "Customer Not Home" },
    { id: "company_error_missed_schedule", label: "Company Error — Missed Schedule" },
  ],
  cancellation_reasons: [
    { id: "called_on_call_ahead_cancelled", label: "Called on call ahead — customer cancelled" },
    { id: "customer_cancelled_at_door", label: "Customer cancelled at door" },
    { id: "customer_not_home", label: "Customer not home / not available" },
    { id: "weather_rain_storm", label: "Weather — rain / storm" },
    { id: "equipment_failure_truck_breakdown", label: "Equipment failure / truck breakdown" },
    { id: "parts_not_delivered", label: "Parts not delivered" },
    { id: "customer_rescheduled", label: "Customer rescheduled" },
    { id: "duplicate_job", label: "Duplicate job / already serviced" },
    { id: "customer_moved_cancelled_account", label: "Customer moved / cancelled account" },
  ],
  // Client SMS 2026-09-21: the reminder "Label" was free text; they want a dropdown of labels they
  // can add to (Filter cleaning, Salt cell cleaning, Sand change, Anode replacement, etc.).
  reminder_types: [
    { id: "filter_cleaning", label: "Filter Cleaning" },
    { id: "salt_cell_cleaning", label: "Salt Cell Cleaning" },
    { id: "sand_change", label: "Sand Change" },
    { id: "anode_replacement", label: "Anode Replacement" },
  ],
  // Client SMS 2026-09-21: Library Category/Manufacturer lists and the Inventory Manufacturer list became
  // importable/exportable (Data > Import / Export), so they live in the DB instead of static arrays.
  // Library ones start with the client's own fixed lists (same as src/lib/data.ts); inventory manufacturers
  // start empty (the Manufacture List page is derived from the catalog; imported names are added on top).
  library_categories: [
    "Electrical", "Miscellaneous", "Infloor Cleaner", "Automation", "Salt System", "Cleaners",
    "Water Feature / Landscape", "Acid Feeder", "Chlorinator / Feeder", "Ozinator / UV",
    "Pumps / Motors", "Heater / Heat Pump", "Lights", "Warranty / Serial Number", "Timer / Freeze Guard",
  ].map((label) => ({ id: slugify(label), label })),
  library_manufacturers: ["Jandy", "Solaxx", "Raypak", "Century", "Pentair", "Intermatic"].map((label) => ({ id: slugify(label), label })),
  inventory_manufacturers: [],
};

function slugify(label: string): string {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "item";
}

export default async function settingsRoutes(app: FastifyInstance) {
  app.get("/config-lists", async (req) => {
    return withTenantContext(req.userId, async (tx) => {
      const result: Record<string, { id: string; label: string; color: string | null }[]> = {};
      for (const key of Object.keys(CONFIG_LIST_DEFAULTS)) {
        let rows = (await tx`
          select item_id, label, color, sort_order from tenant_config_lists
          where list_key = ${key} order by sort_order, label
        `) as unknown as ConfigListRow[];
        if (rows.length === 0) {
          const defaults = CONFIG_LIST_DEFAULTS[key];
          await Promise.all(defaults.map((d, i) => tx`
            insert into tenant_config_lists (tenant_id, list_key, item_id, label, color, sort_order)
            values (current_tenant_id(), ${key}, ${d.id}, ${d.label}, ${d.color ?? null}, ${i})
            on conflict (tenant_id, list_key, item_id) do nothing
          `));
          rows = defaults.map((d, i) => ({ item_id: d.id, label: d.label, color: d.color ?? null, sort_order: i }));
        }
        result[key] = rows.map((r) => ({ id: r.item_id, label: r.label, color: r.color }));
      }
      return result;
    });
  });

  app.post<{ Params: { key: string }; Body: { label: string; color?: string } }>(
    "/config-lists/:key",
    async (req, reply) => {
      const { key } = req.params;
      if (!CONFIG_LIST_DEFAULTS[key]) return reply.code(400).send({ error: "Unknown list" });
      const { label, color } = req.body;
      const itemId = slugify(label);
      return withTenantContext(req.userId, async (tx) => {
        const [{ next }] = (await tx`
          select coalesce(max(sort_order), -1) + 1 as next from tenant_config_lists
          where list_key = ${key}
        `) as unknown as { next: number }[];
        const rows = (await tx`
          insert into tenant_config_lists (tenant_id, list_key, item_id, label, color, sort_order)
          values (current_tenant_id(), ${key}, ${itemId}, ${label}, ${color ?? null}, ${next})
          on conflict (tenant_id, list_key, item_id) do update set label = excluded.label, color = excluded.color
          returning item_id, label, color
        `) as unknown as { item_id: string; label: string; color: string | null }[];
        return { id: rows[0].item_id, label: rows[0].label, color: rows[0].color };
      });
    },
  );

  // Client SMS 2026-09-21: every Job Settings list needs an Edit button. Rename/recolor keeps the
  // item's id (slug) stable. Job types are the only list whose label is stored as text on real
  // rows, so a rename there is cascaded so existing jobs/recurring jobs/forms don't get orphaned.
  app.patch<{ Params: { key: string; itemId: string }; Body: { label?: string; color?: string | null } }>(
    "/config-lists/:key/:itemId",
    async (req, reply) => {
      const { key, itemId } = req.params;
      if (!CONFIG_LIST_DEFAULTS[key]) return reply.code(400).send({ error: "Unknown list" });
      const newLabel = req.body.label?.trim();
      if (req.body.label !== undefined && !newLabel) return reply.code(400).send({ error: "Label can't be empty" });
      return withTenantContext(req.userId, async (tx) => {
        const [existing] = (await tx`
          select label, color from tenant_config_lists where list_key = ${key} and item_id = ${itemId}
        `) as unknown as { label: string; color: string | null }[];
        if (!existing) return reply.code(404).send({ error: "Item not found" });
        const label = newLabel ?? existing.label;
        const color = req.body.color !== undefined ? req.body.color : existing.color;
        await tx`
          update tenant_config_lists set label = ${label}, color = ${color}
          where list_key = ${key} and item_id = ${itemId}
        `;
        if (key === "job_types" && label !== existing.label) {
          await tx`update jobs set type = ${label} where type = ${existing.label}`;
          await tx`update recurring_jobs set job_type = ${label} where job_type = ${existing.label}`;
          await tx`update form_templates set applies_to = ${label} where applies_to = ${existing.label}`;
        }
        // Reminder labels are stored as text on each customer reminder.
        if (key === "reminder_types" && label !== existing.label) {
          await tx`update customer_reminders set label = ${label} where label = ${existing.label}`;
        }
        return { id: itemId, label, color };
      });
    },
  );

  app.delete<{ Params: { key: string; itemId: string } }>("/config-lists/:key/:itemId", async (req) => {
    const { key, itemId } = req.params;
    return withTenantContext(req.userId, (tx) => tx`
      delete from tenant_config_lists where list_key = ${key} and item_id = ${itemId}
    `);
  });
  app.get("/", async (req) => {
    return withTenantContext(req.userId, async (tx) => {
      const [teamMembers, integrations, subscriptionPlans, billingHistory, tenantRows] = await Promise.all([
        tx`select * from profiles order by name`,
        tx`select id, tenant_id, name, status, description, icon, provider from integrations order by name`,
        tx`select * from subscription_plans order by price`,
        tx`select * from billing_history order by billed_date desc`,
        tx`select name, plan_id, phone, address, city, state, zip, invoice_business_name, payroll_week_start_day from tenants where id = current_tenant_id() limit 1`,
      ]);
      const tenant = tenantRows[0] as {
        name: string; plan_id: string | null; phone: string | null; address: string | null;
        city: string | null; state: string | null; zip: string | null;
        invoice_business_name: string | null; payroll_week_start_day: number;
      } | undefined;
      return {
        teamMembers,
        integrations,
        subscriptionPlans,
        billingHistory,
        tenantName: tenant?.name ?? "",
        planId: tenant?.plan_id ?? null,
        phone: tenant?.phone ?? "",
        address: tenant?.address ?? "",
        city: tenant?.city ?? "",
        state: tenant?.state ?? "",
        zip: tenant?.zip ?? "",
        invoiceBusinessName: tenant?.invoice_business_name ?? "",
        payrollWeekStartDay: tenant?.payroll_week_start_day ?? 1,
      };
    });
  });

  app.patch<{ Body: { name: string; phone: string; address: string; city: string; state: string; zip: string; invoiceBusinessName: string } }>(
    "/company",
    async (req) => {
      const { name, phone, address, city, state, zip, invoiceBusinessName } = req.body;
      return withTenantContext(req.userId, (tx) => tx`
        update tenants
        set name = ${name}, phone = ${phone}, address = ${address}, city = ${city}, state = ${state}, zip = ${zip},
            invoice_business_name = ${invoiceBusinessName}
        where id = current_tenant_id() returning *
      `);
    },
  );

  // Client request 2026-09-02: "Allow us to change the first day of the week when running
  // payroll" (they run Wed-Tue) — Timesheets computes its week_start from this instead of
  // always assuming Monday.
  app.patch<{ Body: { payrollWeekStartDay: number } }>("/payroll", async (req) => {
    const { payrollWeekStartDay } = req.body;
    return withTenantContext(req.userId, (tx) => tx`
      update tenants set payroll_week_start_day = ${payrollWeekStartDay} where id = current_tenant_id() returning *
    `);
  });

  app.patch<{ Body: { planId: string } }>("/plan", async (req) => {
    const { planId } = req.body;
    return withTenantContext(req.userId, (tx) => tx`update tenants set plan_id = ${planId} where id = current_tenant_id() returning *`);
  });
}
