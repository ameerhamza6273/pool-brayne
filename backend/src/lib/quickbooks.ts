import { withTenantContext } from "../db.js";

const QBO_API_BASE =
  process.env.QBO_ENVIRONMENT === "production" ? "https://quickbooks.api.intuit.com" : "https://sandbox-quickbooks.api.intuit.com";
const TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";

interface QboConnection {
  accessToken: string;
  realmId: string;
}

async function refreshAccessToken(refreshToken: string) {
  const basicAuth = Buffer.from(`${process.env.QBO_CLIENT_ID}:${process.env.QBO_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
  });
  if (!res.ok) throw new Error(`QuickBooks token refresh failed: ${await res.text()}`);
  return (await res.json()) as { access_token: string; refresh_token: string; expires_in: number };
}

// Runs `fn` with a valid access token + realm id for the caller's tenant, transparently
// refreshing the token first if it's expired or about to expire. Throws a clear error if the
// tenant hasn't connected QuickBooks yet.
export async function withQuickbooksConnection<T>(userId: string, fn: (conn: QboConnection) => Promise<T>): Promise<T> {
  return withTenantContext(userId, async (tx) => {
    const [row] = (await tx`
      select access_token, refresh_token, realm_id, token_expires_at from integrations where provider = 'quickbooks'
    `) as unknown as { access_token: string | null; refresh_token: string | null; realm_id: string | null; token_expires_at: string | null }[];

    if (!row?.access_token || !row.refresh_token || !row.realm_id) {
      throw new Error("QuickBooks is not connected. Connect it from Settings > Integrations first.");
    }

    let accessToken = row.access_token;
    const expiresAt = row.token_expires_at ? new Date(row.token_expires_at).getTime() : 0;
    if (Date.now() > expiresAt - 60_000) {
      const tokens = await refreshAccessToken(row.refresh_token);
      accessToken = tokens.access_token;
      const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
      await tx`
        update integrations set access_token = ${tokens.access_token}, refresh_token = ${tokens.refresh_token}, token_expires_at = ${newExpiresAt}
        where provider = 'quickbooks'
      `;
    }

    return fn({ accessToken, realmId: row.realm_id });
  });
}

async function qboRequest(conn: QboConnection, method: string, path: string, body?: unknown) {
  const res = await fetch(`${QBO_API_BASE}/v3/company/${conn.realmId}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${conn.accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`QuickBooks API error (${res.status}): ${await res.text()}`);
  return res.json() as Promise<any>;
}

export async function pushCustomer(
  conn: QboConnection,
  customer: { name: string; email: string | null; phone: string | null; address: string | null },
): Promise<string> {
  const payload = {
    DisplayName: customer.name,
    PrimaryEmailAddr: customer.email ? { Address: customer.email } : undefined,
    PrimaryPhone: customer.phone ? { FreeFormNumber: customer.phone } : undefined,
    BillAddr: customer.address ? { Line1: customer.address } : undefined,
  };
  const result = await qboRequest(conn, "POST", "/customer", payload);
  return result.Customer.Id as string;
}

// Every QBO invoice line needs an ItemRef (a Product/Service record) — we don't map PoolBrayne's
// own inventory to QBO Items, so we bill the whole invoice as one line against whichever Item the
// company already has (every QBO company, sandbox or real, has at least one by default).
async function getDefaultItemRef(conn: QboConnection): Promise<{ value: string; name: string }> {
  const result = await qboRequest(conn, "GET", `/query?query=${encodeURIComponent("select * from Item maxresults 1")}`);
  const item = result.QueryResponse?.Item?.[0];
  if (!item) throw new Error("No Product/Service found in QuickBooks to bill against — create at least one in QuickBooks first.");
  return { value: item.Id, name: item.Name };
}

export async function pushInvoice(
  conn: QboConnection,
  qboCustomerId: string,
  invoice: { number: string; dueDate: string | null; amount: number },
): Promise<string> {
  const item = await getDefaultItemRef(conn);
  const payload = {
    CustomerRef: { value: qboCustomerId },
    DocNumber: invoice.number,
    DueDate: invoice.dueDate ?? undefined,
    Line: [
      {
        Amount: invoice.amount,
        DetailType: "SalesItemLineDetail",
        Description: `Invoice ${invoice.number}`,
        SalesItemLineDetail: { ItemRef: item, Qty: 1, UnitPrice: invoice.amount },
      },
    ],
  };
  const result = await qboRequest(conn, "POST", "/invoice", payload);
  return result.Invoice.Id as string;
}
