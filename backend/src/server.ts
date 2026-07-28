import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { requireAuth } from "./auth.js";
import customersRoutes from "./routes/customers.js";
import jobsRoutes from "./routes/jobs.js";
import profilesRoutes from "./routes/profiles.js";
import recurringRoutesRoutes from "./routes/recurringRoutes.js";
import invoicingRoutes from "./routes/invoicing.js";
import inventoryRoutes from "./routes/inventory.js";
import posRoutes from "./routes/pos.js";
import fleetRoutes from "./routes/fleet.js";
import timesheetsRoutes from "./routes/timesheets.js";
import campaignsRoutes from "./routes/campaigns.js";
import settingsRoutes from "./routes/settings.js";
import dashboardRoutes from "./routes/dashboard.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: process.env.CORS_ORIGIN ?? true });

app.get("/health", async () => ({ ok: true }));

app.addHook("onRequest", async (req, reply) => {
  if (req.url === "/health") return;
  await requireAuth(req, reply);
});

await app.register(customersRoutes, { prefix: "/api/customers" });
await app.register(jobsRoutes, { prefix: "/api/jobs" });
await app.register(profilesRoutes, { prefix: "/api/profiles" });
await app.register(recurringRoutesRoutes, { prefix: "/api/recurring-routes" });
await app.register(invoicingRoutes, { prefix: "/api/invoices" });
await app.register(inventoryRoutes, { prefix: "/api/inventory" });
await app.register(posRoutes, { prefix: "/api/pos" });
await app.register(fleetRoutes, { prefix: "/api/fleet" });
await app.register(timesheetsRoutes, { prefix: "/api/timesheets" });
await app.register(campaignsRoutes, { prefix: "/api/campaigns" });
await app.register(settingsRoutes, { prefix: "/api/settings" });
await app.register(dashboardRoutes, { prefix: "/api/dashboard" });

const port = Number(process.env.PORT ?? 4000);
app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
