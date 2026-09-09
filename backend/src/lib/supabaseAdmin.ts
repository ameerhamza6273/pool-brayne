import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Service-role client for admin-only auth operations (creating/deleting a team member's login).
// Never used for regular data access -- everything else goes through withTenantContext (db.ts)
// so RLS stays the source of truth for tenant isolation. Lazily constructed so a missing key
// only breaks the specific route that needs it, not the whole server at boot.
let client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (client) return client;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  client = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  return client;
}
