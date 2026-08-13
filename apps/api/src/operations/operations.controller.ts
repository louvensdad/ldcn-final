import { Controller, Get, MessageEvent, NotFoundException, Param, Sse } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { EventBusService } from '../events/event-bus.service';
import { OperationPersistenceService } from './operation-persistence.service';

@Controller()
export class OperationsController {
  constructor(private readonly operations: OperationPersistenceService, private readonly eventBus: EventBusService) {}

  @Get('operations/:operationId')
  async get(@Param('operationId') operationId: string) {
    const operation = await this.operations.get(operationId);
    if (!operation) throw new NotFoundException('OPERATION_NOT_FOUND');
    return operation;
  }

  /** doc 42 §4 / doc 36 §67. Auth via ApiKeyGuard's `?apiKey=` fallback (EventSource can't set headers). */
  @Sse('stream')
  stream(): Observable<MessageEvent> {
    return this.eventBus.stream().pipe(map((event) => ({ data: event, type: event.type, id: event.id })));
  }
}
