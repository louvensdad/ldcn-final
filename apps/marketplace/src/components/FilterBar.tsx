import { Filter } from "lucide-react";
import { T } from "../design/tokens";
import type { PlanTier } from "../types";
import { useI18n } from "../i18n/I18nContext";

const PLAN_FILTERS: (PlanTier | "all")[] = ["all", "free", "basic", "advanced", "pro"];

interface FilterBarProps {
  planFilter: PlanTier | "all";
  onPlanFilterChange: (plan: PlanTier | "all") => void;
  currentPlan: PlanTier;
  onCurrentPlanChange: (plan: PlanTier) => void;
  resultCount: number;
}

export function FilterBar({ planFilter, onPlanFilterChange, currentPlan, onCurrentPlanChange, resultCount }: FilterBarProps) {
  const { t, tn } = useI18n();
  return (
    <div style={{ padding: "11px 24px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 8, overflowX: "auto" }}>
      <Filter size={13} color={T.textMuted} style={{ flexShrink: 0 }} />
      <span style={{ fontSize: 12, color: T.textMuted, flexShrink: 0, marginRight: 2 }}>{t("marketplace.filter.plan.label")}</span>
      {PLAN_FILTERS.map((p) => (
        <button
          key={p}
          className={`plan-chip${planFilter === p ? " active" : ""}`}
          onClick={() => onPlanFilterChange(p)}
        >
          {t(`marketplace.filter.plan.${p}`)}
        </button>
      ))}

      <span style={{ width: 1, alignSelf: "stretch", background: T.border, margin: "0 4px", flexShrink: 0 }} />

      <label style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <span style={{ fontSize: 12, color: T.textMuted }}>{t("marketplace.plan.title")}:</span>
        <select
          className="locale-select"
          value={currentPlan}
          onChange={(e) => onCurrentPlanChange(e.target.value as PlanTier)}
          aria-label={t("marketplace.plan.title")}
        >
          {(["free", "basic", "advanced", "pro"] as PlanTier[]).map((p) => (
            <option key={p} value={p}>
              {t(`marketplace.filter.plan.${p}`)}
            </option>
          ))}
        </select>
      </label>

      <span style={{ marginLeft: "auto", fontSize: 12, color: T.textMuted, flexShrink: 0, whiteSpace: "nowrap" }}>
        {tn("marketplace.result", resultCount)}
      </span>
    </div>
  );
}
