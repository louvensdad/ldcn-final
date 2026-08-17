import { matchesAnyPattern, normalizeScopePath } from './scope-path';

/**
 * CORE-007 — sempre protegidos, independente do que o Job específico declarar em
 * `forbiddenPaths` (defesa em profundidade — doc §11). Isto NÃO é a política completa de
 * Security/Workspace (fora de escopo desta CORE) — é só o piso mínimo que o ScopeValidator
 * nunca deixa passar, mesmo que o `JobScope` de um Job específico esqueça de listá-los.
 */
const GLOBAL_FORBIDDEN_PATHS = ['.git/**', 'node_modules/**', '.env', '.env.*'];

export type ChangeOperation = 'CREATE' | 'MODIFY' | 'REUSE' | 'NO_CHANGE';

export interface ScopeValidatorChangeInput {
  operation: ChangeOperation;
  path: string;
  /** Hash opcional do conteúdo que será materializado. Nunca contém o conteúdo bruto. */
  contentHash?: string;
}

export interface ScopeValidatorInput {
  allowedPaths: string[];
  forbiddenPaths: string[];
}

export interface ScopeValidationFinding {
  path: string;
  operation: ChangeOperation;
  rule: 'PATH_NORMALIZATION' | 'FORBIDDEN_PATH' | 'NOT_IN_ALLOWED_PATHS';
  reason: string;
}

export interface ScopeValidationResult {
  status: 'PASS' | 'SCOPE_VIOLATION';
  findings: ScopeValidationFinding[];
  /** doc §32 — nunca finge que módulo/símbolo foram validados quando não há enforcement real. */
  pathValidation: 'ENFORCED';
  moduleValidation: 'NOT_AVAILABLE';
  symbolValidation: 'NOT_AVAILABLE';
}

/**
 * Puro e determinístico — sem LLM, sem I/O, sem DB. Recebe o JobScope canônico (já resolvido) e
 * a lista COMPLETA de changes de um ChangeSetProposal, valida TODAS (doc §12), e aplica
 * all-or-nothing (doc §13): uma única change inválida reprova o ChangeSet inteiro.
 */
export class ScopeValidator {
  validate(scope: ScopeValidatorInput, changes: ScopeValidatorChangeInput[]): ScopeValidationResult {
    const findings: ScopeValidationFinding[] = [];

    for (const change of changes) {
      const normalized = normalizeScopePath(change.path);
      if (!normalized.ok) {
        findings.push({ path: change.path, operation: change.operation, rule: 'PATH_NORMALIZATION', reason: normalized.reason });
        continue;
      }

      if (matchesAnyPattern(GLOBAL_FORBIDDEN_PATHS, normalized.path) || matchesAnyPattern(scope.forbiddenPaths, normalized.path)) {
        findings.push({ path: change.path, operation: change.operation, rule: 'FORBIDDEN_PATH', reason: 'path matches a forbidden pattern' });
        continue;
      }

      if (!matchesAnyPattern(scope.allowedPaths, normalized.path)) {
        findings.push({ path: change.path, operation: change.operation, rule: 'NOT_IN_ALLOWED_PATHS', reason: 'path is not covered by any allowedPaths entry' });
      }
    }

    return {
      status: findings.length === 0 ? 'PASS' : 'SCOPE_VIOLATION',
      findings,
      pathValidation: 'ENFORCED',
      moduleValidation: 'NOT_AVAILABLE',
      symbolValidation: 'NOT_AVAILABLE',
    };
  }
}
