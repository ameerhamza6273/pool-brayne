import type { FastifyInstance } from "fastify";
import { withTenantContext } from "../db.js";

export default async function campaignsRoutes(app: FastifyInstance) {
  // QA sweep 2026-09-30: automations, sms_conversations/messages, and reviews have NO real creation
  // path anywhere in this app (nothing below inserts into automations or reviews at all; SMS has no
  // real Twilio connection to receive a customer reply from) -- every row that's ever existed in
  // these tables came from the old demo seed script (scripts/seed-supabase.ts), not a real client
  // action. They showed as "Active" campaigns, real two-way SMS threads, and real Google/Facebook
  // reviews (one even said "PoolBrayne", the internal dev codename, not the client's brand) --
  // clearly misleading if the client or a customer ever saw this page. Rather than delete that old
  // seed data outright, the safer fix is to just stop serving it until those channels are actually
  // connected: the rows stay harmlessly in place, nothing here can lie about being real activity.
  // seasonalCampaigns is a real feature (the "New Campaign" dialog below actually creates rows) --
  // only rows with a fabricated `sent_date`/stats (also only ever seeded, never really sent) are held
  // back the same way.
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
