/**
 * MISSÃO "Marketplace de Sistemas Completos" seção 5 — manifesto canônico. Nunca inventado: todo
 * campo aqui é derivado de decisões REAIS já tomadas pelo engine determinístico (core Generator)
 * para a missão de referência da solução — targets/stack vêm de `ApprovedSolution` real, nunca de
 * uma tag visual solta. `database` fica `null` quando o sistema não seleciona um engine de banco
 * como stack de primeira classe hoje (ver nota no serviço) — nunca fabricado como
 * "database.postgresql" só para preencher o exemplo do brief.
 */
export interface MarketplaceManifestTarget {
  enabled: boolean;
  pluginId: string | null;
}

export interface MarketplaceCustomizationPolicy {
  branding: boolean;
  content: boolean;
  modules: boolean;
  businessRules: boolean;
  integrations: boolean;
  databaseChange: boolean;
  backendStackChange: boolean;
  frontendStackChange: boolean;
}

export interface MarketplaceManifest {
  solutionId: string;
  version: string;
  status: 'DRAFT' | 'VERIFIED' | 'REJECTED';
  targets: {
    backend: MarketplaceManifestTarget;
    frontend: MarketplaceManifestTarget;
    mobile: MarketplaceManifestTarget;
  };
  database: { pluginId: string } | null;
  capabilities: string[];
  optionalCapabilities: string[];
  removableCapabilities: string[];
  customizationPolicy: MarketplaceCustomizationPolicy;
}

export const DEFAULT_CUSTOMIZATION_POLICY: MarketplaceCustomizationPolicy = {
  branding: true,
  content: true,
  modules: true,
  businessRules: true,
  integrations: true,
  databaseChange: false,
  backendStackChange: false,
  frontendStackChange: false,
};
