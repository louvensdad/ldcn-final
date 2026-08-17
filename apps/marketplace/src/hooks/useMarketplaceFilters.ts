import { useMemo } from "react";
import type { AnyListing, Locale, PlanTier } from "../types";
import { localize } from "../utils/format";

/** Search + plan filtering over the active category's listings (spec §07.1, §07.3). */
export function useMarketplaceFilters(
  items: AnyListing[],
  query: string,
  planFilter: PlanTier | "all",
  locale: Locale,
) {
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = items.filter((item) => {
      const content = localize(item, locale);
      const matchesQuery =
        !q ||
        content.name.toLowerCase().includes(q) ||
        content.description.toLowerCase().includes(q) ||
        item.author.toLowerCase().includes(q) ||
        (item.stacks ?? []).some((s) => s.toLowerCase().includes(q)) ||
        (item.capabilities ?? []).some((c) => c.toLowerCase().includes(q)) ||
        (item.modules ?? []).some((m) => m.toLowerCase().includes(q));
      const matchesPlan = planFilter === "all" || item.plan === planFilter;
      return matchesQuery && matchesPlan;
    });

    const featured = filtered.find((i) => i.featured) ?? null;
    const rest = filtered.filter((i) => !i.featured);

    return { filtered, featured, rest };
  }, [items, query, planFilter, locale]);
}
