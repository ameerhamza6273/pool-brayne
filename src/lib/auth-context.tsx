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

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  session: Session | null;
  /** Raw tenant UUID (for queries/inserts) — distinct from user.tenantId, which is a display label. */
  tenantId: string | null;
  profileId: string | null;
  signUp: (email: string, password: string, data: { name: string; company: string }) => Promise<{ error: string | null; needsEmailConfirmation: boolean }>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function getAvatar(name: string): string {
  return name.split(" ").map((n) => n[0]?.toUpperCase()).join("").slice(0, 2) || "?";
}

async function loadProfile(session: Session): Promise<{ user: User; tenantId: string; profileId: string } | null> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("name, email, avatar, tenant_id, tenants(name)")
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
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const applyProfile = useCallback((session: Session) => {
    loadProfile(session).then((result) => {
      setUser(result?.user ?? null);
      setTenantId(result?.tenantId ?? null);
      setProfileId(result?.profileId ?? null);
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
    <AuthContext.Provider value={{ isAuthenticated: !!session, isLoading, user, session, tenantId, profileId, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
