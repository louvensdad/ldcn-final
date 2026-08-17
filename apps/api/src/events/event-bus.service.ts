import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { Observable, Subject, config as rxjsConfig, filter } from 'rxjs';
import { FrontendEvent, FrontendEventType } from './frontend-event';
import { LiveEventEnvelope } from './live-event-envelope';

/**
 * In-process broadcaster for SSE (doc 42 §4). Single-process only, no Redis/fan-out — matches
 * the scope already cut in Slices 1-2 (no multi-instance concerns yet). A dropped connection
 * just misses events emitted while disconnected; there is no event replay/backlog for
 * `FrontendEvent` (CORE-006's `LiveEventEnvelope` stream has real replay via EventLog instead —
 * see EventLogService.listMissionEvents()).
 *
 * CORE-006: evoluído (não substituído) para também aceitar `LiveEventEnvelope` já persistido —
 * `emit()`/`stream()` continuam intocados para todo call site pré-existente.
 *
 * CORE-006 REWORK 01 — PRODUCER-STACK DECOUPLING:
 * `Subject.next()` do RxJS notifica subscribers SINCRONAMENTE, no mesmo call stack de quem
 * chamou `next()`. Isso significa que, sem tratamento, um subscriber lento/síncrono no stream de
 * envelope (ex.: uma UI que processa devagar, ou um handler mal-comportado) bloquearia o
 * AgentRuntime/GenerationEngine/LlmInvocationLedgerService durante `emitEnvelope()` — o produtor
 * ficaria preso no tempo do subscriber mais lento.
 *
 * Correção: `envelopeStream()`/`envelopeStreamForMission()` passam por `decouple()`, que agenda
 * a entrega de CADA notificação, PARA CADA subscriber, com seu próprio `setTimeout(...,0)` —
 * `emitEnvelope()` sempre retorna antes de qualquer subscriber real executar. Tentamos primeiro
 * `observeOn(asyncScheduler)` (a solução "de prateleira" sugerida pelo RxJS), mas um teste real
 * mostrou uma falha: o `AsyncScheduler.flush()` do RxJS recaptura o erro de UM subscriber que
 * lança, mas depois o RE-LANÇA e cancela as demais ações já agendadas no mesmo batch de flush —
 * ou seja, um subscriber quebrado podia derrubar entregas de outros subscribers e vazar uma
 * exceção não tratada pro timer do Node. `decouple()` evita isso: cada notificação entregue
 * dentro do seu próprio `try/catch` isolado, nunca compartilhando um batch de flush com outra.
 *
 * A garantia correta NUNCA é "um busy-wait em JS não afeta o event loop inteiro" (impossível num
 * único processo Node) — é PRODUCER-STACK DECOUPLING: o subscriber roda fora do call stack de
 * quem publicou o evento, e um erro nele nunca propaga de volta nem contamina outro subscriber.
 *
 * `emit()`/`stream()` (FrontendEvent legado) permanecem SÍNCRONOS de propósito nesta correção —
 * auditado: `architecture-review.service.test.ts` depende de entrega síncrona (assert logo após
 * `await review.start()`, sem nenhum tick de espera) e há ~20 call sites de `emit()` espalhados
 * pelo motor de geração; mudar o timing de entrega ali é risco de regressão real e desnecessário
 * (nenhum teste/uso atual de FrontendEvent tem um subscriber lento o bastante pra importar).
 *
 * Nota de implementação (§11 do rework): a primeira tentativa envolvia só `try/catch` ao redor
 * da entrega — insuficiente. RxJS's `Subscriber` já intercepta synchronamente um throw de um
 * `next`-only callback (sem `error` handler explícito) e NUNCA deixa escapar pro chamador — em
 * vez disso chama `reportUnhandledError`, que reagenda o throw via SEU PRÓPRIO `setTimeout`
 * separado, exatamente pra tornar o erro "alto" (nunca silencioso) por design do RxJS. Isso
 * escapava de qualquer `try/catch` local em volta de `subscriber.next()`. A correção real é
 * redirecionar esse canal global (`rxjs` `config.onUnhandledError`) pro logger — única vez, no
 * construtor deste serviço (singleton) — nunca mais um erro de subscriber vira exceção não
 * tratada em nenhum stream RxJS deste processo.
 */
@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);
  private readonly subject = new Subject<FrontendEvent>();
  private readonly envelopeSubject = new Subject<LiveEventEnvelope>();

  constructor() {
    rxjsConfig.onUnhandledError = (err: unknown) => {
      this.logger.error('envelope subscriber threw — isolated, producer and sibling subscribers unaffected', err instanceof Error ? err.stack : String(err));
    };
  }

  emit<T>(type: FrontendEventType, payload: T, refs: { missionId?: string; taskId?: string; operationId?: string } = {}): FrontendEvent<T> {
    const event: FrontendEvent<T> = { id: randomUUID(), type, occurredAt: new Date().toISOString(), payload, ...refs };
    this.subject.next(event);
    return event;
  }

  stream(): Observable<FrontendEvent> {
    return this.subject.asObservable();
  }

  /** CORE-006 §8/§9: nunca chamado antes do commit — quem publica (EventLogService) já garantiu
   * persist-first. Este método só distribui o fato já durável, e retorna sem nunca aguardar
   * (nem sincronamente executar) qualquer subscriber de aplicação — ver nota de decoupling acima. */
  emitEnvelope(envelope: LiveEventEnvelope): LiveEventEnvelope {
    this.envelopeSubject.next(envelope);
    return envelope;
  }

  envelopeStream(): Observable<LiveEventEnvelope> {
    return this.decouple(this.envelopeSubject.asObservable());
  }

  /** §12: isolamento de Mission — nunca a assinatura genérica devolve fato de outra Mission.
   * `filter` roda antes do decoupling (síncrono, mas é operador RxJS interno, não código de
   * aplicação — barato o bastante pra nunca justificar agendamento próprio). */
  envelopeStreamForMission(missionId: string): Observable<LiveEventEnvelope> {
    return this.decouple(this.envelopeSubject.asObservable().pipe(filter((event) => event.missionId === missionId)));
  }

  /**
   * Entrega cada notificação, para CADA subscriber independentemente, num `setTimeout(...,0)`
   * próprio — nunca compartilhando um batch de flush com outro subscriber (ver nota de classe).
   * Ordem preservada por subscriber (timers de mesmo delay disparam em ordem de agendamento no
   * Node). Um erro do subscriber é contido no próprio try/catch — nunca propaga pro produtor,
   * nunca derruba outro subscriber, nunca vira uncaughtException.
   */
  private decouple<T>(source: Observable<T>): Observable<T> {
    return new Observable<T>((subscriber) => {
      const upstream = source.subscribe({
        next: (value) => {
          setTimeout(() => {
            try {
              subscriber.next(value);
            } catch (err) {
              this.logger.error('envelope subscriber threw — isolated, producer and sibling subscribers unaffected', err instanceof Error ? err.stack : String(err));
            }
          }, 0);
        },
        error: (err) => subscriber.error(err),
        complete: () => subscriber.complete(),
      });
      return () => upstream.unsubscribe();
    });
  }
}
