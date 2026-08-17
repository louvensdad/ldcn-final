import type { CSSProperties, ReactNode } from "react";
import { T, alpha } from "../../design/tokens";

/** Shared section-card shell used across Settings and the Company (WorkspaceAdminPage) pages. */
export function Card({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="stat-card">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, color: T.indigo }}>
        <span style={{ display: "grid", placeItems: "center", width: 28, height: 28, borderRadius: 8, background: alpha(T.indigo, 8) }}>{icon}</span>
        <h2 style={{ margin: 0, color: T.text, fontSize: 14 }}>{title}</h2>
      </div>
      {children}
    </section>
  );
}

export function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "10px 0", borderBottom: `1px solid ${T.border}` }}>
      <span style={{ color: T.textMuted, fontSize: 12.5 }}>{label}</span>
      <span style={{ color: T.textSub, fontSize: 12.5, fontFamily: mono ? "monospace" : "inherit", textAlign: "right" }}>{value}</span>
    </div>
  );
}

export const textStyle: CSSProperties = { margin: 0, color: T.textSub, fontSize: 13, lineHeight: 1.65 };
export const badgeStyle: CSSProperties = {
  display: "inline-flex", marginTop: 14, padding: "4px 9px", borderRadius: 99,
  color: T.emerald, background: alpha(T.emerald, 8), fontSize: 11, fontWeight: 700,
};
