import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { ChevronDown, ChevronLeft, ChevronRight, Wrench } from "lucide-react";
import { T } from "../design/tokens";
import { useI18n } from "../i18n/I18nContext";
import { useEngineeringMode } from "./EngineeringModeContext";
import { NAV_MAIN, NAV_GROUPS, NAV_BOTTOM, type NavItemDef } from "./navConfig";

/**
 * `onNavigate` is set only by the mobile drawer (AppShell) so a nav click also closes the
 * overlay; on desktop it's undefined and the sidebar behaves exactly as before. `mobile` disables
 * the icon-only collapse mode, which has no use inside an overlay.
 */
export function Sidebar({ onNavigate, mobile = false }: { onNavigate?: () => void; mobile?: boolean } = {}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { enabled: engineeringModeEnabled } = useEngineeringMode();
  const [collapsedState, setCollapsed] = useState(false);
  const collapsed = mobile ? false : collapsedState;
  const [openGroups, setOpenGroups] = useState<string[]>(() => NAV_GROUPS.filter((g) => g.defaultOpen).map((g) => g.id));

  // "advanced" (Avançado) only shows once the user opts in from Settings — see Fase H.
  const visibleGroups = NAV_GROUPS.filter((g) => g.id !== "advanced" || engineeringModeEnabled);

  function toggleGroup(id: string) {
    setOpenGroups((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));
  }

  function Item({ item, child = false }: { item: NavItemDef; child?: boolean }) {
    return (
      <NavLink
        to={item.path}
        end={item.end}
        title={collapsed ? t(item.labelKey) : undefined}
        className={({ isActive }) => `nav-item${child ? " child" : ""}${isActive ? " active" : ""}`}
        onClick={onNavigate}
      >
        <item.icon size={14} style={{ flexShrink: 0 }} />
        {!collapsed && <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{t(item.labelKey)}</span>}
      </NavLink>
    );
  }

  return (
    <aside
      style={{
        width: collapsed ? 58 : 208,
        flexShrink: 0,
        height: "100%",
        borderRight: `1px solid ${T.border}`,
        background: T.bg,
        display: "flex",
        flexDirection: "column",
        transition: mobile ? undefined : "width 0.2s ease",
        overflow: "hidden",
      }}
    >
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 8px 0" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {NAV_MAIN.map((item) => (
            <Item key={item.path} item={item} />
          ))}
        </div>

        <div style={{ marginTop: 8 }}>
          {visibleGroups.map((group) => (
            <div key={group.id} style={{ marginBottom: 2 }}>
              {!collapsed ? (
                <>
                  <button className="nav-item" onClick={() => toggleGroup(group.id)} style={{ justifyContent: "space-between" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <group.icon size={14} style={{ flexShrink: 0 }} />
                      <span>{t(group.labelKey)}</span>
                    </span>
                    <ChevronDown
                      size={12}
                      style={{ transform: openGroups.includes(group.id) ? "rotate(0)" : "rotate(-90deg)", transition: "transform 0.15s" }}
                    />
                  </button>
                  {openGroups.includes(group.id) && group.items.map((item) => <Item key={item.path} item={item} child />)}
                </>
              ) : (
                <button className="nav-item" title={t(group.labelKey)} onClick={() => setCollapsed(false)}>
                  <group.icon size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${T.border}`, padding: 8, display: "flex", flexDirection: "column", gap: 1 }}>
        {!engineeringModeEnabled && (
          <button
            className="nav-item"
            title={collapsed ? t("nav.enableAdvanced") : undefined}
            onClick={() => { navigate("/settings"); onNavigate?.(); }}
          >
            <Wrench size={14} style={{ flexShrink: 0 }} />
            {!collapsed && <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{t("nav.enableAdvanced")}</span>}
          </button>
        )}
        {NAV_BOTTOM.map((item) => (
          <Item key={item.path} item={item} />
        ))}
        {!mobile && (
          <button
            className="icon-btn"
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? t("nav.expand") : t("nav.collapse")}
            style={{ width: "100%", height: 32, borderRadius: 7, marginTop: 2 }}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        )}
      </div>
    </aside>
  );
}
