import { CheckCircle, Plus, Clock, Lock } from "lucide-react";
import { T, alpha } from "../design/tokens";
import type { AnyListing, MarketplaceCategory, Locale, PlanTier } from "../types";
import { useI18n } from "../i18n/I18nContext";
import { fmt, localize } from "../utils/format";
import { isPlanLocked } from "../utils/plan";
import { CapabilityRing } from "./CapabilityRing";
import { PlanBadge, HighlightBadge, StarRating, StatusBadge } from "./Badges";

interface FeaturedCardProps {
  item: AnyListing;
  type: MarketplaceCategory;
  locale: Locale;
  currentPlan: PlanTier;
  isInstalled: boolean;
  isWatchlisted: boolean;
  onOpen: (item: AnyListing) => void;
  onToggleInstall: (id: string) => void;
  onToggleWatchlist: (id: string) => void;
}

export function FeaturedCard({
  item,
  type,
  locale,
  currentPlan,
  isInstalled,
  isWatchlisted,
  onOpen,
  onToggleInstall,
  onToggleWatchlist,
}: FeaturedCardProps) {
  const { t } = useI18n();
  const content = localize(item, locale);
  const isInt = type === "integrations";
  const count = item.missionCount ?? item.installCount;
  const countLabel = item.missionCount ? t("marketplace.label.missions") : t("marketplace.label.installs");
  const isComingSoon = isInt && item.status === "coming_soon";
  const locked = isPlanLocked(item.plan, currentPlan);

  return (
    <div className="mcard-featured" onClick={() => onOpen(item)}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 20 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginBottom: 14 }}>
            <span
              style={{
                background: alpha(T.indigo, 18),
                color: T.indigoSoft,
                border: `1px solid ${alpha(T.indigo, 30)}`,
                padding: "2px 9px",
                borderRadius: 5,
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              ⭐ {t("marketplace.badge.featured")}
            </span>
            <HighlightBadge badgeKey={item.badgeKey} accent={item.accent || T.indigo} />
            <PlanBadge plan={item.plan} />
            {item.official && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: T.indigo, fontSize: 12 }}>
                <CheckCircle size={11} /> {t("marketplace.badge.ldcn_core")}
              </span>
            )}
          </div>

          <h2 style={{ margin: "0 0 4px", fontSize: 21, fontWeight: 800, color: T.text, lineHeight: 1.2 }}>
            {content.name}
          </h2>
          <p style={{ margin: "0 0 14px", fontSize: 13, color: T.textMuted }}>
            {item.author}
            {item.domain && ` · ${item.domain}`}
            {item.agentCount && ` · ${t("marketplace.label.agent_count_other", { count: item.agentCount })}`}
            {item.version && ` · v${item.version}`}
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 14 }}>
            {(item.stacks || []).map((s) => (
              <span
                key={s}
                style={{ background: T.surfaceHover, border: `1px solid ${T.borderStrong}`, color: T.textSub, padding: "3px 9px", borderRadius: 5, fontSize: 12, fontWeight: 500 }}
              >
                {s}
              </span>
            ))}
            {(item.capabilities || item.modules || []).map((c) => (
              <span
                key={c}
                style={{ background: `${alpha(T.indigo, 8)}`, border: `1px solid ${alpha(T.indigo, 16)}`, color: T.indigoSoft, padding: "3px 9px", borderRadius: 5, fontSize: 12 }}
              >
                {c}
              </span>
            ))}
          </div>

          <p style={{ margin: "0 0 18px", fontSize: 13.5, color: T.textSub, lineHeight: 1.65, maxWidth: 580 }}>
            {content.description}
          </p>

          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <StarRating rating={item.rating} />
            <span style={{ color: T.textMuted, fontSize: 12 }}>
              {fmt(item.reviewCount)} {t("marketplace.label.reviews")}
            </span>
            <span style={{ color: T.textMuted, fontSize: 12 }}>
              {fmt(count)} {countLabel}
            </span>
            {isInt && item.status && <StatusBadge status={item.status} />}
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button
                className="btn-ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen(item);
                }}
              >
                {t("marketplace.action.view_details")}
              </button>
              {locked ? (
                <button
                  className="btn-ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen(item);
                  }}
                >
                  <Lock size={13} /> {t("marketplace.action.view_plans")}
                </button>
              ) : !isComingSoon ? (
                <button
                  className="btn-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleInstall(item.id);
                  }}
                >
                  {isInstalled ? <CheckCircle size={14} /> : <Plus size={14} />}
                  {isInstalled ? t("marketplace.action.added") : t("marketplace.action.add")}
                </button>
              ) : (
                <button
                  className={`btn-notify${isWatchlisted ? " active" : ""}`}
                  style={{ width: "auto", padding: "9px 16px" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleWatchlist(item.id);
                  }}
                >
                  <Clock size={13} /> {isWatchlisted ? t("marketplace.action.notified") : t("marketplace.action.notify")}
                </button>
              )}
            </div>
          </div>
        </div>

        <div style={{ opacity: 0.65, paddingTop: 4, flexShrink: 0 }}>
          <CapabilityRing capabilities={item.capabilities || item.stacks || []} size={88} />
        </div>
      </div>
    </div>
  );
}
