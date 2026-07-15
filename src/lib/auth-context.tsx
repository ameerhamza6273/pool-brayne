import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface User {
  name: string;
  email: string;
  avatar: string;
  company: string;
  tenantId: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  login: (email: string, password: string, userData?: Partial<User>) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

function getAvatar(name: string): string {
  return name.split(" ").map((n) => n[0]?.toUpperCase()).join("").slice(0, 2);
}

function getTenantId(): string {
  const existing = localStorage.getItem("poolbrayne_tenant_count");
  const count = existing ? parseInt(existing, 10) : 1;
  const next = count + 1;
  localStorage.setItem("poolbrayne_tenant_count", next.toString());
  return `Tenant ${String(next).padStart(3, "0")}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem("poolbrayne_auth") === "true";
  });
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem("poolbrayne_user");
    return saved ? JSON.parse(saved) : null;
  });

  const login = useCallback((email: string, password: string, userData?: Partial<User>) => {
    if (email && password) {
      const name = userData?.name || email.split("@")[0];
      const company = userData?.company || "New Pool Company";
      const tenantId = userData?.tenantId || getTenantId();
      const fullUser: User = {
        name,
        email,
        avatar: getAvatar(name),
        company,
        tenantId,
      };
      setIsAuthenticated(true);
      setUser(fullUser);
      localStorage.setItem("poolbrayne_auth", "true");
      localStorage.setItem("poolbrayne_user", JSON.stringify(fullUser));
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    setUser(null);
    localStorage.removeItem("poolbrayne_auth");
    localStorage.removeItem("poolbrayne_user");
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
