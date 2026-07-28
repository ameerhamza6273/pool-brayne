// One-time / re-runnable seed script: loads the realistic mock data from src/lib/data.ts into the
// live Supabase project for a single demo tenant, so the app shows real data once pages are
// migrated off the mock arrays. Uses the service-role key (bypasses RLS) — never run this against
// a real customer's production data.
//
// Usage: SUPABASE_SERVICE_ROLE_KEY=... VITE_SUPABASE_URL=... npx tsx scripts/seed-supabase.ts
// (or just `npx tsx scripts/seed-supabase.ts` if .env already has both — this script loads .env itself)

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import * as data from "../src/lib/data";

config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const OWNER_EMAIL = "bryan@poolbrayne.com";
const DEMO_PASSWORD = "PoolBrayne2026!";

const roleMap: Record<string, string> = {
  Owner: "owner",
  Manager: "manager",
  Technician: "technician",
  Contractor: "contractor",
  "Office Manager": "office_manager",
};

async function getOrCreateTenant(): Promise<string> {
  const { data: existing } = await supabase.from("profiles").select("tenant_id").eq("email", OWNER_EMAIL).maybeSingle();
  if (existing) return existing.tenant_id;

  const { data: created, error } = await supabase.auth.admin.createUser({
    email: OWNER_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: "Bryan", company_name: "Bryan's Pool Co" },
  });
  if (error || !created.user) throw error ?? new Error("Failed to create owner user");

  const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", created.user.id).single();
  return profile!.tenant_id;
}

async function seedStaff(tenantId: string): Promise<Record<string, string>> {
  const profileIdByName: Record<string, string> = {};

  for (const emp of data.employees) {
    const { data: existingProfile } = await supabase.from("profiles").select("id").eq("email", emp.email).maybeSingle();
    if (existingProfile) {
      profileIdByName[emp.name] = existingProfile.id;
      continue;
    }
    if (emp.email === OWNER_EMAIL) continue; // created in getOrCreateTenant

    const { data: created, error } = await supabase.auth.admin.createUser({
      email: emp.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: {
        full_name: emp.name,
        existing_tenant_id: tenantId,
        role: roleMap[emp.role] ?? "technician",
      },
    });
    if (error || !created.user) throw error ?? new Error(`Failed to create ${emp.name}`);
    profileIdByName[emp.name] = created.user.id;
  }

  // Owner profile id (created before this function ran)
  const { data: ownerProfile } = await supabase.from("profiles").select("id").eq("email", OWNER_EMAIL).single();
  profileIdByName["Bryan"] = ownerProfile!.id;

  // Layer on hourly_rate/salary + dispatch status from employees + technicians
  for (const emp of data.employees) {
    const id = profileIdByName[emp.name];
    if (!id) continue;
    await supabase.from("profiles").update({ hourly_rate: emp.hourlyRate || null, salary: emp.salary || null }).eq("id", id);
  }
  for (const tech of data.technicians) {
    const id = profileIdByName[tech.name];
    if (!id) continue;
    await supabase.from("profiles").update({ status: tech.status }).eq("id", id);
  }

  return profileIdByName;
}

async function seedCustomers(tenantId: string): Promise<Record<string, string>> {
  const idMap: Record<string, string> = {};
  for (const c of data.customers) {
    const { data: row, error } = await supabase
      .from("customers")
      .insert({
        tenant_id: tenantId,
        name: c.name,
        type: c.type,
        tags: c.tags,
        address: c.address,
        phone: c.phone,
        email: c.email,
        last_service: c.lastService || null,
        lifetime_value: c.lifetimeValue,
        customer_since: c.customerSince || null,
        last_contact: c.lastContact || null,
        equipment: c.equipment ?? {},
        gate_codes: (c as { gateCodes?: unknown }).gateCodes ?? {},
      })
      .select("id")
      .single();
    if (error) throw error;
    idMap[c.id] = row.id;
  }

  for (const [mockCustomerId, notes] of Object.entries(data.customerNotes)) {
    for (const n of notes) {
      await supabase.from("customer_notes").insert({
        tenant_id: tenantId,
        customer_id: idMap[mockCustomerId],
        text: n.text,
        author: n.author,
        created_at: n.date,
      });
    }
  }

  for (const [mockCustomerId, history] of Object.entries(data.customerServiceHistory)) {
    for (const h of history) {
      await supabase.from("job_service_history").insert({
        tenant_id: tenantId,
        customer_id: idMap[mockCustomerId],
        service_date: h.date,
        type: h.type,
        tech: h.tech,
        amount: h.amount,
        status: h.status,
      });
    }
  }

  return idMap;
}

async function seedJobs(tenantId: string, customerIdMap: Record<string, string>, staffIdMap: Record<string, string>) {
  for (const j of data.jobs) {
    await supabase.from("jobs").insert({
      tenant_id: tenantId,
      customer_id: customerIdMap[j.customerId],
      type: j.type,
      address: j.address,
      tech_id: staffIdMap[j.tech] ?? null,
      status: j.status,
      stage: j.stage,
      scheduled_date: j.date,
      scheduled_time: j.time,
      amount: j.amount,
      description: j.description,
    });
  }

  for (const r of data.recurringRoutes) {
    await supabase.from("recurring_routes").insert({
      tenant_id: tenantId,
      name: r.name,
      frequency: r.frequency,
      day: r.day,
      tech_id: staffIdMap[r.tech] ?? null,
      customer_count: r.customers,
      avg_time: r.avgTime,
    });
  }
}

async function seedInventory(tenantId: string) {
  const locationIds: Record<string, string> = {};
  for (const name of ["Store", "Van 1", "Van 2", "Van 3"]) {
    const { data: row, error } = await supabase
      .from("inventory_locations")
      .insert({ tenant_id: tenantId, name, type: name === "Store" ? "store" : "vehicle" })
      .select("id")
      .single();
    if (error) throw error;
    locationIds[name] = row.id;
  }

  const posBySku = new Map(data.posProducts.map((p) => [p.sku, p]));
  const itemIdMap: Record<string, string> = {};
  for (const inv of data.inventory) {
    const pos = posBySku.get(inv.sku);
    const { data: row, error } = await supabase
      .from("inventory_items")
      .insert({
        tenant_id: tenantId,
        name: inv.name,
        sku: inv.sku,
        category: inv.category,
        reorder_threshold: inv.reorder,
        unit_cost: inv.unitCost,
        price: pos?.price ?? null,
        taxable: pos?.taxable ?? true,
        unit: pos?.unit ?? "ea",
        pos_enabled: !!pos,
      })
      .select("id")
      .single();
    if (error) throw error;
    itemIdMap[inv.id] = row.id;

    await supabase.from("inventory_stock").insert([
      { tenant_id: tenantId, item_id: row.id, location_id: locationIds["Store"], quantity: inv.storeQty },
      { tenant_id: tenantId, item_id: row.id, location_id: locationIds["Van 1"], quantity: inv.v1Qty },
      { tenant_id: tenantId, item_id: row.id, location_id: locationIds["Van 2"], quantity: inv.v2Qty },
      { tenant_id: tenantId, item_id: row.id, location_id: locationIds["Van 3"], quantity: inv.v3Qty },
    ]);
  }

  const invSkus = new Set(data.inventory.map((i) => i.sku));
  for (const pos of data.posProducts) {
    if (invSkus.has(pos.sku)) continue;
    await supabase.from("inventory_items").insert({
      tenant_id: tenantId,
      name: pos.name,
      sku: pos.sku,
      category: pos.category,
      reorder_threshold: 0,
      unit_cost: pos.cost,
      price: pos.price,
      taxable: pos.taxable,
      unit: pos.unit,
      pos_enabled: true,
    });
  }

  const supplierIdMap: Record<string, string> = {};
  for (const s of data.suppliers) {
    const { data: row, error } = await supabase
      .from("suppliers")
      .insert({ tenant_id: tenantId, name: s.name, contact: s.contact, phone: s.phone, lead_time: s.leadTime })
      .select("id")
      .single();
    if (error) throw error;
    supplierIdMap[s.id] = row.id;
  }

  for (const po of data.purchaseOrders) {
    const supplier = data.suppliers.find((s) => s.name === po.supplier);
    await supabase.from("purchase_orders").insert({
      tenant_id: tenantId,
      number: po.number,
      supplier_id: supplier ? supplierIdMap[supplier.id] : null,
      status: po.status,
      total: po.total,
      item_count: po.items,
      order_date: po.date,
      received_date: po.receivedDate,
    });
  }

  for (const v of data.varianceData) {
    const inv = data.inventory.find((i) => i.name === v.product);
    if (!inv) continue;
    await supabase.from("inventory_variance").insert({
      tenant_id: tenantId,
      item_id: itemIdMap[inv.id],
      expected: v.expected,
      actual: v.actual,
      variance_pct: v.variance,
      flagged: v.flagged,
    });
  }
}

async function seedFleet(tenantId: string, staffIdMap: Record<string, string>) {
  const vehicleIdMap: Record<string, string> = {};
  for (const v of data.vehicles) {
    const { data: row, error } = await supabase
      .from("vehicles")
      .insert({
        tenant_id: tenantId,
        name: v.name,
        number: v.number,
        tech_id: staffIdMap[v.tech] ?? null,
        status: v.status,
        location_label: v.location,
        speed: v.speed,
        mileage_today: v.mileage,
      })
      .select("id")
      .single();
    if (error) throw error;
    vehicleIdMap[v.id] = row.id;
  }

  const today = new Date().toISOString().slice(0, 10);
  const toTimestamp = (label: string) => new Date(`${today} ${label}`).toISOString();

  for (const t of data.tripHistory) {
    const vehicle = data.vehicles.find((v) => v.number === t.vehicle);
    if (!vehicle) continue;
    await supabase.from("trip_history").insert({
      tenant_id: tenantId,
      vehicle_id: vehicleIdMap[vehicle.id],
      start_time: toTimestamp(t.start),
      end_time: toTimestamp(t.end),
      start_location: t.startLoc,
      end_location: t.endLoc,
      distance_miles: t.distance,
      duration_minutes: parseInt(t.duration, 10) || null,
    });
  }

  for (const g of data.geofenceAlerts) {
    const vehicle = data.vehicles.find((v) => v.number === g.vehicle);
    if (!vehicle) continue;
    await supabase.from("geofence_alerts").insert({
      tenant_id: tenantId,
      vehicle_id: vehicleIdMap[vehicle.id],
      message: g.message,
      severity: g.severity,
      occurred_at: toTimestamp(g.time),
    });
  }
}

async function seedTimesheets(tenantId: string, staffIdMap: Record<string, string>) {
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
  const weekStartStr = weekStart.toISOString().slice(0, 10);

  for (const ts of data.timesheetData) {
    const employeeId = staffIdMap[ts.name];
    if (!employeeId) continue;
    await supabase.from("timesheets").insert({
      tenant_id: tenantId,
      employee_id: employeeId,
      week_start: weekStartStr,
      mon: ts.mon,
      tue: ts.tue,
      wed: ts.wed,
      thu: ts.thu,
      fri: ts.fri,
      sat: ts.sat,
      sun: ts.sun,
      overtime_hours: ts.ot,
      status: ts.status,
    });
  }

  for (const jc of data.jobCosting) {
    await supabase.from("job_costing").insert({
      tenant_id: tenantId,
      tech_id: staffIdMap[jc.tech] ?? null,
      job_label: jc.job,
      hours: jc.hours,
      labor_cost: jc.laborCost,
      cost_date: jc.date,
    });
  }
}

async function seedInvoicing(tenantId: string, customerIdMap: Record<string, string>) {
  const invoiceIdMap: Record<string, string> = {};
  for (const inv of data.invoices) {
    const { data: row, error } = await supabase
      .from("invoices")
      .insert({
        tenant_id: tenantId,
        customer_id: customerIdMap[inv.customerId],
        number: inv.number,
        issue_date: inv.issueDate,
        due_date: inv.dueDate,
        amount: inv.amount,
        status: inv.status,
        paid_date: inv.paidDate,
        payment_method: inv.method,
      })
      .select("id")
      .single();
    if (error) throw error;
    invoiceIdMap[inv.id] = row.id;
  }

  for (const [mockInvoiceId, items] of Object.entries(data.invoiceLineItems)) {
    for (const li of items) {
      await supabase.from("invoice_line_items").insert({
        tenant_id: tenantId,
        invoice_id: invoiceIdMap[mockInvoiceId],
        description: li.description,
        quantity: li.quantity,
        rate: li.rate,
        amount: li.amount,
      });
    }
  }

  for (const rb of data.recurringBilling) {
    const customer = data.customers.find((c) => c.name === rb.customer);
    await supabase.from("recurring_billing").insert({
      tenant_id: tenantId,
      customer_id: customer ? customerIdMap[customer.id] : null,
      frequency: rb.frequency,
      amount: rb.amount,
      next_charge: rb.nextCharge,
      status: rb.status,
    });
  }

  for (const p of data.payments) {
    const invoice = data.invoices.find((i) => i.number === p.invoice);
    await supabase.from("payments").insert({
      tenant_id: tenantId,
      invoice_id: invoice ? invoiceIdMap[invoice.id] : null,
      customer_id: invoice ? customerIdMap[invoice.customerId] : null,
      amount: p.amount,
      paid_at: p.date,
      method: p.method,
      status: p.status,
    });
  }
}

async function seedCampaigns(tenantId: string, customerIdMap: Record<string, string>) {
  for (const a of data.automations) {
    await supabase.from("automations").insert({
      tenant_id: tenantId,
      name: a.name,
      description: a.description,
      trigger_label: a.trigger,
      channel: a.channel,
      enrolled_count: a.enrolled,
      conversion_rate: a.conversions,
      active: a.active,
      icon: a.icon,
    });
  }

  for (const c of data.seasonalCampaigns) {
    await supabase.from("seasonal_campaigns").insert({
      tenant_id: tenantId,
      name: c.name,
      status: c.status,
      audience_size: c.audience,
      scheduled_date: c.scheduledDate,
      sent_date: c.sentDate,
      open_rate: c.openRate,
      reply_rate: c.replyRate,
      bookings: c.bookings,
      revenue: c.revenue,
    });
  }

  for (const conv of data.smsConversations) {
    const { data: row, error } = await supabase
      .from("sms_conversations")
      .insert({
        tenant_id: tenantId,
        customer_id: customerIdMap[conv.customerId],
        unread_count: conv.unread,
      })
      .select("id")
      .single();
    if (error) throw error;
    for (const m of conv.messages) {
      await supabase.from("sms_messages").insert({
        tenant_id: tenantId,
        conversation_id: row.id,
        sender: m.from,
        body: m.text,
        sent_at: new Date(m.time).toISOString(),
      });
    }
  }

  for (const r of data.reviews) {
    const customer = data.customers.find((c) => c.name === r.customer);
    await supabase.from("reviews").insert({
      tenant_id: tenantId,
      customer_id: customer ? customerIdMap[customer.id] : null,
      platform: r.platform,
      rating: r.rating,
      body: r.text,
      review_date: r.date,
      response: r.response,
    });
  }
}

async function seedSettings(tenantId: string) {
  for (const i of data.integrations) {
    await supabase.from("integrations").insert({
      tenant_id: tenantId,
      name: i.name,
      status: i.status,
      description: i.description,
      icon: i.icon,
    });
  }

  for (const b of data.billingHistory) {
    await supabase.from("billing_history").insert({
      tenant_id: tenantId,
      billed_date: b.date,
      description: b.description,
      amount: b.amount,
      status: b.status,
    });
  }
}

async function main() {
  console.log("Resolving demo tenant...");
  const tenantId = await getOrCreateTenant();
  console.log(`Tenant: ${tenantId}`);

  console.log("Seeding staff...");
  const staffIdMap = await seedStaff(tenantId);

  console.log("Seeding customers...");
  const customerIdMap = await seedCustomers(tenantId);

  console.log("Seeding jobs & routes...");
  await seedJobs(tenantId, customerIdMap, staffIdMap);

  console.log("Seeding inventory...");
  await seedInventory(tenantId);

  console.log("Seeding fleet...");
  await seedFleet(tenantId, staffIdMap);

  console.log("Seeding timesheets & job costing...");
  await seedTimesheets(tenantId, staffIdMap);

  console.log("Seeding invoicing...");
  await seedInvoicing(tenantId, customerIdMap);

  console.log("Seeding campaigns...");
  await seedCampaigns(tenantId, customerIdMap);

  console.log("Seeding settings...");
  await seedSettings(tenantId);

  console.log("Done. Demo login: bryan@poolbrayne.com / PoolBrayne2026!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
