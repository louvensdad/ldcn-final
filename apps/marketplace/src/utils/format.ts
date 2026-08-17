export function fmt(n: number | null | undefined): string {
  if (n == null || n === 0) return "—";
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

export function localize<T extends { localizedContent: Partial<Record<string, { name: string; description: string }>> }>(
  item: T,
  locale: string,
): { name: string; description: string } {
  return (
    item.localizedContent[locale] ??
    item.localizedContent["pt-BR"] ??
    { name: "", description: "" }
  );
}
