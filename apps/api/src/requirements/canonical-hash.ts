import { createHash } from 'node:crypto';

/**
 * CORE-011 — mesmo algoritmo de serialização canônica de generation-engine/canonical-hash.ts,
 * duplicado deliberadamente (mesmo racional do CORE-004): domínio novo, não deve importar de
 * generation-engine, e a função é barata o bastante para duplicar sem risco.
 */
export function canonicalHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(sortKeysDeep(value))).digest('hex');
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((v) => sortKeysDeep(v));
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) sorted[key] = sortKeysDeep(record[key]);
    return sorted;
  }
  return value;
}
