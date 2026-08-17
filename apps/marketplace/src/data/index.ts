import { Bot, Layers, FileCode, Zap, Plug, type LucideIcon } from "lucide-react";
import type { AnyListing, MarketplaceCategory } from "../types";
import { AGENTS } from "./agents";
import { STACKS } from "./stacks";
import { TEMPLATES } from "./templates";
import { CAPABILITIES } from "./capabilities";
import { INTEGRATIONS } from "./integrations";

export const ALL_DATA: Record<MarketplaceCategory, AnyListing[]> = {
  agents: AGENTS,
  stacks: STACKS,
  templates: TEMPLATES,
  capabilities: CAPABILITIES,
  integrations: INTEGRATIONS,
};

/**
 * Redesign Fase F: "Sistemas completos" (id stays "templates" — same real data, just the primary
 * entry point now) leads instead of Agents, per the mission brief's "marketplace de soluções, não
 * de agentes". Order here is render order in CategoryTabs.
 */
export const CATEGORY_CONFIG: { id: MarketplaceCategory; i18nKey: string; Icon: LucideIcon }[] = [
  { id: "templates", i18nKey: "marketplace.category.templates", Icon: FileCode },
  { id: "agents", i18nKey: "marketplace.category.agents", Icon: Bot },
  { id: "stacks", i18nKey: "marketplace.category.stacks", Icon: Layers },
  { id: "capabilities", i18nKey: "marketplace.category.capabilities", Icon: Zap },
  { id: "integrations", i18nKey: "marketplace.category.integrations", Icon: Plug },
];

export { AGENTS, STACKS, TEMPLATES, CAPABILITIES, INTEGRATIONS };
