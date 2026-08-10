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
        tx`select name, plan_id from tenants where id = current_tenant_id() limit 1`,
      ]);
      const tenant = tenantRows[0] as { name: string; plan_id: string | null } | undefined;
      return {
        teamMembers,
        integrations,
        subscriptionPlans,
        billingHistory,
        tenantName: tenant?.name ?? "",
        planId: tenant?.plan_id ?? null,
      };
    });
  });

  app.patch<{ Body: { name: string } }>("/company", async (req) => {
    const { name } = req.body;
    return withTenantContext(req.userId, (tx) => tx`update tenants set name = ${name} where id = current_tenant_id() returning *`);
  });

  app.patch<{ Body: { planId: string } }>("/plan", async (req) => {
    const { planId } = req.body;
    return withTenantContext(req.userId, (tx) => tx`update tenants set plan_id = ${planId} where id = current_tenant_id() returning *`);
  });
}
