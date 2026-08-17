export type MarketplaceCategory =
  | "agents"
  | "stacks"
  | "templates"
  | "capabilities"
  | "integrations";

export type PlanTier = "free" | "basic" | "advanced" | "pro";

export type ListingStatus = "ACTIVE" | "DEPRECATED" | "PREVIEW" | "COMING_SOON";

export type Locale = "pt-BR" | "en" | "es" | "fr";

export interface LocalizedContent {
  name: string;
  description: string;
}

/** Base fields shared by every listing across all 5 marketplace categories. */
export interface ListingBase {
  id: string;
  author: string;
  official: boolean;
  verified: boolean;
  stacks?: string[];
  capabilities?: string[];
  modules?: string[];
  rating: number | null;
  reviewCount?: number;
  installCount?: number;
  missionCount?: number;
  plan: PlanTier;
  /** Suffix of a `marketplace.badge.*` i18n key (e.g. "top_rated" -> marketplace.badge.top_rated). */
  badgeKey?: string | null;
  featured: boolean;
  status?: "available" | "coming_soon";
  version?: string;
  updatedAt?: string;
  accent?: string;
  domain?: string;
  agentCount?: number;
  category?: string;
  /** Content that varies per locale (spec §16.2) — falls back to pt-BR when a locale is missing. */
  localizedContent: Partial<Record<Locale, LocalizedContent>>;
}

export interface AgentListing extends ListingBase {
  domain: string;
}

export interface StackPackListing extends ListingBase {
  agentCount: number;
}

export interface TemplateListing extends ListingBase {
  modules: string[];
}

export interface CapabilityListing extends ListingBase {
  category: string;
}

export interface IntegrationListing extends ListingBase {
  status: "available" | "coming_soon";
}

export type AnyListing =
  | AgentListing
  | StackPackListing
  | TemplateListing
  | CapabilityListing
  | IntegrationListing;

export interface WorkspaceMarketplaceState {
  installedIds: Set<string>;
  watchlistIds: Set<string>;
}
