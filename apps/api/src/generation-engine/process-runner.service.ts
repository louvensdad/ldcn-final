import { spawn, ChildProcess } from 'node:child_process';
import { Injectable } from '@nestjs/common';

export interface RunCommandResult {
  command: string;
  exitCode: number | null;
  durationMs: number;
  logsExcerpt: string;
}

export interface SecureRunCommandResult extends RunCommandResult {
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

const MAX_LOG_CHARS = 8000;

/**
 * MISSÃO "Completar o fluxo pós-PromptMaster até geração e entrega real" — Fase 17/20: build e
 * runtime têm que ser reais (child_process de verdade, exitCode real, log real) — nunca
 * `if package.json → npm para tudo` fingido. Este runner é stack-neutro (só executa comandos); o
 * StackPlugin (o scaffolder) é quem decide QUAIS comandos rodar para cada stack.
 */
@Injectable()
export class ProcessRunnerService {
  runCommand(command: string, args: string[], cwd: string, timeoutMs = 120_000): Promise<RunCommandResult> {
    const startedAt = Date.now();
    return new Promise((resolve) => {
      const child = spawn(command, args, { cwd, shell: process.platform === 'win32' });
      let logs = '';
      let settled = false;

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill();
        resolve({ command: `${command} ${args.join(' ')}`, exitCode: null, durationMs: Date.now() - startedAt, logsExcerpt: `${logs.slice(-MAX_LOG_CHARS)}\n[TIMEOUT após ${timeoutMs}ms]` });
      }, timeoutMs);

      child.stdout?.on('data', (chunk) => { logs += chunk.toString(); });
      child.stderr?.on('data', (chunk) => { logs += chunk.toString(); });
      child.on('error', (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ command: `${command} ${args.join(' ')}`, exitCode: null, durationMs: Date.now() - startedAt, logsExcerpt: `${logs.slice(-MAX_LOG_CHARS)}\n[ERROR: ${err.message}]` });
      });
      child.on('close', (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ command: `${command} ${args.join(' ')}`, exitCode: code, durationMs: Date.now() - startedAt, logsExcerpt: logs.slice(-MAX_LOG_CHARS) });
      });
    });
  }

  /** Sobe um processo de longa duração (runtime real) sem esperar ele terminar — quem chama é
   * responsável por checar saúde e, eventualmente, `stop()`. Sempre invocado com 'node' como
   * executável direto (nunca um script .cmd do npm) — sem `shell: true` de propósito: no Windows,
   * matar um processo iniciado via shell mata só o cmd.exe wrapper, deixando o node.exe real
   * (o servidor gerado) órfão e rodando para sempre (bug real encontrado e corrigido nesta sessão). */
  /** CORE-009: runner sem shell para profiles fixos da plataforma. */
  runCommandNoShell(command: string, args: string[], cwd: string, timeoutMs: number): Promise<SecureRunCommandResult> {
    const startedAt = Date.now();
    return new Promise((resolveResult) => {
      const child = spawn(command, args, { cwd, shell: false, windowsHide: true });
      let stdout = '';
      let stderr = '';
      let settled = false;
      let timer: ReturnType<typeof setTimeout>;
      const finish = (exitCode: number | null, timedOut: boolean): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        const logs = `${stdout}${stderr}`;
        resolveResult({ command: `${command} ${args.join(' ')}`, exitCode, durationMs: Date.now() - startedAt, logsExcerpt: logs.slice(-MAX_LOG_CHARS), stdout, stderr, timedOut });
      };
      timer = setTimeout(() => {
        child.kill();
        stderr += `\n[TIMEOUT after ${timeoutMs}ms]`;
        finish(null, true);
      }, timeoutMs);
      child.stdout?.on('data', (chunk) => { stdout += chunk.toString(); });
      child.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });
      child.on('error', (error) => { stderr += `\n[ERROR: ${error.message}]`; finish(null, false); });
      child.on('close', (code) => finish(code, false));
    });
  }

  startLongRunning(command: string, args: string[], cwd: string, env: Record<string, string>): ChildProcess {
    return spawn(command, args, { cwd, env: { ...process.env, ...env } });
  }

  stop(child: ChildProcess): void {
    child.kill();
  }
}
