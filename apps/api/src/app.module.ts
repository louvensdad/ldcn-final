import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { GeneratorModule } from './generator/generator.module';
import { RuntimeModule } from './runtime/runtime.module';
import { RoutingModule } from './routing/routing.module';
import { OperationsModule } from './operations/operations.module';
import { OverviewModule } from './overview/overview.module';
import { HealthController } from './health/health.controller';
import { ApiKeyGuard } from './security/api-key.guard';
import { DomainErrorFilter } from './security/domain-error.filter';

@Module({
  imports: [GeneratorModule, RuntimeModule, RoutingModule, OperationsModule, OverviewModule],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ApiKeyGuard },
    { provide: APP_FILTER, useClass: DomainErrorFilter },
  ],
})
export class AppModule {}
