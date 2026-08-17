import { T } from "../../design/tokens";

export function Skeleton({ height = 16, width = "100%" }: { height?: number; width?: number | string }) {
  return (
    <div
      style={{
        height,
        width,
        borderRadius: 6,
        background: `linear-gradient(90deg, ${T.surfaceEl} 25%, ${T.surfaceHover} 50%, ${T.surfaceEl} 75%)`,
        backgroundSize: "200% 100%",
        animation: "skeleton-pulse 1.4s ease-in-out infinite",
      }}
    />
  );
}
