import { createServer, IncomingMessage, Server, ServerResponse } from 'node:http';
import { RuntimeLifecycleCoordinator } from '../services';

/** HTTP command transport for the synchronous core runtime port. */
export class RuntimeExecutionHttpServer {
  readonly server: Server;
  constructor(private readonly coordinator: RuntimeLifecycleCoordinator) { this.server = createServer((request, response) => this.handle(request, response)); }
  listen(port: number, host = '127.0.0.1'): Promise<void> { return new Promise((resolve, reject) => { const onError = (e: Error) => { this.server.off('listening', onListening); reject(e); }; const onListening = () => { this.server.off('error', onError); resolve(); }; this.server.once('error', onError); this.server.once('listening', onListening); this.server.listen(port, host); }); }
  close(): Promise<void> { const server = this.server as Server & { closeAllConnections?: () => void }; server.closeAllConnections?.(); return new Promise((resolve, reject) => this.server.close((e) => e ? reject(e) : resolve())); }

  private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname.split('/').filter(Boolean).map(decodeURIComponent);
    try {
      if (request.method === 'POST' && path.length === 3 && path[0] === 'missions' && path[2] === 'executions') {
        const body = JSON.parse(await this.readBody(request)) as { decision: unknown; context: unknown };
        if (!body.decision || !body.context) return this.write(response, 400, { error: 'EXECUTION_INPUT_REQUIRED' });
        return this.write(response, 201, this.coordinator.dispatch({ missionId: path[1], decision: body.decision as never, context: body.context as never }));
      }
      if (request.method === 'POST' && path.length === 5 && path[0] === 'missions' && path[2] === 'executions' && path[4] === 'sync') {
        const result = this.coordinator.syncExecution({ missionId: path[1], taskId: path[3], executionId: (request.headers['x-execution-id'] ?? '') as string, routingDecisionId: (request.headers['x-routing-decision-id'] ?? '') as string });
        return this.write(response, 200, result);
      }
      if (request.method === 'POST' && path.length === 3 && path[0] === 'missions' && path[2] === 'gates') {
        const body = JSON.parse(await this.readBody(request)) as { decision: unknown; evidence: unknown[] };
        if (!body.decision || !Array.isArray(body.evidence)) return this.write(response, 400, { error: 'GATE_INPUT_REQUIRED' });
        return this.write(response, 200, this.coordinator.evaluateGates(body.decision as never, body.evidence as never));
      }
      if (request.method === 'POST' && path.length === 3 && path[0] === 'missions' && path[2] === 'repair-advisories') {
        const body = JSON.parse(await this.readBody(request)) as { approvedSolutionId: string; snapshot: unknown };
        if (!body.approvedSolutionId || !body.snapshot) return this.write(response, 400, { error: 'REPAIR_INPUT_REQUIRED' });
        return this.write(response, 201, this.coordinator.classifyAndAdviseRepair({ ...(body.snapshot as Record<string, unknown>), approvedSolutionId: body.approvedSolutionId } as never));
      }
      return this.write(response, 404, { error: 'NOT_FOUND' });
    } catch (error) { return this.write(response, 400, { error: error instanceof Error ? error.message : 'REQUEST_FAILED' }); }
  }
  private readBody(request: IncomingMessage): Promise<string> { return new Promise((resolve, reject) => { let body = ''; request.setEncoding('utf8'); request.on('data', (chunk) => { body += chunk; if (body.length > 1_000_000) reject(new Error('REQUEST_TOO_LARGE')); }); request.on('end', () => resolve(body)); request.on('error', reject); }); }
  private write(response: ServerResponse, status: number, value: unknown): void { const body = JSON.stringify(value); response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body) }); response.end(body); }
}
