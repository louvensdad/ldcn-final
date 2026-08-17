import { matchesAnyPattern, matchesGlobPattern, normalizeScopePath } from '../generation-engine/scope-path';
import { ScopeValidator } from '../generation-engine/scope-validator';

describe('CORE-007 normalizeScopePath', () => {
  it('E: an exact allowed path resolves normally', () => {
    expect(normalizeScopePath('src/app.module.ts')).toEqual({ ok: true, path: 'src/app.module.ts' });
  });

  it('I: ../ traversal is rejected', () => {
    expect(normalizeScopePath('../secret.txt')).toEqual({ ok: false, reason: 'PATH_TRAVERSAL' });
    expect(normalizeScopePath('src/../../secret.txt')).toEqual({ ok: false, reason: 'PATH_TRAVERSAL' });
  });

  it('J: absolute Unix path is rejected', () => {
    expect(normalizeScopePath('/etc/passwd')).toEqual({ ok: false, reason: 'ABSOLUTE_UNIX_PATH' });
  });

  it('K: Windows drive path is rejected', () => {
    expect(normalizeScopePath('C:\\Windows\\file')).toEqual({ ok: false, reason: 'WINDOWS_DRIVE_PATH' });
  });

  it('L: UNC path is rejected', () => {
    expect(normalizeScopePath('\\\\server\\share')).toEqual({ ok: false, reason: 'UNC_PATH' });
    expect(normalizeScopePath('//server/share')).toEqual({ ok: false, reason: 'UNC_PATH' });
  });

  it('rejects control characters and empty paths', () => {
    expect(normalizeScopePath('')).toEqual({ ok: false, reason: 'EMPTY_PATH' });
    expect(normalizeScopePath('src/\x00file.ts')).toEqual({ ok: false, reason: 'CONTROL_CHARACTERS' });
  });

  it('normalizes ./ and duplicated separators harmlessly', () => {
    expect(normalizeScopePath('./src//health/./health.controller.ts')).toEqual({ ok: true, path: 'src/health/health.controller.ts' });
  });

  it('unifies backslashes into forward slashes for relative paths', () => {
    expect(normalizeScopePath('src\\health\\health.controller.ts')).toEqual({ ok: true, path: 'src/health/health.controller.ts' });
  });
});

describe('CORE-007 matchesGlobPattern (§33 — case-sensitive, documented)', () => {
  it('F: a trailing ** glob matches nested files under the prefix', () => {
    expect(matchesGlobPattern('src/health/**', 'src/health/health.controller.ts')).toBe(true);
    expect(matchesGlobPattern('src/health/**', 'src/health/sub/deep.ts')).toBe(true);
    expect(matchesGlobPattern('src/health/**', 'src/health')).toBe(true);
  });

  it('G: a similar-prefix sibling directory never matches (segment-based, not string-prefix)', () => {
    expect(matchesGlobPattern('src/health/**', 'src/healthcare/x.ts')).toBe(false);
  });

  it('exact path matches only itself, not a suffixed variant', () => {
    expect(matchesGlobPattern('src/app.module.ts', 'src/app.module.ts')).toBe(true);
    expect(matchesGlobPattern('src/app.module.ts', 'src/app.module.spec.ts')).toBe(false);
  });

  it('single-segment * matches within a segment but never crosses /', () => {
    expect(matchesGlobPattern('.env.*', '.env.local')).toBe(true);
    expect(matchesGlobPattern('.env.*', '.env')).toBe(false);
    expect(matchesGlobPattern('src/*.ts', 'src/nested/file.ts')).toBe(false);
  });

  it('is case-sensitive by design (documented §33 — never depends on host filesystem)', () => {
    expect(matchesGlobPattern('src/Health/**', 'src/health/x.ts')).toBe(false);
  });
});

describe('CORE-007 ScopeValidator', () => {
  const validator = new ScopeValidator();
  const scope = { allowedPaths: ['src/health/**', 'src/app.module.ts'], forbiddenPaths: ['secrets/**'] };

  it('M: CREATE outside scope is rejected', () => {
    const result = validator.validate(scope, [{ operation: 'CREATE', path: 'src/users/users.service.ts' }]);
    expect(result.status).toBe('SCOPE_VIOLATION');
    expect(result.findings[0].rule).toBe('NOT_IN_ALLOWED_PATHS');
  });

  it('N: MODIFY outside scope is rejected', () => {
    const result = validator.validate(scope, [{ operation: 'MODIFY', path: 'src/users/users.service.ts' }]);
    expect(result.status).toBe('SCOPE_VIOLATION');
  });

  it('R: an in-scope change PASSes', () => {
    const result = validator.validate(scope, [{ operation: 'MODIFY', path: 'src/health/health.controller.ts' }]);
    expect(result.status).toBe('PASS');
    expect(result.findings).toHaveLength(0);
    expect(result.pathValidation).toBe('ENFORCED');
    expect(result.moduleValidation).toBe('NOT_AVAILABLE');
    expect(result.symbolValidation).toBe('NOT_AVAILABLE');
  });

  it('H: an explicitly forbidden path always wins over an allowed pattern', () => {
    const wideScope = { allowedPaths: ['src/**'], forbiddenPaths: ['src/secrets/**', '.env', '.env.*'] };
    const result = validator.validate(wideScope, [{ operation: 'MODIFY', path: 'src/secrets/keys.ts' }]);
    expect(result.status).toBe('SCOPE_VIOLATION');
    expect(result.findings[0].rule).toBe('FORBIDDEN_PATH');
  });

  it('global baseline forbidden paths always apply even if the Job scope forgets them', () => {
    const looseScope = { allowedPaths: ['**'], forbiddenPaths: [] };
    const result = validator.validate(looseScope, [{ operation: 'MODIFY', path: '.env' }]);
    expect(result.status).toBe('SCOPE_VIOLATION');
    expect(result.findings[0].rule).toBe('FORBIDDEN_PATH');
  });

  it('O: a mixed ChangeSet (2 valid + 1 invalid) rejects the WHOLE set — all-or-nothing', () => {
    const result = validator.validate(scope, [
      { operation: 'MODIFY', path: 'src/health/health.controller.ts' },
      { operation: 'MODIFY', path: 'src/app.module.ts' },
      { operation: 'CREATE', path: 'src/users/users.service.ts' },
    ]);
    expect(result.status).toBe('SCOPE_VIOLATION');
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].path).toBe('src/users/users.service.ts');
  });

  it('a path traversal attempt inside a change is caught before any allow/forbid comparison', () => {
    // 'src/../../secret.txt': só 1 segmento real ('src') pra "pagar" 2 '..' — escapa do root
    // lógico de verdade (diferente de 'src/health/../../secret.txt', que tem 2 segmentos reais
    // e resolve de forma segura, sem escapar, para 'secret.txt').
    const result = validator.validate(scope, [{ operation: 'MODIFY', path: 'src/../../secret.txt' }]);
    expect(result.status).toBe('SCOPE_VIOLATION');
    expect(result.findings[0].rule).toBe('PATH_NORMALIZATION');
  });

  it('NO_CHANGE with an out-of-scope path is still rejected (path validated even without materialization)', () => {
    const result = validator.validate(scope, [{ operation: 'NO_CHANGE', path: 'src/users/users.service.ts' }]);
    expect(result.status).toBe('SCOPE_VIOLATION');
  });

  it('matchesAnyPattern is a thin convenience over matchesGlobPattern', () => {
    expect(matchesAnyPattern(['src/**'], 'src/x.ts')).toBe(true);
    expect(matchesAnyPattern(['src/**'], 'other/x.ts')).toBe(false);
  });
});
