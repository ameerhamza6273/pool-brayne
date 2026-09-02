import type { FastifyInstance } from "fastify";
import { withTenantContext } from "../db.js";

export default async function settingsRoutes(app: FastifyInstance) {
  app.get("/", async (req) => {
    return withTenantContext(req.userId, async (tx) => {
      const [teamMembers, integrations, subscriptionPlans, billingHistory, tenantRows] = await Promise.all([
        tx`select * from profiles order by name`,
        tx`select id, tenant_id, name, status, description, icon, provider from integrations order by name`,
        tx`select * from subscription_plans order by price`,
        tx`select * from billing_history order by billed_date desc`,
        tx`select name, plan_id, phone, address, invoice_business_name, payroll_week_start_day from tenants where id = current_tenant_id() limit 1`,
      ]);
      const tenant = tenantRows[0] as {
        name: string; plan_id: string | null; phone: string | null; address: string | null;
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
        invoiceBusinessName: tenant?.invoice_business_name ?? "",
        payrollWeekStartDay: tenant?.payroll_week_start_day ?? 1,
      };
    });
  });

  app.patch<{ Body: { name: string; phone: string; address: string; invoiceBusinessName: string } }>("/company", async (req) => {
    const { name, phone, address, invoiceBusinessName } = req.body;
    return withTenantContext(req.userId, (tx) => tx`
      update tenants set name = ${name}, phone = ${phone}, address = ${address}, invoice_business_name = ${invoiceBusinessName}
      where id = current_tenant_id() returning *
    `);
  });

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
