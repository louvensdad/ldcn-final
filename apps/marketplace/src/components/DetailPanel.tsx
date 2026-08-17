import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle, X, Plus, Clock, Lock, Sparkles } from "lucide-react";
import { T, PLANS, alpha } from "../design/tokens";
import type { AnyListing, MarketplaceCategory, Locale, PlanTier } from "../types";
import { useI18n } from "../i18n/I18nContext";
import { fmt, localize } from "../utils/format";
import { isPlanLocked } from "../utils/plan";
import { CapabilityRing } from "./CapabilityRing";
import { PlanBadge, HighlightBadge, StarRating, StatusBadge } from "./Badges";
import { TagRow } from "./TagRow";
import { CustomizeWithAiDialog } from "../pages/dialogs/CustomizeWithAiDialog";

interface DetailPanelProps {
  item: AnyListing;
  type: MarketplaceCategory;
  locale: Locale;
  currentPlan: PlanTier;
  isInstalled: boolean;
  isWatchlisted: boolean;
  onClose: () => void;
  onToggleInstall: (id: string) => void;
  onToggleWatchlist: (id: string) => void;
}

export function DetailPanel({
  item,
  type,
  locale,
  currentPlan,
  isInstalled,
  isWatchlisted,
  onClose,
  onToggleInstall,
  onToggleWatchlist,
}: DetailPanelProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const content = localize(item, locale);
  const isInt = type === "integrations";
  const isSystem = type === "templates";
  const count = item.missionCount ?? item.installCount;
  const countLabel = item.missionCount ? t("marketplace.label.missions") : t("marketplace.label.installs");
  const locked = isPlanLocked(item.plan, currentPlan);
  const isComingSoon = isInt && item.status === "coming_soon";
  const [customizeOpen, setCustomizeOpen] = useState(false);

  function handleCustomizeClosed(missionId: string | undefined) {
    setCustomizeOpen(false);
    if (missionId) navigate(`/missions/${missionId}`);
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 40 }}
      />
      <div
        className="panel-in"
        role="dialog"
        aria-modal="true"
        aria-label={content.name}
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: 372,
          background: T.surfaceEl,
          borderLeft: `1px solid ${T.borderMid}`,
          zIndex: 50,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ padding: "18px 20px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                <HighlightBadge badgeKey={item.badgeKey} accent={item.accent || T.indigo} />
                <PlanBadge plan={item.plan} />
                {isInt && item.status && <StatusBadge status={item.status} />}
              </div>
              <h2 style={{ margin: "0 0 5px", fontSize: 17, fontWeight: 700, color: T.text, lineHeight: 1.2 }}>
                {content.name}
              </h2>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ fontSize: 12.5, color: T.textMuted }}>{item.author}</span>
                {item.verified && <CheckCircle size={11} color={item.official ? T.indigo : T.textMuted} />}
                {item.version && <span style={{ color: T.textMuted, fontSize: 12 }}>· v{item.version}</span>}
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label={t("marketplace.action.close")}
              style={{ background: "none", border: "none", color: T.textMuted, cursor: "pointer", padding: 4, lineHeight: 1 }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {(item.capabilities || []).length > 0 && (
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "flex-start", gap: 14 }}>
            <CapabilityRing capabilities={item.capabilities} size={64} />
            <div>
              <p style={{ margin: "0 0 7px", fontSize: 10.5, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600 }}>
                {t("marketplace.label.capabilities")}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {(item.capabilities ?? []).map((c) => (
                  <span key={c} style={{ background: `${alpha(T.indigo, 7)}`, border: `1px solid ${alpha(T.indigo, 15)}`, color: T.indigoSoft, padding: "2px 7px", borderRadius: 4, fontSize: 11.5 }}>
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", gap: 20, flexWrap: "wrap" }}>
          {item.rating && (
            <div>
              <p style={{ margin: "0 0 3px", fontSize: 10.5, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {t("marketplace.label.rating")}
              </p>
              <StarRating rating={item.rating} />
            </div>
          )}
          {item.reviewCount && (
            <div>
              <p style={{ margin: "0 0 3px", fontSize: 10.5, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {t("marketplace.label.reviews")}
              </p>
              <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: T.text }}>{fmt(item.reviewCount)}</p>
            </div>
          )}
          {count ? (
            <div>
              <p style={{ margin: "0 0 3px", fontSize: 10.5, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{countLabel}</p>
              <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: T.text }}>{fmt(count)}</p>
            </div>
          ) : null}
          {item.updatedAt && (
            <div>
              <p style={{ margin: "0 0 3px", fontSize: 10.5, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {t("marketplace.label.updated")}
              </p>
              <p style={{ margin: 0, fontSize: 12.5, color: T.textSub }}>{item.updatedAt}</p>
            </div>
          )}
        </div>

        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}` }}>
          <p style={{ margin: "0 0 8px", fontSize: 10.5, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600 }}>
            {t("marketplace.label.description")}
          </p>
          <p style={{ margin: 0, fontSize: 13.5, color: T.textSub, lineHeight: 1.7 }}>{content.description}</p>
        </div>

        {(item.stacks || item.modules || []).length > 0 && (
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}` }}>
            <p style={{ margin: "0 0 8px", fontSize: 10.5, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600 }}>
              {item.modules ? t("marketplace.label.modules") : t("marketplace.label.stacks")}
            </p>
            <TagRow items={item.stacks || item.modules || []} color={T.textSub} bg={T.surfaceHover} border={T.borderStrong} />
          </div>
        )}

        {item.agentCount && (
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.border}` }}>
            <p style={{ margin: "0 0 5px", fontSize: 10.5, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600 }}>
              {t("marketplace.label.composition")}
            </p>
            <p style={{ margin: 0, fontSize: 13.5, color: T.text, fontWeight: 600 }}>
              {t("marketplace.label.composition_detail_other", { count: item.agentCount })}
            </p>
          </div>
        )}

        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.border}` }}>
          <p style={{ margin: "0 0 7px", fontSize: 10.5, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600 }}>
            {t("marketplace.plan.title")}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <PlanBadge plan={item.plan} />
            <span style={{ fontSize: 12.5, color: T.textSub }}>
              {item.plan === "free" ? t("marketplace.plan.free_available") : t("marketplace.plan.required", { plan: t(`marketplace.filter.plan.${item.plan}`) })}
            </span>
          </div>
          {locked && (
            <div
              style={{
                marginTop: 10,
                padding: "10px 12px",
                borderRadius: 8,
                background: `${alpha(PLANS[item.plan].color, 7)}`,
                border: `1px solid ${alpha(PLANS[item.plan].color, 19)}`,
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12.5,
                color: T.textSub,
              }}
            >
              <Lock size={13} color={PLANS[item.plan].color} />
              {t("marketplace.plan.required", { plan: t(`marketplace.filter.plan.${item.plan}`) })}
            </div>
          )}
        </div>

        <div style={{ padding: "16px 20px", marginTop: "auto" }}>
          {locked ? (
            <button className="btn-primary" style={{ width: "100%", padding: "11px 16px", fontSize: 14 }}>
              <Lock size={15} /> {t("marketplace.action.view_plans")}
            </button>
          ) : isSystem ? (
            <button className="btn-primary" style={{ width: "100%", padding: "11px 16px", fontSize: 14 }} onClick={() => setCustomizeOpen(true)}>
              <Sparkles size={15} /> {t("marketplace.customize.button")}
            </button>
          ) : !isComingSoon ? (
            <button
              className="btn-primary"
              style={{ width: "100%", padding: "11px 16px", fontSize: 14 }}
              onClick={() => onToggleInstall(item.id)}
            >
              {isInstalled ? <CheckCircle size={16} /> : <Plus size={16} />}
              {isInstalled ? t("marketplace.action.added") : t("marketplace.action.add")}
            </button>
          ) : (
            <button className={`btn-notify${isWatchlisted ? " active" : ""}`} onClick={() => onToggleWatchlist(item.id)}>
              <Clock size={14} /> {isWatchlisted ? t("marketplace.action.notified") : t("marketplace.action.notify")}
            </button>
          )}
        </div>
      </div>

      {customizeOpen && <CustomizeWithAiDialog item={item} locale={locale} onClosed={handleCustomizeClosed} />}
    </>
  );
}
