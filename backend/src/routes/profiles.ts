import type { FastifyInstance } from "fastify";
import { withTenantContext } from "../db.js";

export default async function profilesRoutes(app: FastifyInstance) {
  app.get("/", async (req) => {
    return withTenantContext(req.userId, (tx) => tx`select * from profiles order by name`);
  });

  app.patch<{ Params: { id: string }; Body: { employmentType: "Employee" | "Contractor" } }>("/:id/employment-type", async (req) => {
    const { id } = req.params;
    const { employmentType } = req.body;
    return withTenantContext(req.userId, async (tx) => {
      const [row] = await tx`update profiles set employment_type = ${employmentType} where id = ${id} returning *`;
      return row;
    });
  });
}
