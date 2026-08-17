import { NavLink } from "react-router-dom";
import { T } from "../../design/tokens";
import { useI18n } from "../../i18n/I18nContext";
import { useEngineeringMode } from "../../shell/EngineeringModeContext";

const NORMAL_TABS: { path: string; labelKey: string; end?: boolean }[] = [{ path: "", labelKey: "missionNav.overview", end: true }];

/** Fase 14/15: technical tabs never disappear as routes (a direct link still works) — only the
 * everyday nav gets simpler. Same convention as the sidebar's "Avançado" toggle. */
const TECHNICAL_TABS: { path: string; labelKey: string; end?: boolean }[] = [
  { path: "architecture", labelKey: "missionNav.architecture" },
  { path: "team", labelKey: "missionNav.team" },
  { path: "pipeline", labelKey: "missionNav.pipeline" },
  { path: "tasks", labelKey: "missionNav.tasks" },
  { path: "execution", labelKey: "missionNav.execution" },
  { path: "gates", labelKey: "missionNav.gates" },
  { path: "repair", labelKey: "missionNav.repair" },
  { path: "ai-usage", labelKey: "missionNav.aiUsage" },
];

export function MissionNav({ missionId }: { missionId: string }) {
  const { t } = useI18n();
  const { enabled: engineeringMode } = useEngineeringMode();
  const tabs = engineeringMode ? [...NORMAL_TABS, ...TECHNICAL_TABS] : NORMAL_TABS;
  return (
    <nav aria-label="Mission" style={{ display: "flex", gap: 4, borderBottom: `1px solid ${T.border}`, overflowX: "auto", marginBottom: 20 }}>
      {tabs.map((tab) => (
        <NavLink
          key={tab.path}
          to={`/missions/${missionId}${tab.path ? `/${tab.path}` : ""}`}
          end={tab.end}
          className={({ isActive }) => `stab${isActive ? " active" : ""}`}
          style={{ borderRadius: "8px 8px 0 0" }}
        >
          {t(tab.labelKey)}
        </NavLink>
      ))}
    </nav>
  );
}
