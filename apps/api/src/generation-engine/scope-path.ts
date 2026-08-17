/**
 * CORE-007 §6/§7/§8/§33 — normalização e matching de path, puros e determinísticos. Nunca
 * dependem do filesystem host (comparação lógica sempre case-sensitive — documentado: um
 * ambiente futuro Windows/Linux nunca deve mudar o resultado de uma validação de escopo).
 */

export type PathNormalizationResult = { ok: true; path: string } | { ok: false; reason: string };

const CONTROL_CHAR_RE = /[\x00-\x1f]/;
const WINDOWS_DRIVE_RE = /^[a-zA-Z]:[\\/]/;

/**
 * Normaliza um path relativo ao workspace root, rejeitando qualquer forma de escape:
 * traversal (`../`), paths absolutos Unix, drive paths Windows, UNC paths, caracteres de
 * controle. Nunca lança — sempre retorna um resultado tipado (`ok:false` com `reason`), pra
 * quem chama decidir o que fazer (nesta CORE: sempre SCOPE_PATH_INVALID).
 */
export function normalizeScopePath(rawPath: string): PathNormalizationResult {
  if (typeof rawPath !== 'string' || rawPath.length === 0) return { ok: false, reason: 'EMPTY_PATH' };
  if (CONTROL_CHAR_RE.test(rawPath)) return { ok: false, reason: 'CONTROL_CHARACTERS' };
  // Verificados ANTES de qualquer normalização de separador — uma vez unificado pra "/", um
  // drive path (`C:\...`) ou UNC (`\\server\...`) ficaria indistinguível de um path relativo
  // começando por "C:" ou de dois separadores duplicados, então a rejeição tem que vir primeiro.
  if (WINDOWS_DRIVE_RE.test(rawPath)) return { ok: false, reason: 'WINDOWS_DRIVE_PATH' };
  if (rawPath.startsWith('\\\\') || rawPath.startsWith('//')) return { ok: false, reason: 'UNC_PATH' };
  if (rawPath.startsWith('/')) return { ok: false, reason: 'ABSOLUTE_UNIX_PATH' };

  const unified = rawPath.replace(/\\/g, '/');
  const rawSegments = unified.split('/');
  const resolved: string[] = [];
  for (const segment of rawSegments) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      // Nunca permite resolver acima do root lógico — mesmo "src/../../secret.txt" (que só
      // "empata" no root em vez de ir claramente negativo) é rejeitado, não silenciosamente
      // clampado a root.
      if (resolved.length === 0) return { ok: false, reason: 'PATH_TRAVERSAL' };
      resolved.pop();
      continue;
    }
    resolved.push(segment);
  }
  if (resolved.length === 0) return { ok: false, reason: 'EMPTY_PATH' };
  return { ok: true, path: resolved.join('/') };
}

/** Compara um segmento de path candidato contra um segmento de padrão que pode conter `*`
 * (curinga dentro do segmento, nunca cruza `/`). Sem `*`: comparação exata. */
function matchSegment(patternSegment: string, candidateSegment: string): boolean {
  if (!patternSegment.includes('*')) return patternSegment === candidateSegment;
  const escaped = patternSegment
    .split('*')
    .map((part) => part.replace(/[.+^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${escaped}$`).test(candidateSegment);
}

/**
 * Matching determinístico de glob por segmentos — `**` casa zero ou mais segmentos inteiros
 * (nunca prefixo ingênuo de string: `src/health/**` nunca casa `src/healthcare/x.ts`, porque
 * "health" e "healthcare" são comparados como segmentos inteiros, não como prefixo).
 */
export function matchesGlobPattern(pattern: string, candidatePath: string): boolean {
  return matchSegments(pattern.split('/'), candidatePath.split('/'));
}

function matchSegments(patternSegments: string[], pathSegments: string[]): boolean {
  if (patternSegments.length === 0) return pathSegments.length === 0;
  const [head, ...restPattern] = patternSegments;

  if (head === '**') {
    if (restPattern.length === 0) return true; // ** final: casa o que sobrar, inclusive nada.
    for (let skip = 0; skip <= pathSegments.length; skip++) {
      if (matchSegments(restPattern, pathSegments.slice(skip))) return true;
    }
    return false;
  }

  if (pathSegments.length === 0) return false;
  const [pathHead, ...restPath] = pathSegments;
  if (!matchSegment(head, pathHead)) return false;
  return matchSegments(restPattern, restPath);
}

/** `pattern` pode ser um path exato ou conter `*`/`**` — ambos aceitos pelo mesmo matcher. */
export function matchesAnyPattern(patterns: string[], candidatePath: string): boolean {
  return patterns.some((pattern) => {
    const normalizedPattern = pattern.replace(/\\/g, '/');
    return matchesGlobPattern(normalizedPattern, candidatePath);
  });
}
