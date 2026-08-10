import type { FastifyInstance } from "fastify";
import { withTenantContext } from "../db.js";

const AUTHORIZE_URL = "https://appcenter.intuit.com/connect/oauth2";
const TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";

// Short-lived state -> userId map so the unauthenticated callback (Intuit redirects the browser
// here directly, it can't send our Authorization header) can recover which user/tenant initiated
// the connect. Entries are consumed on first use and expire after 10 minutes.
const pendingStates = new Map<string, { userId: string; createdAt: number }>();
const STATE_TTL_MS = 10 * 60 * 1000;

function cleanupExpiredStates() {
  const now = Date.now();
  for (const [state, entry] of pendingStates) {
    if (now - entry.createdAt > STATE_TTL_MS) pendingStates.delete(state);
  }
}

export default async function quickbooksRoutes(app: FastifyInstance) {
  app.get("/connect-url", async (req) => {
    cleanupExpiredStates();
    const state = crypto.randomUUID();
    pendingStates.set(state, { userId: req.userId, createdAt: Date.now() });

    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set("client_id", process.env.QBO_CLIENT_ID!);
    url.searchParams.set("redirect_uri", process.env.QBO_REDIRECT_URI!);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "com.intuit.quickbooks.accounting");
    url.searchParams.set("state", state);

    return { url: url.toString() };
  });

  // Unauthenticated: Intuit redirects the browser here directly after the user approves the
  // connection, so there is no Bearer token on this request (see the onRequest exemption in
  // server.ts). Identity is recovered from the `state` param instead.
  app.get<{ Querystring: { code?: string; state?: string; realmId?: string; error?: string } }>("/callback", async (req, reply) => {
    const frontendUrl = process.env.CORS_ORIGIN ?? "http://localhost:5174";
    const { code, state, realmId, error } = req.query;

    if (error || !code || !state || !realmId) {
      return reply.redirect(`${frontendUrl}/settings?qbo=error`);
    }

    const pending = pendingStates.get(state);
    pendingStates.delete(state);
    if (!pending) {
      return reply.redirect(`${frontendUrl}/settings?qbo=error`);
    }

    const basicAuth = Buffer.from(`${process.env.QBO_CLIENT_ID}:${process.env.QBO_CLIENT_SECRET}`).toString("base64");
    const tokenRes = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.QBO_REDIRECT_URI!,
      }),
    });

    if (!tokenRes.ok) {
      req.log.error(await tokenRes.text());
      return reply.redirect(`${frontendUrl}/settings?qbo=error`);
    }

    const tokens = (await tokenRes.json()) as { access_token: string; refresh_token: string; expires_in: number };
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    await withTenantContext(pending.userId, (tx) => tx`
      update integrations
      set status = 'Connected', access_token = ${tokens.access_token}, refresh_token = ${tokens.refresh_token},
          realm_id = ${realmId}, token_expires_at = ${expiresAt}
      where provider = 'quickbooks'
    `);

    return reply.redirect(`${frontendUrl}/settings?qbo=connected`);
  });

  app.post("/disconnect", async (req) => {
    return withTenantContext(req.userId, (tx) => tx`
      update integrations
      set status = 'Not Connected', access_token = null, refresh_token = null, realm_id = null, token_expires_at = null
      where provider = 'quickbooks'
      returning *
    `);
  });
}
