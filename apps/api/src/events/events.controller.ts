import { Controller, Get, MessageEvent, Param, Query, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import { EventBusService } from './event-bus.service';
import { EventLogService } from './event-log.service';

/**
 * CORE-006 §11 — evolui o padrão SSE já existente (`OperationsController.stream()`, mesmo
 * `EventBusService`) para um stream mission-scoped com replay real. Autorização/ownership: a
 * mesma `ApiKeyGuard` global já aplicada a todo controller (app.module.ts) — este app não é
 * multi-tenant, não há ownership por Mission além disso hoje.
 */
@Controller('missions/:missionId/events')
export class EventsController {
  constructor(private readonly eventBus: EventBusService, private readonly eventLog: EventLogService) {}

  /** §10 — replay puro (sem stream), útil para polling/depuração. */
  @Get()
  async listEvents(@Param('missionId') missionId: string, @Query('afterSequence') afterSequence?: string, @Query('limit') limit?: string) {
    return this.eventLog.listMissionEvents({
      missionId,
      afterSequence: afterSequence ? Number(afterSequence) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('live-status')
  async getLiveStatus(@Param('missionId') missionId: string) {
    return this.eventLog.getMissionLiveStatus(missionId);
  }

  /**
   * §11/§21 — ao conectar: 1) replay dos eventos perdidos (afterSequence via query, já que
   * EventSource do browser não permite header Last-Event-ID customizado sem lib extra — mesma
   * limitação documentada no `?apiKey=` fallback do ApiKeyGuard); 2) subscription live filtrada
   * por Mission (§12 — nunca vaza evento de outra Mission); 3) dedupe natural por `sequence`
   * (cliente já viu tudo <= afterSequence, replay começa estritamente depois).
   */
  @Sse('stream')
  stream(@Param('missionId') missionId: string, @Query('afterSequence') afterSequence?: string): Observable<MessageEvent> {
    const after = afterSequence ? Number(afterSequence) : 0;

    return new Observable<MessageEvent>((subscriber) => {
      let lastSentSequence = after;
      let closed = false;

      // A subscription live começa IMEDIATAMENTE (nunca perde um evento publicado entre o
      // replay e o momento de inscrição), mas seus eventos ficam em buffer até o replay
      // terminar — só então tudo é liberado em ordem estrita de sequence, sem duplicar o que
      // já veio no replay (§21 — reconnect não duplica; ordem sempre por sequence, nunca timestamp).
      const buffered: MessageEvent[] = [];
      let replaying = true;
      const liveSub = this.eventBus.envelopeStreamForMission(missionId).subscribe((envelope) => {
        if (closed) return;
        const message: MessageEvent = { data: envelope, type: envelope.type, id: String(envelope.sequence) };
        if (replaying) {
          buffered.push(message);
        } else if (envelope.sequence > lastSentSequence) {
          lastSentSequence = envelope.sequence;
          subscriber.next(message);
        }
      });

      this.eventLog
        .listMissionEvents({ missionId, afterSequence: after })
        .then((events) => {
          if (closed) return;
          for (const envelope of events) {
            subscriber.next({ data: envelope, type: envelope.type, id: String(envelope.sequence) });
            lastSentSequence = envelope.sequence;
          }
          replaying = false;
          for (const message of buffered) {
            if (Number(message.id) > lastSentSequence) {
              lastSentSequence = Number(message.id);
              subscriber.next(message);
            }
          }
        })
        .catch((err) => subscriber.error(err));

      return () => {
        closed = true;
        liveSub.unsubscribe();
      };
    });
  }
}
