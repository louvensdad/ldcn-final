import { useState } from "react";
import { Search, LogOut, ChevronRight, Bell, Settings, GraduationCap, Sun, Moon, MonitorCog, Sparkles, Menu } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { T } from "../design/tokens";
import { useI18n } from "../i18n/I18nContext";
import { useAuth } from "../auth/AuthContext";
import { useTheme, type ThemePreference } from "../theme/ThemeContext";
import { LocaleSwitcher } from "../components/LocaleSwitcher";
import { NotificationPanel } from "./NotificationPanel";
import { pageLabelKeyFor } from "./navConfig";
import { useMediaQuery } from "../shared/ui/useMediaQuery";

const THEME_CYCLE: Record<ThemePreference, ThemePreference> = { system: "light", light: "dark", dark: "system" };
const THEME_ICON: Record<ThemePreference, typeof Sun> = { system: MonitorCog, light: Sun, dark: Moon };
const THEME_LABEL_KEY: Record<ThemePreference, string> = { system: "theme.system", light: "theme.light", dark: "theme.dark" };

export function Topbar({ onOpenCommandPalette, onOpenCopilot, onOpenMobileNav }: { onOpenCommandPalette: () => void; onOpenCopilot: () => void; onOpenMobileNav?: () => void }) {
  const { t } = useI18n();
  const { signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [notifsOpen, setNotifsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const isNarrow = useMediaQuery("(max-width: 560px)");

  const pageLabelKey = pageLabelKeyFor(location.pathname);
  const ThemeIcon = THEME_ICON[theme];

  function handleSignOut() {
    signOut();
    navigate("/login", { replace: true });
  }

  function go(path: string) {
    setProfileOpen(false);
    navigate(path);
  }

  return (
    <div
      style={{
        borderBottom: `1px solid ${T.border}`,
        padding: "12px 20px",
        display: "flex",
        alignItems: "center",
        gap: 14,
        flexShrink: 0,
        position: "relative",
        zIndex: 20,
      }}
    >
      {onOpenMobileNav && (
        <button className="icon-btn" onClick={onOpenMobileNav} aria-label={t("shell.menu")} title={t("shell.menu")} style={{ flexShrink: 0 }}>
          <Menu size={18} />
        </button>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, minWidth: 0, overflow: "hidden" }}>
        {!isNarrow && <span style={{ fontSize: 15, fontWeight: 800, color: T.text, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>LDCN OS</span>}
        {pageLabelKey && (
          <>
            {!isNarrow && <ChevronRight size={13} color={T.textMuted} />}
            <span style={{ fontSize: 13, color: T.textSub, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t(pageLabelKey)}</span>
          </>
        )}
      </div>

      <button
        className="btn-primary"
        onClick={onOpenCopilot}
        style={{ marginLeft: 12, fontSize: 13, padding: isNarrow ? "8px" : "8px 14px", flexShrink: 0 }}
      >
        <Sparkles size={14} /> {!isNarrow && t("copilot.buttonLabel")}
      </button>

      <button
        onClick={onOpenCommandPalette}
        style={{
          marginLeft: 8,
          flex: 1,
          minWidth: isNarrow ? 40 : undefined,
          maxWidth: 420,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "7px 12px",
          background: T.surface,
          border: `1px solid ${T.borderMid}`,
          borderRadius: 8,
          color: T.textMuted,
          fontSize: 13,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        <Search size={13} />
        {t("shell.search")}
        <span style={{ marginLeft: "auto", fontSize: 11, color: T.textMuted, border: `1px solid ${T.border}`, borderRadius: 4, padding: "1px 5px" }}>⌘K</span>
      </button>

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
        {!isNarrow && <LocaleSwitcher />}

        <button
          className="icon-btn"
          onClick={() => setTheme(THEME_CYCLE[theme])}
          aria-label={t(THEME_LABEL_KEY[theme])}
          title={t(THEME_LABEL_KEY[theme])}
        >
          <ThemeIcon size={15} />
        </button>

        <button
          className="icon-btn"
          onClick={() => {
            setNotifsOpen((o) => !o);
            setProfileOpen(false);
          }}
          aria-label={t("notifications.title")}
          title={t("notifications.title")}
        >
          <Bell size={15} />
        </button>

        <div style={{ position: "relative" }}>
          <div
            onClick={() => {
              setProfileOpen((o) => !o);
              setNotifsOpen(false);
            }}
            role="button"
            tabIndex={0}
            style={{
              width: 30, height: 30, borderRadius: 8,
              background: `linear-gradient(135deg, ${T.indigo}, ${T.violet})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0,
            }}
          >
            L
          </div>
          {profileOpen && (
            <>
              <div onClick={() => setProfileOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 30 }} />
              <div
                className="fade-in"
                style={{
                  position: "absolute", right: 0, top: 38, width: 190,
                  background: T.surfaceEl, border: `1px solid ${T.borderMid}`, borderRadius: 10,
                  zIndex: 40, overflow: "hidden", boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
                }}
              >
                <button className="palette-item" onClick={() => go("/academy")}>
                  <GraduationCap size={14} /> {t("nav.academy")}
                </button>
                <button className="palette-item" onClick={() => go("/settings")}>
                  <Settings size={14} /> {t("nav.settings")}
                </button>
                <div style={{ borderTop: `1px solid ${T.border}`, padding: "6px 8px" }}>
                  <button className="palette-item" style={{ color: T.red }} onClick={handleSignOut}>
                    <LogOut size={14} /> {t("shell.signOut")}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {notifsOpen && <NotificationPanel onClose={() => setNotifsOpen(false)} />}
    </div>
  );
}
