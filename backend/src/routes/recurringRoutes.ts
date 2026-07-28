import type { FastifyInstance } from "fastify";
import { withTenantContext } from "../db.js";

export default async function recurringRoutesRoutes(app: FastifyInstance) {
  app.get("/", async (req) => {
    return withTenantContext(req.userId, (tx) => tx`
      select rr.*, jsonb_build_object('name', p.name) as profiles
      from recurring_routes rr
      left join profiles p on p.id = rr.tech_id
    `);
  });
}
