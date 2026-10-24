import type { FastifyInstance } from "fastify";
import { withTenantContext } from "../db.js";

export default async function campaignsRoutes(app: FastifyInstance) {
  // QA sweep 2026-09-30: automations, sms_conversations/messages, and reviews have NO real creation path anywhere in this app (nothing below inserts into
  app.get("/", async (req) => {
    return withTenantContext(req.userId, async (tx) => {
      const seasonalCampaigns = await tx`select * from seasonal_campaigns where sent_date is null order by scheduled_date`;
      return { automations: [], seasonalCampaigns, smsConversations: [], smsMessages: [], reviews: [] };
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
