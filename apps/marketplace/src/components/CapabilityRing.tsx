import { T, RING_DOMAINS } from "../design/tokens";

interface CapabilityRingProps {
  capabilities?: string[];
  size?: number;
}

/** SVG ring showing 8 capability domains — filled dot = domain present (spec §06). */
export function CapabilityRing({ capabilities = [], size = 44 }: CapabilityRingProps) {
  const r = size / 2 - 5;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }} aria-hidden="true">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={T.borderMid} strokeWidth="0.5" />
      {RING_DOMAINS.map((d, i) => {
        const angle = (i / RING_DOMAINS.length) * 2 * Math.PI - Math.PI / 2;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        const active = capabilities.some((cap) =>
          d.match.some((m) => cap.toLowerCase().includes(m) || m.includes(cap.toLowerCase().split(" ")[0])),
        );
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={active ? 3.8 : 2.2}
            fill={active ? T.indigo : T.borderStrong}
            opacity={active ? 1 : 0.32}
          />
        );
      })}
      <circle cx={cx} cy={cy} r={4.5} fill={T.surface} stroke={T.borderStrong} strokeWidth="0.5" />
    </svg>
  );
}
