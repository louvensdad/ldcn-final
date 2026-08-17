import { Search } from "lucide-react";
import { T } from "../design/tokens";
import { useI18n } from "../i18n/I18nContext";

export function EmptyState({ query }: { query: string }) {
  const { t } = useI18n();
  return (
    <div style={{ textAlign: "center", padding: "64px 24px", color: T.textMuted }}>
      <Search size={36} style={{ marginBottom: 14, opacity: 0.3 }} />
      <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 600, color: T.textSub }}>
        {query ? t("marketplace.empty.title_query", { query }) : t("marketplace.empty.title")}
      </p>
      <p style={{ margin: 0, fontSize: 13, color: T.textMuted }}>{t("marketplace.empty.subtitle")}</p>
    </div>
  );
}
