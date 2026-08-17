import { SecurityScannerService } from '../generation-engine/security-scanner.service';
import { ProcessRunnerService, RunCommandResult } from '../generation-engine/process-runner.service';

function fakeRunner(logsExcerpt: string, exitCode = 0): ProcessRunnerService {
  const result: RunCommandResult = { command: 'npm.cmd audit --json', exitCode, durationMs: 10, logsExcerpt };
  return { runCommand: async () => result } as unknown as ProcessRunnerService;
}

describe('SecurityScannerService.scanForSecrets', () => {
  const scanner = new SecurityScannerService({} as ProcessRunnerService);

  it('detecta uma AWS access key real', () => {
    const findings = scanner.scanForSecrets([{ path: 'src/x.ts', content: 'const key = "AKIAABCDEFGHIJKLMNOP";' }]);
    expect(findings).toHaveLength(1);
    expect(findings[0].pattern).toBe('AWS_ACCESS_KEY');
  });

  it('detecta um bloco de chave privada real', () => {
    const findings = scanner.scanForSecrets([{ path: 'src/x.ts', content: '-----BEGIN RSA PRIVATE KEY-----\nMIIEow...' }]);
    expect(findings.some((f) => f.pattern === 'PRIVATE_KEY_BLOCK')).toBe(true);
  });

  it('detecta uma credencial hardcoded real', () => {
    const findings = scanner.scanForSecrets([{ path: 'src/x.ts', content: `const apiKey = "sk_live_abcdefgh12345678";` }]);
    expect(findings.some((f) => f.pattern === 'HARDCODED_CREDENTIAL')).toBe(true);
  });

  it('nunca sinaliza process.env — essa é a forma correta de configurar segredo', () => {
    const findings = scanner.scanForSecrets([{ path: 'src/x.ts', content: `const apiKey = process.env.API_KEY ?? '';` }]);
    expect(findings).toHaveLength(0);
  });

  it('código real do scaffold (sem segredo nenhum) nunca gera falso positivo', () => {
    const findings = scanner.scanForSecrets([{ path: 'src/x.ts', content: `export class Foo { create(name: string) { return { id: 'x', name }; } }` }]);
    expect(findings).toHaveLength(0);
  });
});

describe('SecurityScannerService.runNpmAudit', () => {
  it('parseia um npm audit --json real corretamente', async () => {
    const scanner = new SecurityScannerService(fakeRunner(JSON.stringify({ metadata: { vulnerabilities: { critical: 0, high: 2, moderate: 7, low: 0, info: 0, total: 9 } } })));
    const result = await scanner.runNpmAudit('/fake/workspace');
    expect(result).toEqual({ ran: true, critical: 0, high: 2, moderate: 7, low: 0, errorCode: null });
  });

  it('saída truncada/cortada no meio do JSON nunca vira "sem vulnerabilidade" — fica honestamente "não rodou"', async () => {
    const scanner = new SecurityScannerService(fakeRunner('{"metadata": {"vulnerabilities": {"critical": 0, "hi'));
    const result = await scanner.runNpmAudit('/fake/workspace');
    expect(result.ran).toBe(false);
    expect(result.errorCode).toBe('AUDIT_PARSE_FAILED');
  });

  it('sobrevive ao corte real de MAX_LOG_CHARS (8000 chars) — o bloco grande "vulnerabilities" por pacote fica truncado, mas metadata.vulnerabilities (pequeno, no final) continua íntegro', async () => {
    // Reproduz o formato real observado: um documento gigante cujo início (o mapa de
    // vulnerabilidades por pacote) foi cortado pelo tail-slice do ProcessRunnerService, sobrando
    // só o fim do JSON — sem "{" de abertura correspondente, então JSON.parse do documento
    // inteiro falharia, mas metadata.vulnerabilities está intacto.
    const truncatedTail = `nome-do-pacote": { "name": "x", "severity": "high" } },\n  "metadata": {\n    "vulnerabilities": {\n      "info": 0,\n      "low": 1,\n      "moderate": 7,\n      "high": 2,\n      "critical": 0,\n      "total": 10\n    },\n    "dependencies": { "prod": 5 }\n  }\n}`;
    const scanner = new SecurityScannerService(fakeRunner(truncatedTail));
    const result = await scanner.runNpmAudit('/fake/workspace');
    expect(result).toEqual({ ran: true, critical: 0, high: 2, moderate: 7, low: 1, errorCode: null });
  });

  it('saída sem JSON nenhum nunca vira PASSED silencioso', async () => {
    const scanner = new SecurityScannerService(fakeRunner('npm ERR! network timeout'));
    const result = await scanner.runNpmAudit('/fake/workspace');
    expect(result.ran).toBe(false);
    expect(result.errorCode).toBe('AUDIT_NO_OUTPUT');
  });
});
