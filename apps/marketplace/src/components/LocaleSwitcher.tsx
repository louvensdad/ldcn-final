import { SUPPORTED_LOCALES, useI18n } from "../i18n/I18nContext";
import type { Locale } from "../types";

export function LocaleSwitcher() {
  const { locale, setLocale, t } = useI18n();
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span className="sr-only">{t("marketplace.locale.label")}</span>
      <select
        className="locale-select"
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        aria-label={t("marketplace.locale.label")}
      >
        {SUPPORTED_LOCALES.map((l) => (
          <option key={l.id} value={l.id}>
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}
