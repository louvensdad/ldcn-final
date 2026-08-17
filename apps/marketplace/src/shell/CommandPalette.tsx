import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Plus, Home, Store, LogOut, FolderOpen, BookOpen } from "lucide-react";
import { T } from "../design/tokens";
import { useI18n } from "../i18n/I18nContext";
import { useAuth } from "../auth/AuthContext";
import { missionClient, type MissionSummaryDto } from "../api/mission.client";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const { t } = useI18n();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [missions, setMissions] = useState<MissionSummaryDto[]>([]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    missionClient.list().then(setMissions).catch(() => setMissions([]));
  }, [open]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const filteredMissions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return missions.slice(0, 6);
    return missions.filter((m) => m.rawUserIdea.toLowerCase().includes(q)).slice(0, 8);
  }, [missions, query]);

  function go(path: string) {
    navigate(path);
    onClose();
  }

  if (!open) return null;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 60 }} />
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: "fixed",
          top: "14%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "min(560px, 92vw)",
          maxHeight: "60vh",
          background: T.surfaceEl,
          border: `1px solid ${T.borderMid}`,
          borderRadius: 12,
          zIndex: 61,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", borderBottom: `1px solid ${T.border}` }}>
          <Search size={14} color={T.textMuted} />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("commandPalette.placeholder")}
            style={{ flex: 1, background: "none", border: "none", outline: "none", color: T.text, fontSize: 13.5, fontFamily: "inherit" }}
          />
        </div>

        <div style={{ overflowY: "auto", padding: 6 }}>
          {filteredMissions.length > 0 && (
            <div style={{ marginBottom: 4 }}>
              <p style={{ margin: "6px 10px 4px", fontSize: 10.5, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700 }}>
                {t("commandPalette.groupMissions")}
              </p>
              {filteredMissions.map((mission) => (
                <button key={mission.missionId} className="palette-item" onClick={() => go(`/missions/${mission.missionId}`)}>
                  {mission.rawUserIdea}
                </button>
              ))}
            </div>
          )}

          <p style={{ margin: "6px 10px 4px", fontSize: 10.5, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700 }}>
            {t("commandPalette.groupNavigation")}
          </p>
          <button className="palette-item" onClick={() => go("/")}>
            <Home size={14} /> {t("commandPalette.goToWorkspace")}
          </button>
          <button className="palette-item" onClick={() => go("/projects")}>
            <FolderOpen size={14} /> {t("nav.projects")}
          </button>
          <button className="palette-item" onClick={() => go("/marketplace")}>
            <Store size={14} /> {t("shell.marketplace")}
          </button>
          <button className="palette-item" onClick={() => go("/academy")}>
            <BookOpen size={14} /> {t("nav.academy")}
          </button>

          <p style={{ margin: "6px 10px 4px", fontSize: 10.5, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700 }}>
            {t("commandPalette.groupActions")}
          </p>
          <button className="palette-item" onClick={() => go("/wizard")}>
            <Plus size={14} /> {t("commandPalette.newMission")}
          </button>
          <button
            className="palette-item"
            onClick={() => {
              signOut();
              go("/login");
            }}
          >
            <LogOut size={14} /> {t("commandPalette.signOut")}
          </button>

          {filteredMissions.length === 0 && query && (
            <p style={{ padding: "14px 10px", fontSize: 12.5, color: T.textMuted }}>{t("commandPalette.noResults")}</p>
          )}
        </div>
      </div>
    </>
  );
}
