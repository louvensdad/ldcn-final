import { T } from "../design/tokens";

interface TagRowProps {
  items: string[];
  color?: string;
  bg?: string;
  border?: string;
}

export function TagRow({ items, color, bg, border }: TagRowProps) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
      {items.map((s) => (
        <span
          key={s}
          style={{
            background: bg || T.surfaceHover,
            border: `1px solid ${border || T.border}`,
            color: color || T.textMuted,
            padding: "2px 8px",
            borderRadius: 5,
            fontSize: 11.5,
            fontWeight: 500,
          }}
        >
          {s}
        </span>
      ))}
    </div>
  );
}
