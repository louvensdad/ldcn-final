import { CheckCircle, Plug, Zap, Lock } from "lucide-react";
import { T, alpha } from "../design/tokens";
import type { AnyListing, MarketplaceCategory, Locale, PlanTier } from "../types";
import { useI18n } from "../i18n/I18nContext";
import { fmt, localize } from "../utils/format";
import { isPlanLocked } from "../utils/plan";
import { CapabilityRing } from "./CapabilityRing";
import { PlanBadge, HighlightBadge, StarRating, StatusBadge } from "./Badges";

interface ItemCardProps {
  item: AnyListing;
  type: MarketplaceCategory;
  locale: Locale;
  currentPlan: PlanTier;
  onOpen: (item: AnyListing) => void;
}

export function ItemCard({ item, type, locale, currentPlan, onOpen }: ItemCardProps) {
  const { t } = useI18n();
  const content = localize(item, locale);
  const locked = isPlanLocked(item.plan, currentPlan);
  const isInt = type === "integrations";
  const isCap = type === "capabilities";
  const count = item.missionCount ?? item.installCount;
  const countLabel = item.missionCount ? t("marketplace.label.missions") : t("marketplace.label.installs");
  const tags = (item.stacks || item.modules || []).slice(0, 3);

  return (
    <div className="mcard" onClick={() => onOpen(item)}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 7, minHeight: 20 }}>
            <HighlightBadge badgeKey={item.badgeKey} accent={item.accent || T.indigo} />
            {isInt && item.status && <StatusBadge status={item.status} />}
            {isCap && item.category && (
              <span style={{ color: T.textMuted, fontSize: 11, alignSelf: "center" }}>{item.category}</span>
            )}
          </div>
          <h3 style={{ margin: "0 0 4px", fontSize: 14.5, fontWeight: 700, color: T.text, lineHeight: 1.25 }}>
            {content.name}
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 12, color: T.textMuted }}>{item.author}</span>
            {item.verified && <CheckCircle size={10} color={item.official ? T.indigo : T.textMuted} />}
          </div>
        </div>

        {!isInt && !isCap ? (
          <CapabilityRing capabilities={item.capabilities || item.stacks || []} size={46} />
        ) : (
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 9,
              flexShrink: 0,
              background: item.accent ? `${alpha(item.accent, 9)}` : T.surfaceEl,
              border: `1px solid ${item.accent ? alpha(item.accent, 19) : T.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {isInt ? <Plug size={15} color={item.accent || T.indigo} /> : <Zap size={15} color={item.accent || T.indigo} />}
          </div>
        )}
      </div>

      {tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
          {tags.map((s) => (
            <span
              key={s}
              style={{ background: T.surfaceHover, border: `1px solid ${T.border}`, color: T.textMuted, padding: "2px 7px", borderRadius: 4, fontSize: 11 }}
            >
              {s}
            </span>
          ))}
          {item.agentCount && (
            <span style={{ background: `${alpha(T.indigo, 7)}`, border: `1px solid ${alpha(T.indigo, 13)}`, color: T.indigoSoft, padding: "2px 7px", borderRadius: 4, fontSize: 11 }}>
              {t("marketplace.label.agent_count_other", { count: item.agentCount })}
            </span>
          )}
        </div>
      )}

      <p
        style={{
          margin: "0 0 12px",
          fontSize: 12.5,
          color: T.textSub,
          lineHeight: 1.55,
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          flex: 1,
        }}
      >
        {content.description}
      </p>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: `1px solid ${T.border}`, paddingTop: 10, marginTop: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <StarRating rating={item.rating} />
          {count ? <span style={{ color: T.textMuted, fontSize: 11 }}>{fmt(count)} {countLabel}</span> : null}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {locked && <Lock size={11} color={T.textMuted} />}
          <PlanBadge plan={item.plan} />
        </div>
      </div>
    </div>
  );
}
