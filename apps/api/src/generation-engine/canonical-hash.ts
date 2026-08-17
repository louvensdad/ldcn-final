import { createHash } from 'node:crypto';

/**
 * CORE-004 — mesmo algoritmo de serialização canônica do PromptCompiler (CORE-003), duplicado
 * deliberadamente aqui em vez de importado: extrair um util compartilhado tocaria em
 * prompt-compiler.ts (CORE-003, não deve ser reimplementado); esta função pura de ~10 linhas é
 * mais barata de duplicar do que arriscar uma regressão em código já congelado.
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
