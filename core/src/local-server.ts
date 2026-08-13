import { GeneratorHttpServer } from './adapters/generator-http-server';

const port = Number(process.env.LDCN_API_PORT ?? 3000);
const host = process.env.LDCN_API_HOST ?? '127.0.0.1';
const persistenceDirectory = process.env.LDCN_DATA_DIR ?? './data';
const apiKey = process.env.LDCN_API_KEY;

if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('LDCN_API_PORT_INVALID');

const server = new GeneratorHttpServer(undefined, {
  persistenceDirectory,
  corsOrigin: process.env.LDCN_CORS_ORIGIN ?? '*',
  apiKey,
  rateLimitPerMinute: process.env.LDCN_RATE_LIMIT ? Number(process.env.LDCN_RATE_LIMIT) : undefined,
});

server.listen(port, host).then(() => {
  console.log(`LDCN API ouvindo em http://${host}:${port}`);
  console.log(`Persistência local: ${persistenceDirectory}`);
}).catch((error) => { console.error(error); process.exitCode = 1; });

const shutdown = () => { void server.close().then(() => process.exit(0)); };
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
