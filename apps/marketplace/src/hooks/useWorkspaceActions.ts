import { useCallback, useState } from "react";

/**
 * Local-only stand-in for the real Install/Watchlist services (spec §15.2).
 * Persists nothing beyond the session — swap for Platform API calls when
 * the Marketplace is wired to a real workspace backend.
 */
export function useWorkspaceActions() {
  const [installedIds, setInstalledIds] = useState<Set<string>>(new Set());
  const [watchlistIds, setWatchlistIds] = useState<Set<string>>(new Set());

  const toggleInstall = useCallback((id: string) => {
    setInstalledIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const toggleWatchlist = useCallback((id: string) => {
    setWatchlistIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  return {
    isInstalled: (id: string) => installedIds.has(id),
    isWatchlisted: (id: string) => watchlistIds.has(id),
    toggleInstall,
    toggleWatchlist,
  };
}
