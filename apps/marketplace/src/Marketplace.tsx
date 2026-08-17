import { useState } from "react";
import { T } from "./design/tokens";
import { ALL_DATA } from "./data";
import type { AnyListing, MarketplaceCategory, PlanTier } from "./types";
import { useI18n } from "./i18n/I18nContext";
import { useMarketplaceFilters } from "./hooks/useMarketplaceFilters";
import { useWorkspaceActions } from "./hooks/useWorkspaceActions";
import { Topbar } from "./components/Topbar";
import { CategoryTabs } from "./components/CategoryTabs";
import { FilterBar } from "./components/FilterBar";
import { FeaturedCard } from "./components/FeaturedCard";
import { ItemCard } from "./components/ItemCard";
import { DetailPanel } from "./components/DetailPanel";
import { EmptyState } from "./components/EmptyState";

export function Marketplace() {
  const { locale, t } = useI18n();
  const [category, setCategory] = useState<MarketplaceCategory>("templates");
  const [query, setQuery] = useState("");
  const [planFilter, setPlanFilter] = useState<PlanTier | "all">("all");
  const [currentPlan, setCurrentPlan] = useState<PlanTier>("basic");
  const [selected, setSelected] = useState<AnyListing | null>(null);

  const { isInstalled, isWatchlisted, toggleInstall, toggleWatchlist } = useWorkspaceActions();

  const items = ALL_DATA[category];
  const { featured, rest, filtered } = useMarketplaceFilters(items, query, planFilter, locale);

  function switchCategory(id: MarketplaceCategory) {
    setCategory(id);
    setQuery("");
    setPlanFilter("all");
    setSelected(null);
  }

  return (
    <div
      style={{
        background: T.bg,
        minHeight: "100%",
        color: T.text,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
        fontSize: 14,
      }}
    >
      <Topbar query={query} onQueryChange={setQuery} />
      <CategoryTabs active={category} onChange={switchCategory} />
      <FilterBar
        planFilter={planFilter}
        onPlanFilterChange={setPlanFilter}
        currentPlan={currentPlan}
        onCurrentPlanChange={setCurrentPlan}
        resultCount={filtered.length}
      />

      <div style={{ padding: 24 }}>
        {filtered.length === 0 ? (
          <EmptyState query={query} />
        ) : (
          <>
            {featured && (
              <>
                <p style={{ margin: "0 0 12px", fontSize: 10.5, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.09em", fontWeight: 700 }}>
                  {t("marketplace.section.featured")}
                </p>
                <FeaturedCard
                  item={featured}
                  type={category}
                  locale={locale}
                  currentPlan={currentPlan}
                  isInstalled={isInstalled(featured.id)}
                  isWatchlisted={isWatchlisted(featured.id)}
                  onOpen={setSelected}
                  onToggleInstall={toggleInstall}
                  onToggleWatchlist={toggleWatchlist}
                />
              </>
            )}

            {rest.length > 0 && (
              <>
                <p style={{ margin: "0 0 14px", fontSize: 10.5, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.09em", fontWeight: 700 }}>
                  {featured ? t("marketplace.section.all") : t("marketplace.section.results")} · {rest.length}
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(252px, 1fr))", gap: 12 }}>
                  {rest.map((item) => (
                    <ItemCard key={item.id} item={item} type={category} locale={locale} currentPlan={currentPlan} onOpen={setSelected} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {selected && (
        <DetailPanel
          item={selected}
          type={category}
          locale={locale}
          currentPlan={currentPlan}
          isInstalled={isInstalled(selected.id)}
          isWatchlisted={isWatchlisted(selected.id)}
          onClose={() => setSelected(null)}
          onToggleInstall={toggleInstall}
          onToggleWatchlist={toggleWatchlist}
        />
      )}
    </div>
  );
}
