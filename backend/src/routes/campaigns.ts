import type { FastifyInstance } from "fastify";
import { withTenantContext } from "../db.js";

export default async function campaignsRoutes(app: FastifyInstance) {
  app.get("/", async (req) => {
    return withTenantContext(req.userId, async (tx) => {
      const [automations, seasonalCampaigns, smsConversations, smsMessages, reviews] = await Promise.all([
        tx`select * from automations order by name`,
        tx`select * from seasonal_campaigns order by scheduled_date`,
        tx`select sc.*, jsonb_build_object('name', c.name) as customers
           from sms_conversations sc left join customers c on c.id = sc.customer_id
           order by sc.updated_at desc`,
        tx`select * from sms_messages order by sent_at`,
        tx`select r.*, jsonb_build_object('name', c.name) as customers
           from reviews r left join customers c on c.id = r.customer_id
           order by r.review_date desc`,
      ]);
      return { automations, seasonalCampaigns, smsConversations, smsMessages, reviews };
    });
  });

  app.post<{ Body: { name: string; audience: number } }>("/seasonal", async (req) => {
    const { name, audience } = req.body;
    return withTenantContext(req.userId, async (tx) => {
      const [tenant] = await tx`select current_tenant_id() as id`;
      const [row] = await tx`
        insert into seasonal_campaigns (tenant_id, name, audience_size, status)
        values (${tenant.id}, ${name}, ${audience}, 'Draft')
        returning *
      `;
      return row;
    });
  });

  app.post<{ Body: { conversationId: string; body: string } }>("/sms/reply", async (req) => {
    const { conversationId, body } = req.body;
    return withTenantContext(req.userId, async (tx) => {
      const [tenant] = await tx`select current_tenant_id() as id`;
      const [row] = await tx`
        insert into sms_messages (tenant_id, conversation_id, sender, body)
        values (${tenant.id}, ${conversationId}, 'business', ${body})
        returning *
      `;
      return row;
    });
  });
}
