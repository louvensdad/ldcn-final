import type { CSSProperties } from "react";
import { T } from "../../design/tokens";
import { useI18n } from "../../i18n/I18nContext";
import type { MissionOverviewDto } from "../../api/mission.client";

const cardStyle: CSSProperties = {
  background: T.surface,
  border: `1px solid ${T.border}`,
  borderRadius: 12,
  padding: 16,
};
const titleStyle: CSSProperties = { margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" };
const bodyStyle: CSSProperties = { margin: 0, fontSize: 13.5, color: T.text, lineHeight: 1.5 };
const metaStyle: CSSProperties = { margin: "4px 0 0", fontSize: 12, color: T.textMuted };

/** Intent/Requirements/Topology/Solution cards — shared by the Wizard recap and Mission Detail. */
export function MissionOverviewCards({ overview }: { overview: MissionOverviewDto }) {
  const { t } = useI18n();
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
      <div style={cardStyle}>
        <h2 style={titleStyle}>{t("wizard.section.intent")}</h2>
        <p style={bodyStyle}>{overview.intentSummary.rawUserIdea}</p>
        <p style={metaStyle}>{overview.intentSummary.problemStatement}</p>
      </div>
      <div style={cardStyle}>
        <h2 style={titleStyle}>{t("wizard.section.requirements")}</h2>
        <p style={bodyStyle}>
          {overview.requirementsSummary.itemCount} · {overview.requirementsSummary.status}
        </p>
      </div>
      <div style={cardStyle}>
        <h2 style={titleStyle}>{t("wizard.section.topology")}</h2>
        <p style={bodyStyle}>{overview.topologySummary.requiredTargets.join(", ") || "—"}</p>
      </div>
      <div style={cardStyle}>
        <h2 style={titleStyle}>{t("wizard.section.solution")}</h2>
        <p style={bodyStyle}>
          {overview.solutionSummary.selectedStackCount} · {overview.solutionSummary.status}
        </p>
      </div>
    </div>
  );
}
