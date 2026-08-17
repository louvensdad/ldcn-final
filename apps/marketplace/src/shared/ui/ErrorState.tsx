import { AlertTriangle } from "lucide-react";
import { T } from "../../design/tokens";
import { useI18n } from "../../i18n/I18nContext";
import type { AppError } from "../../api/errors";

export function ErrorState({ error, onRetry }: { error: AppError; onRetry?: () => void }) {
  const { t } = useI18n();
  return (
    <div style={{ textAlign: "center", padding: "48px 24px", color: T.textMuted }}>
      <AlertTriangle size={30} color={T.red} style={{ marginBottom: 12 }} />
      <p style={{ margin: "0 0 14px", fontSize: 14, color: T.textSub }}>{t(error.translationKey)}</p>
      {onRetry && (
        <button className="btn-ghost" onClick={onRetry}>
          {t("common.retry")}
        </button>
      )}
    </div>
  );
}
