import 'reflect-metadata';
import { join } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// infra/.env holds DATABASE_URL, LDCN_API_KEY, etc. dotenv never overrides vars already set
// (docker/CI can still inject its own), so this is a convenience default for local dev.
loadEnv({ path: join(__dirname, '..', '..', '..', 'infra', '.env') });

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { cors: { origin: process.env.LDCN_CORS_ORIGIN ?? '*' } });
  const port = Number(process.env.LDCN_API_PORT ?? 3000);
  const host = process.env.LDCN_API_HOST ?? '127.0.0.1';
  await app.listen(port, host);
  // eslint-disable-next-line no-console
  console.log(`LDCN Platform API ouvindo em http://${host}:${port}`);
}

bootstrap();
