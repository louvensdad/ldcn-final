import type { ReactNode } from "react";
import { T } from "../../design/tokens";

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div style={{ textAlign: "center", padding: "56px 24px", color: T.textMuted }}>
      <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 600, color: T.textSub }}>{title}</p>
      {description && <p style={{ margin: "0 0 16px", fontSize: 13, color: T.textMuted }}>{description}</p>}
      {action}
    </div>
  );
}
