import { createServer, IncomingMessage, Server, ServerResponse } from 'node:http';
import { RuntimeApiController } from '../services';

export class RuntimeHttpServer {
  readonly server: Server;

  constructor(private readonly controller: RuntimeApiController) {
    this.server = createServer((request, response) => this.handle(request, response));
  }

  listen(port: number, host = '127.0.0.1'): Promise<void> {
    return new Promise((resolve, reject) => {
      const onError = (error: Error) => { this.server.off('listening', onListening); reject(error); };
      const onListening = () => { this.server.off('error', onError); resolve(); };
      this.server.once('error', onError);
      this.server.once('listening', onListening);
      this.server.listen(port, host);
    });
  }

  close(): Promise<void> {
    const closable = this.server as Server & { closeAllConnections?: () => void };
    closable.closeAllConnections?.();
    return new Promise((resolve, reject) => this.server.close((error) => error ? reject(error) : resolve()));
  }

  private handle(request: IncomingMessage, response: ServerResponse): void {
    if (request.method !== 'GET') { this.writeError(response, 405, 'METHOD_NOT_ALLOWED'); return; }
    const path = new URL(request.url ?? '/', 'http://localhost').pathname.split('/').filter(Boolean).map(decodeURIComponent);
    try {
      if (path.length === 3 && path[0] === 'missions' && path[2] === 'runtime') {
        this.writeJson(response, 200, this.controller.getMission({ missionId: path[1] }));
        return;
      }
      if (path.length === 5 && path[0] === 'missions' && path[2] === 'runtime' && path[3] === 'tasks') {
        this.writeJson(response, 200, this.controller.getTask({ missionId: path[1], taskId: path[4] }));
        return;
      }
      if (path.length === 4 && path[0] === 'missions' && path[2] === 'runtime' && path[3] === 'events') {
        this.writeJson(response, 200, this.controller.getEvents({ missionId: path[1] }));
        return;
      }
      this.writeError(response, 404, 'NOT_FOUND');
    } catch (error) {
      const code = error instanceof Error ? error.message : 'REQUEST_FAILED';
      const status = code.endsWith('_REQUIRED') ? 400 : 500;
      this.writeError(response, status, code);
    }
  }

  private writeJson(response: ServerResponse, status: number, value: unknown): void {
    const body = JSON.stringify(value);
    response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body) });
    response.end(body);
  }

  private writeError(response: ServerResponse, status: number, code: string): void {
    this.writeJson(response, status, { error: code });
  }
}
