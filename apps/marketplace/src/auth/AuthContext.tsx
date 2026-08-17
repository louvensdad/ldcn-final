import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

const STORAGE_KEY = "ldcn-api-key";

/**
 * Stand-in until the backend has real auth/tenancy (today it only enforces a single global
 * LDCN_API_KEY — see apps/api/src/security/api-key.guard.ts). Mirrors
 * apps/web/src/app/core/auth/auth.service.ts so both frontends share the same stored key.
 */
interface AuthContextValue {
  apiKey: string | null;
  isAuthenticated: boolean;
  signIn: (apiKey: string) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKey] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));

  const signIn = useCallback((key: string) => {
    localStorage.setItem(STORAGE_KEY, key);
    setApiKey(key);
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setApiKey(null);
  }, []);

  return (
    <AuthContext.Provider value={{ apiKey, isAuthenticated: !!apiKey, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function getStoredApiKey(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}
