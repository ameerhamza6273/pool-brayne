import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface User {
  name: string;
  email: string;
  avatar: string;
  company: string;
  tenantId: string;
}

/** staff_role enum (supabase/migrations/20260728061400_initial_schema.sql): owner | manager |
 * technician | contractor | office_manager. */
export type StaffRole = "owner" | "manager" | "technician" | "contractor" | "office_manager";

/** Client feedback 2026-09-11: "Admin / Tech view / Contractor view" -- owner/manager/
 * office_manager get the full admin app; technician and contractor are field-only roles
 * restricted to the Field page (see ProtectedRoute in App.tsx). */
export function isFieldOnlyRole(role: StaffRole | null): boolean {
  return role === "technician" || role === "contractor";
}

/** Client video 2026-10-15: "give a few more options here under permissions rather than just one
 * field. Customer lookup, a few others so you can look at history." Extra pages an admin can turn
 * on per field-only person (profiles.permissions, Settings > Team). */
export type FieldPermission = "customers" | "library";
export const FIELD_PERMISSIONS: { key: FieldPermission; label: string; paths: string[] }[] = [
  { key: "customers", label: "Customer Lookup (history, notes, invoices)", paths: ["/customers"] },
  { key: "library", label: "Library", paths: ["/library"] },
];

/** Can a field-only login open this path? /field always; anything else only if granted. */
export function fieldRoleCanOpen(pathname: string, permissions: string[]): boolean {
  if (pathname === "/field") return true;
  return FIELD_PERMISSIONS.some((p) => permissions.includes(p.key) && p.paths.some((base) => pathname === base || pathname.startsWith(base + "/")));
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  session: Session | null;
  /** Raw tenant UUID (for queries/inserts) — distinct from user.tenantId, which is a display label. */
  tenantId: string | null;
  profileId: string | null;
  role: StaffRole | null;
  /** Extra pages granted to a field-only login (see FIELD_PERMISSIONS). */
  permissions: string[];
  signUp: (email: string, password: string, data: { name: string; company: string }) => Promise<{ error: string | null; needsEmailConfirmation: boolean }>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function getAvatar(name: string): string {
  return name.split(" ").map((n) => n[0]?.toUpperCase()).join("").slice(0, 2) || "?";
}

async function loadProfile(session: Session): Promise<{ user: User; tenantId: string; profileId: string; role: StaffRole; permissions: string[] } | null> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("name, email, avatar, tenant_id, role, permissions, tenants(name)")
    .eq("id", session.user.id)
    .single();

  if (error || !profile) return null;

  const tenantName = (profile.tenants as unknown as { name: string } | null)?.name ?? "New Pool Company";

  return {
    user: {
      name: profile.name,
      email: profile.email,
      avatar: profile.avatar || getAvatar(profile.name),
      company: tenantName,
      tenantId: `Tenant ${profile.tenant_id.slice(0, 8).toUpperCase()}`,
    },
    tenantId: profile.tenant_id,
    profileId: session.user.id,
    role: profile.role as StaffRole,
    permissions: (profile as { permissions?: string[] | null }).permissions ?? [],
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [role, setRole] = useState<StaffRole | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const applyProfile = useCallback((session: Session) => {
    loadProfile(session).then((result) => {
      setUser(result?.user ?? null);
      setTenantId(result?.tenantId ?? null);
      setProfileId(result?.profileId ?? null);
      setRole(result?.role ?? null);
      setPermissions(result?.permissions ?? []);
    });
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) {
        applyProfile(data.session);
      }
      setIsLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        applyProfile(newSession);
      } else {
        setUser(null);
        setTenantId(null);
        setProfileId(null);
        setRole(null);
        setPermissions([]);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [applyProfile]);

  const signUp = useCallback(async (email: string, password: string, data: { name: string; company: string }) => {
    const { data: signUpData, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: data.name, company_name: data.company } },
    });
    return { error: error?.message ?? null, needsEmailConfirmation: !signUpData.session };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated: !!session, isLoading, user, session, tenantId, profileId, role, permissions, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
