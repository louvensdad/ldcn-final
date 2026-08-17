import { useParams } from "react-router-dom";
import { T } from "../design/tokens";
import { useI18n } from "../i18n/I18nContext";
import { MissionNav } from "../shared/ui/MissionNav";

/** Honest boundary for a view that has no corresponding API read model yet. */
export function ComingSoon({ labelKey }: { labelKey: string }) {
  const { missionId } = useParams<{ missionId: string }>();
  const { t } = useI18n();

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
      {missionId && <MissionNav missionId={missionId} />}
      <div style={{ textAlign: "center", padding: "48px 24px", color: T.textMuted }}>
        <p style={{ margin: 0, fontSize: 14 }}>{t(labelKey)} — aguardando read model da Platform API.</p>
        <p style={{ margin: "10px auto 0", maxWidth: 420, fontSize: 12.5, lineHeight: 1.6 }}>A interface não exibe dados simulados. Assim que o contrato dessa área estiver disponível, ela poderá ser conectada sem mudar a navegação.</p>
      </div>
    </div>
  );
}
