import { T } from "../design/tokens";
import { CATEGORY_CONFIG, ALL_DATA } from "../data";
import type { MarketplaceCategory } from "../types";
import { useI18n } from "../i18n/I18nContext";

interface CategoryTabsProps {
  active: MarketplaceCategory;
  onChange: (id: MarketplaceCategory) => void;
}

export function CategoryTabs({ active, onChange }: CategoryTabsProps) {
  const { t } = useI18n();
  return (
    <div style={{ borderBottom: `1px solid ${T.border}`, padding: "0 20px", display: "flex", gap: 2, overflowX: "auto" }}>
      {CATEGORY_CONFIG.map((c) => (
        <button key={c.id} className={`stab${active === c.id ? " active" : ""}`} onClick={() => onChange(c.id)}>
          <c.Icon size={13.5} />
          {t(c.i18nKey)}
          <span style={{ background: T.borderMid, color: T.textMuted, fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 10 }}>
            {ALL_DATA[c.id].length}
          </span>
        </button>
      ))}
    </div>
  );
}
