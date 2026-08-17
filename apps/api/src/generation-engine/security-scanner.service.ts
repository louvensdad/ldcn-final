import { Injectable } from '@nestjs/common';
import { ProcessRunnerService } from './process-runner.service';

const NPM_CMD = process.platform === 'win32' ? 'npm.cmd' : 'npm';

export interface NpmAuditSummary {
  ran: boolean;
  critical: number;
  high: number;
  moderate: number;
  low: number;
  errorCode: string | null;
}

export interface SecretFinding {
  file: string;
  pattern: string;
  line: number;
}

const SECRET_PATTERNS: { name: string; regex: RegExp }[] = [
  { name: 'AWS_ACCESS_KEY', regex: /AKIA[0-9A-Z]{16}/ },
  { name: 'PRIVATE_KEY_BLOCK', regex: /-----BEGIN (RSA |EC )?PRIVATE KEY-----/ },
  // Segredo literal atribuído a uma var de nome sensível — nunca soa alarme para `process.env...`
  // (a forma correta de configurar segredo) nem para strings vazias/placeholder óbvios.
  { name: 'HARDCODED_CREDENTIAL', regex: /\b(password|secret|apiKey|api_key|token)\s*[:=]\s*['"](?!\s*['"]$)(?!process\.env)[^'"$]{8,}['"]/i },
];

/**
 * MISSÃO "Security Gate real antes da entrega" — "Ferramenta mede. Validator verifica." — checks
 * puramente determinísticos, nunca uma chamada de LLM para o que uma regex/ferramenta real já
 * resolve. `npm audit` real (a mesma rede que `npm install` já usa nesta pipeline) e um scan de
 * segredo por regex sobre o código real já escrito em disco.
 */
@Injectable()
export class SecurityScannerService {
  constructor(private readonly runner: ProcessRunnerService) {}

  async runNpmAudit(workspacePath: string): Promise<NpmAuditSummary> {
    const result = await this.runner.runCommand(NPM_CMD, ['audit', '--json'], workspacePath, 60_000);
    if (result.logsExcerpt.indexOf('{') === -1) {
      return { ran: false, critical: 0, high: 0, moderate: 0, low: 0, errorCode: 'AUDIT_NO_OUTPUT' };
    }
    // ProcessRunnerService só guarda os últimos 8000 chars do log (MAX_LOG_CHARS) — a árvore de
    // dependências completa do @nestjs facilmente produz mais JSON que isso, então o começo do
    // documento (o bloco grande `vulnerabilities` por pacote) é cortado e um JSON.parse do
    // documento inteiro falha. `metadata.vulnerabilities` (o único dado que este gate usa de
    // verdade) é um objeto pequeno e fica no FINAL do output real do npm — sobrevive ao corte.
    // Extrai só esse pedaço em vez de exigir o documento inteiro estar íntegro.
    const match = result.logsExcerpt.match(/"metadata"\s*:\s*\{[\s\S]*?"vulnerabilities"\s*:\s*(\{[^{}]*\})/);
    if (!match) {
      // Nunca vira "sem vulnerabilidade" silenciosamente — fica honestamente "não rodou".
      return { ran: false, critical: 0, high: 0, moderate: 0, low: 0, errorCode: 'AUDIT_PARSE_FAILED' };
    }
    try {
      const v = JSON.parse(match[1]) as Record<string, number>;
      return { ran: true, critical: v.critical ?? 0, high: v.high ?? 0, moderate: v.moderate ?? 0, low: v.low ?? 0, errorCode: null };
    } catch {
      return { ran: false, critical: 0, high: 0, moderate: 0, low: 0, errorCode: 'AUDIT_PARSE_FAILED' };
    }
  }

  scanForSecrets(files: { path: string; content: string }[]): SecretFinding[] {
    const findings: SecretFinding[] = [];
    for (const file of files) {
      const lines = file.content.split('\n');
      lines.forEach((line, i) => {
        for (const { name, regex } of SECRET_PATTERNS) {
          if (regex.test(line)) findings.push({ file: file.path, pattern: name, line: i + 1 });
        }
      });
    }
    return findings;
  }
}
