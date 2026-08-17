import { Search, X, Sparkles } from "lucide-react";
import { T, alpha } from "../design/tokens";
import { useI18n } from "../i18n/I18nContext";
import { LocaleSwitcher } from "./LocaleSwitcher";

interface TopbarProps {
  query: string;
  onQueryChange: (value: string) => void;
}

export function Topbar({ query, onQueryChange }: TopbarProps) {
  const { t } = useI18n();
  return (
    <div
      style={{
        borderBottom: `1px solid ${T.border}`,
        padding: "14px 24px",
        display: "flex",
        alignItems: "center",
        gap: 16,
        position: "sticky",
        top: 0,
        zIndex: 30,
        background: `${alpha(T.bg, 95)}`,
        backdropFilter: "blur(14px)",
      }}
    >
      <div style={{ flexShrink: 0 }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: T.text, letterSpacing: "-0.01em" }}>
          {t("marketplace.title")}
        </h1>
        <p style={{ margin: "2px 0 0", fontSize: 11.5, color: T.textMuted }}>{t("marketplace.subtitle")}</p>
      </div>

      <div style={{ position: "relative", flex: 1, maxWidth: 460, marginLeft: "auto" }}>
        <Search size={14} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: T.textMuted, pointerEvents: "none" }} />
        <input
          className="search-input"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={t("marketplace.search.placeholder")}
          aria-label={t("marketplace.search.placeholder")}
        />
        {query && (
          <button
            onClick={() => onQueryChange("")}
            aria-label={t("marketplace.action.close")}
            style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: T.textMuted, cursor: "pointer", padding: 2, lineHeight: 1 }}
          >
            <X size={13} />
          </button>
        )}
      </div>

      <LocaleSwitcher />

      <button className="btn-primary" style={{ flexShrink: 0, fontSize: 13 }}>
        <Sparkles size={13} /> {t("marketplace.action.publish")}
      </button>
    </div>
  );
}
