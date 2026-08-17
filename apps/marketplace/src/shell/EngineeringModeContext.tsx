import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const STORAGE_KEY = "ldcn-engineering-mode";

interface EngineeringModeContextValue {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
}

const EngineeringModeContext = createContext<EngineeringModeContextValue | null>(null);

/**
 * Fase H: Tasks/Executions/Artifacts/Reviews/Gates/AI Usage/Agents/Roles/Security/Audit
 * ("Avançado" in the sidebar) are real, working pages — this toggle only controls whether they
 * clutter the everyday sidebar. It never gates the routes themselves: a direct link (e.g. from
 * Academy's "Modo avançado" module) always works, on or off. Default is off — "usuário comum não
 * precisa entrar aqui" — until the person explicitly opts in from Settings.
 */
export function EngineeringModeProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState<boolean>(() => localStorage.getItem(STORAGE_KEY) === "true");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(enabled));
  }, [enabled]);

  return <EngineeringModeContext.Provider value={{ enabled, setEnabled: setEnabledState }}>{children}</EngineeringModeContext.Provider>;
}

export function useEngineeringMode(): EngineeringModeContextValue {
  const ctx = useContext(EngineeringModeContext);
  if (!ctx) throw new Error("useEngineeringMode must be used within EngineeringModeProvider");
  return ctx;
}
