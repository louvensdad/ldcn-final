import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { X, AlertTriangle } from "lucide-react";
import { T, alpha } from "../design/tokens";
import { useI18n } from "../i18n/I18nContext";
import { missionClient, type MissionSummaryDto } from "../api/mission.client";

/**
 * Notifications persistence doesn't exist yet (README "Fora de escopo ainda"), so this derives
 * real entries from the one signal the backend actually gives us: missions that are BLOCKED or
 * carry blockers. No static/fake notification list.
 */
export function NotificationPanel({ onClose }: { onClose: () => void }) {
  const { t, tn } = useI18n();
  const [missions, setMissions] = useState<MissionSummaryDto[] | null>(null);

  useEffect(() => {
    missionClient.list().then(setMissions).catch(() => setMissions([]));
  }, []);

  const blocked = (missions ?? []).filter((m) => m.generatorState === "BLOCKED" || m.blockers.length > 0);

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 30 }} />
      <div
        className="fade-in"
        style={{
          position: "absolute", top: 52, right: 16, width: 340,
          background: T.surfaceEl, border: `1px solid ${T.borderMid}`, borderRadius: 12,
          zIndex: 40, boxShadow: "0 16px 48px rgba(0,0,0,0.55)", overflow: "hidden",
        }}
      >
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{t("notifications.title")}</span>
            {blocked.length > 0 && (
              <span style={{ marginLeft: 7, background: alpha(T.red, 14), color: T.red, fontSize: 10.5, fontWeight: 700, padding: "1px 6px", borderRadius: 10 }}>
                {blocked.length}
              </span>
            )}
          </div>
          <button className="icon-btn" onClick={onClose}><X size={14} /></button>
        </div>

        <div style={{ maxHeight: 380, overflowY: "auto" }}>
          {missions === null && (
            <p style={{ padding: "24px 16px", fontSize: 12.5, color: T.textMuted, textAlign: "center" }}>{t("common.loading")}</p>
          )}
          {missions !== null && blocked.length === 0 && (
            <p style={{ padding: "24px 16px", fontSize: 12.5, color: T.textMuted, textAlign: "center" }}>{t("notifications.empty")}</p>
          )}
          {blocked.map((m) => (
            <Link key={m.missionId} to={`/missions/${m.missionId}`} className="notif-item" onClick={onClose}>
              <div style={{ display: "flex", gap: 10 }}>
                <AlertTriangle size={14} color={T.red} style={{ marginTop: 2, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: T.text, marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {m.rawUserIdea}
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: T.textMuted, lineHeight: 1.5 }}>
                    {m.blockers.length > 0 ? tn("notifications.blockersCount", m.blockers.length) : t("notifications.blockedState")}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
