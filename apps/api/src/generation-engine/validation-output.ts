import { createHash } from 'node:crypto';

const SECRET_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/gi,
  /\b(?:authorization|api[_-]?key|password|secret|token|credential)\s*[:=]\s*[^\s]+/gi,
  /\bBearer\s+[A-Za-z0-9._~+\/-]+/gi,
  /\b(?:gh[pousr]_|github_pat_|sk-|AKIA)[A-Za-z0-9_\-]{8,}/g,
];

export function outputHash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function sanitizeValidationOutput(value: string, maxChars = 2000): string {
  let safe = value;
  for (const pattern of SECRET_PATTERNS) safe = safe.replace(pattern, '[REDACTED]');
  safe = safe.split(/\r?\n/).filter((line) => !/^\s*(?:export\s+)?[A-Za-z_][A-Za-z0-9_]*=/.test(line)).join('\n');
  return safe.slice(-maxChars);
}
