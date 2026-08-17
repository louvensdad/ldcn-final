import { Star } from "lucide-react";
import { T, PLANS, alpha } from "../design/tokens";
import type { PlanTier } from "../types";
import { useI18n } from "../i18n/I18nContext";

export function PlanBadge({ plan }: { plan: PlanTier }) {
  const { t } = useI18n();
  const p = PLANS[plan];
  if (!p) return null;
  return (
    <span
      style={{
        background: p.bg,
        color: p.color,
        border: `1px solid ${alpha(p.color, 27)}`,
        padding: "2px 8px",
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.01em",
      }}
    >
      {t(`marketplace.filter.plan.${plan}`)}
    </span>
  );
}

export function HighlightBadge({ badgeKey, accent }: { badgeKey?: string | null; accent: string }) {
  const { t } = useI18n();
  if (!badgeKey) return null;
  return (
    <span
      style={{
        background: `${alpha(accent, 10)}`,
        color: accent,
        border: `1px solid ${alpha(accent, 25)}`,
        padding: "2px 8px",
        borderRadius: 5,
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      {t(`marketplace.badge.${badgeKey}`)}
    </span>
  );
}

export function StarRating({ rating }: { rating: number | null }) {
  const { t } = useI18n();
  if (!rating) {
    return <span style={{ color: T.textMuted, fontSize: 12 }}>{t("marketplace.label.new")}</span>;
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: T.amber, fontSize: 12.5, fontWeight: 700 }}>
      <Star size={11} fill={T.amber} />
      {rating.toFixed(1)}
    </span>
  );
}

export function StatusBadge({ status }: { status: "available" | "coming_soon" }) {
  const { t } = useI18n();
  const isComingSoon = status === "coming_soon";
  const color = isComingSoon ? T.amber : T.emerald;
  return (
    <span
      style={{
        background: `${alpha(color, 10)}`,
        color,
        border: `1px solid ${alpha(color, 25)}`,
        padding: "2px 8px",
        borderRadius: 5,
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      {t(isComingSoon ? "marketplace.status.coming_soon" : "marketplace.status.available")}
    </span>
  );
}
