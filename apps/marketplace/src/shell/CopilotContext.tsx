import { createContext, useContext } from "react";

interface CopilotContextValue {
  open: () => void;
}

export const CopilotContext = createContext<CopilotContextValue | null>(null);

/** Lets any page (e.g. the Project Command Center's "Falar com LDCN") open the global drawer AppShell owns. */
export function useCopilot(): CopilotContextValue {
  const ctx = useContext(CopilotContext);
  if (!ctx) throw new Error("useCopilot must be used within AppShell");
  return ctx;
}
