/**
 * Design tokens shared by the whole app (spec §06), now theme-reactive: every value below is a
 * CSS custom property reference, not a literal color. The actual light/dark/system palettes are
 * defined once in design/theme.css against `:root` — switching themes never touches this file or
 * re-renders React, it just flips `document.documentElement.dataset.theme` and the cascade does
 * the rest. Keep the property names stable; dozens of components read `T.x` directly.
 */
export const T = {
  bg: "var(--background)",
  surface: "var(--surface)",
  surfaceEl: "var(--surface-elevated)",
  surfaceHover: "var(--surface-hover)",
  border: "var(--border)",
  borderMid: "var(--border-mid)",
  borderStrong: "var(--border-strong)",
  text: "var(--text-primary)",
  textSub: "var(--text-secondary)",
  textMuted: "var(--text-muted)",
  indigo: "var(--accent)",
  indigoHover: "var(--accent-hover)",
  indigoSoft: "var(--accent-soft)",
  violet: "var(--accent-2)",
  violetSoft: "var(--accent-2-soft)",
  cyan: "var(--info)",
  emerald: "var(--success)",
  amber: "var(--warning)",
  red: "var(--danger)",
} as const;

/**
 * Every place that used to splice a literal hex color with a trailing alpha suffix (e.g.
 * `${T.red}30`) needs this instead, now that T's values are `var(...)` references rather than
 * hex strings you can slice. `color-mix` has full support in current evergreen browsers.
 */
export function alpha(color: string, percent: number): string {
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}

export const PLANS = {
  free: { color: T.emerald, bg: alpha(T.emerald, 10) },
  basic: { color: T.indigoSoft, bg: alpha(T.indigo, 10) },
  advanced: { color: T.violetSoft, bg: alpha(T.violet, 10) },
  pro: { color: T.amber, bg: alpha(T.amber, 10) },
} as const;

/** 8 capability domains laid out around the CapabilityRing (spec §06). */
export const RING_DOMAINS: { match: string[] }[] = [
  { match: ["rest", "api", "grpc", "graphql"] },
  { match: ["database", "db", "sql", "orm", "prisma"] },
  { match: ["security", "auth", "owasp", "lgpd", "jwt"] },
  { match: ["test", "qa", "perf", "load"] },
  { match: ["ui", "component", "a11y", "seo", "css"] },
  { match: ["ci/cd", "infra", "docker", "k8s", "deploy"] },
  { match: ["mobile", "ios", "android", "flutter"] },
  { match: ["data", "pipeline", "ml", "analytics", "observability", "monitoring"] },
];
