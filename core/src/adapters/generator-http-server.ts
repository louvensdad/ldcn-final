import { createServer, IncomingMessage, Server, ServerResponse } from 'node:http';
import { IntentInput } from '../domain';
import { IntelligentGeneratorCommandService } from '../services';
import { createLocalGenerator } from '../services/local-persistence';
import { HttpSecurityGuard, HttpSecurityOptions } from './http-security';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface GeneratorHttpServerOptions {
  corsOrigin?: string;
  maxBodyBytes?: number;
  persistenceDirectory?: string;
  apiKey?: string;
  rateLimitPerMinute?: number;
}

/** Minimal HTTP transport for generation commands; NestJS can delegate to the same service. */
export class GeneratorHttpServer {
  readonly server: Server;
  private readonly options: { corsOrigin: string; maxBodyBytes: number; persistenceDirectory?: string };
  private readonly security: HttpSecurityGuard;

  constructor(commands?: IntelligentGeneratorCommandService, options: GeneratorHttpServerOptions = {}) {
    this.options = { corsOrigin: options.corsOrigin ?? '*', maxBodyBytes: options.maxBodyBytes ?? 1_000_000 };
    this.security = new HttpSecurityGuard(options satisfies HttpSecurityOptions);
    this.commands = commands ?? (options.persistenceDirectory ? createLocalGenerator(options.persistenceDirectory) : new IntelligentGeneratorCommandService());
    this.server = createServer((request, response) => this.handle(request, response));
  }

  private readonly commands: IntelligentGeneratorCommandService;

  listen(port: number, host = '127.0.0.1'): Promise<void> {
    return new Promise((resolve, reject) => {
      const onError = (error: Error) => { this.server.off('listening', onListening); reject(error); };
      const onListening = () => { this.server.off('error', onError); resolve(); };
      this.server.once('error', onError); this.server.once('listening', onListening); this.server.listen(port, host);
    });
  }

  close(): Promise<void> {
    const closable = this.server as Server & { closeAllConnections?: () => void };
    closable.closeAllConnections?.();
    return new Promise((resolve, reject) => this.server.close((error) => error ? reject(error) : resolve()));
  }

  private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname;
    this.addCors(response);
    if (request.method === 'OPTIONS') { response.writeHead(204); response.end(); return; }
    if (request.method === 'GET' && path === '/health') { this.write(response, 200, { status: 'ok' }); return; }
    if (!this.security.authorize(request, response)) return;
    if (request.method === 'GET' && (path === '/' || path === '/terminal')) { this.writeText(response, 200, readFileSync(join(process.cwd(), 'public', 'terminal.html'), 'utf8'), 'text/html; charset=utf-8'); return; }
    if (request.method === 'GET' && path === '/terminal.css') { this.writeText(response, 200, readFileSync(join(process.cwd(), 'public', 'terminal.css'), 'utf8'), 'text/css; charset=utf-8'); return; }
    if (request.method === 'GET' && path === '/terminal.js') { this.writeText(response, 200, readFileSync(join(process.cwd(), 'public', 'terminal.js'), 'utf8'), 'text/javascript; charset=utf-8'); return; }
    const missionMatch = path.match(/^\/missions\/([^/]+)\/(overview|events)$/);
    if (request.method === 'GET' && missionMatch) {
      const missionId = decodeURIComponent(missionMatch[1]);
      this.commands.restore(missionId);
      const queries = this.commands.createQueryService();
      if (missionMatch[2] === 'overview') {
        const overview = queries.getGeneratorOverview(missionId);
        if (!overview) { this.write(response, 404, { error: 'MISSION_NOT_FOUND' }); return; }
        this.write(response, 200, overview);
        return;
      }
      this.write(response, 200, queries.getDecisionEvents(missionId));
      return;
    }
    if (request.method !== 'POST' || path !== '/missions') { this.write(response, 404, { error: 'NOT_FOUND' }); return; }
    try {
      const contentType = request.headers['content-type'] ?? '';
      if (!contentType.toLowerCase().includes('application/json')) { this.write(response, 415, { error: 'CONTENT_TYPE_MUST_BE_JSON' }); return; }
      const input = JSON.parse(await this.readBody(request)) as IntentInput;
      if (!input || typeof input.missionId !== 'string' || typeof input.rawUserIdea !== 'string') { this.write(response, 400, { error: 'INVALID_INTENT_INPUT' }); return; }
      this.write(response, 201, this.commands.generate(input));
    } catch (error) {
      const code = error instanceof Error ? error.message : 'INVALID_REQUEST';
      this.write(response, code === 'GENERATOR_COMMAND_CONFLICT' ? 409 : 400, { error: code });
    }
  }

  private readBody(request: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = '';
      request.setEncoding('utf8');
      request.on('data', (chunk) => { body += chunk; if (body.length > this.options.maxBodyBytes) reject(new Error('REQUEST_TOO_LARGE')); });
      request.on('end', () => resolve(body)); request.on('error', reject);
    });
  }

  private write(response: ServerResponse, status: number, value: unknown): void {
    const body = JSON.stringify(value);
    response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body) });
    response.end(body);
  }
  private writeText(response: ServerResponse, status: number, body: string, contentType: string): void { response.writeHead(status, { 'content-type': contentType, 'content-length': Buffer.byteLength(body) }); response.end(body); }

  private addCors(response: ServerResponse): void {
    response.setHeader('access-control-allow-origin', this.options.corsOrigin);
    response.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
    response.setHeader('access-control-allow-headers', 'content-type,authorization');
  }
}
