import type { FastifyInstance } from "fastify";
import { withTenantContext } from "../db.js";

export default async function fleetRoutes(app: FastifyInstance) {
  app.get("/", async (req) => {
    return withTenantContext(req.userId, async (tx) => {
      const [vehicles, tripHistory, geofenceAlerts] = await Promise.all([
        tx`select v.*, jsonb_build_object('name', p.name) as profiles
           from vehicles v left join profiles p on p.id = v.tech_id
           order by v.name`,
        tx`select th.*, jsonb_build_object('name', v.name, 'number', v.number) as vehicles
           from trip_history th left join vehicles v on v.id = th.vehicle_id
           order by th.start_time desc`,
        tx`select ga.*, jsonb_build_object('name', v.name, 'number', v.number) as vehicles
           from geofence_alerts ga left join vehicles v on v.id = ga.vehicle_id
           order by ga.occurred_at desc`,
      ]);
      return { vehicles, tripHistory, geofenceAlerts };
    });
  });
}
