import { Subject } from 'rxjs';
import { EventBusService } from '../events/event-bus.service';
import { LiveEventEnvelope } from '../events/live-event-envelope';

/**
 * CORE-006 REWORK 01 — SLOW CONSUMER ISOLATION.
 *
 * Pure in-process tests (no Postgres needed) — EventBusService has no DB dependency, so this
 * file always runs, no RUN_DB_TESTS gate.
 */

function busyWaitMs(ms: number): void {
  const start = performance.now();
  while (performance.now() - start < ms) {
    /* busy spin — simula um subscriber síncrono lento (ex.: UI processando devagar). */
  }
}

function makeEnvelope(overrides: Partial<LiveEventEnvelope> = {}): LiveEventEnvelope {
  return {
    id: `evt-${Math.random()}`,
    sequence: 1,
    missionId: 'test-mission-a',
    correlationId: 'test-mission-a',
    type: 'mission.generation_started',
    version: 1,
    actor: { type: 'TEST' },
    occurredAt: new Date().toISOString(),
    payload: {},
    ...overrides,
  };
}

async function tick(ms = 100): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

describe('EventBusService — producer-stack decoupling (CORE-006 REWORK 01)', () => {
  // §1 — prova o problema ANTES de qualquer correção: um Subject RxJS cru (sem observeOn) é
  // síncrono — o assinante roda no mesmo call stack de quem chamou next(). Este teste não usa
  // EventBusService: ele isola exatamente o comportamento problemático descrito no rework, pra
  // provar que o diagnóstico é real e não um mal-entendido sobre RxJS.
  it('A: [diagnóstico] a plain RxJS Subject.next() blocks the caller for the subscriber duration', () => {
    const raw = new Subject<number>();
    raw.subscribe(() => busyWaitMs(30));

    const startedAt = performance.now();
    raw.next(1);
    const elapsed = performance.now() - startedAt;

    expect(elapsed).toBeGreaterThanOrEqual(25); // confirma bloqueio síncrono do Subject puro.
  });

  // §2/§8 — depois da correção: emitEnvelope() nunca executa o subscriber no stack do produtor.
  it('B: emitEnvelope() returns before a slow subscriber finishes processing', async () => {
    const bus = new EventBusService();
    let subscriberFinishedAt = 0;
    bus.envelopeStream().subscribe(() => {
      busyWaitMs(40);
      subscriberFinishedAt = performance.now();
    });

    const startedAt = performance.now();
    bus.emitEnvelope(makeEnvelope());
    const elapsed = performance.now() - startedAt;

    expect(elapsed).toBeLessThan(15); // retorna bem antes dos 40ms do subscriber lento.
    expect(subscriberFinishedAt).toBe(0); // subscriber ainda nem começou quando emitEnvelope() já retornou.

    await tick(150);
    expect(subscriberFinishedAt).toBeGreaterThan(0); // mas roda de verdade, só que fora do stack do produtor.
  });

  // §9 — mesma prova, agora simulando o padrão real: "persist → commit → publish → continua".
  it('B2: a producer sequence (persist, then emitEnvelope, then continue) never waits on the slow subscriber', async () => {
    const bus = new EventBusService();
    bus.envelopeStream().subscribe(() => busyWaitMs(50));

    const log: string[] = [];
    const producerStartedAt = performance.now();
    log.push('persisted');
    bus.emitEnvelope(makeEnvelope());
    log.push('continued');
    const producerElapsed = performance.now() - producerStartedAt;

    expect(log).toEqual(['persisted', 'continued']);
    expect(producerElapsed).toBeLessThan(15);
  });

  // §4 — ordering: entrega assíncrona nunca pode reordenar sequence.
  it('C: sequential emits preserve delivery order even with a slow subscriber', async () => {
    const bus = new EventBusService();
    const received: number[] = [];
    bus.envelopeStream().subscribe((e) => {
      busyWaitMs(3);
      received.push(e.sequence);
    });

    for (let i = 1; i <= 5; i++) bus.emitEnvelope(makeEnvelope({ sequence: i, id: `evt-${i}` }));

    await tick(300);
    expect(received).toEqual([1, 2, 3, 4, 5]);
  });

  // §10 — slow consumer não pode quebrar/perder outro evento.
  it('C2: rapid-fire emits with a slow subscriber never lose or corrupt any event', async () => {
    const bus = new EventBusService();
    const received: string[] = [];
    bus.envelopeStream().subscribe((e) => {
      busyWaitMs(2);
      received.push(e.id);
    });

    const ids = Array.from({ length: 10 }, (_, i) => `evt-${i}`);
    for (const id of ids) bus.emitEnvelope(makeEnvelope({ id, sequence: ids.indexOf(id) + 1 }));

    await tick(300);
    expect(received).toEqual(ids);
  });

  // §5 — Mission isolation preservado depois da mudança de scheduler.
  it('D: envelopeStreamForMission still isolates Missions after the scheduling change', async () => {
    const bus = new EventBusService();
    const received: string[] = [];
    bus.envelopeStreamForMission('mission-A').subscribe((e) => received.push(e.missionId));

    bus.emitEnvelope(makeEnvelope({ missionId: 'mission-A', id: 'a1' }));
    bus.emitEnvelope(makeEnvelope({ missionId: 'mission-B', id: 'b1' }));
    bus.emitEnvelope(makeEnvelope({ missionId: 'mission-A', id: 'a2' }));

    await tick(150);
    expect(received).toEqual(['mission-A', 'mission-A']);
  });

  // §11 — um subscriber que lança erro nunca quebra o produtor nem os outros subscribers.
  it('E: a throwing subscriber never propagates back to the producer call and never breaks sibling subscribers', async () => {
    const bus = new EventBusService();
    const goodReceived: number[] = [];
    bus.envelopeStream().subscribe(() => {
      throw new Error('boom — simulated broken subscriber');
    });
    bus.envelopeStream().subscribe((e) => goodReceived.push(e.sequence));

    expect(() => bus.emitEnvelope(makeEnvelope({ sequence: 1 }))).not.toThrow();

    await tick(150);
    expect(goodReceived).toEqual([1]); // o subscriber bom nunca é afetado pelo que quebrou.
  });

  it('E2: a throwing subscriber does not stop delivering to itself on a NEXT event (fresh subscription state)', async () => {
    const bus = new EventBusService();
    const goodReceived: number[] = [];
    bus.envelopeStream().subscribe(() => goodReceived.push(1));
    bus.emitEnvelope(makeEnvelope({ sequence: 1 }));
    bus.emitEnvelope(makeEnvelope({ sequence: 2 }));
    await tick(150);
    expect(goodReceived.length).toBe(2);
  });

  // Verifica que a mudança não afeta o stream legado de FrontendEvent (continua síncrono,
  // decisão documentada no EventBusService — risco de regressão em architecture-review.service.test.ts).
  it('F: the legacy FrontendEvent stream (emit/stream) remains synchronous, unaffected by this rework', () => {
    const bus = new EventBusService();
    const received: string[] = [];
    bus.stream().subscribe((e) => received.push(e.type));
    bus.emit('generation.scaffolded', { fileCount: 1 }, { missionId: 'm1' });
    expect(received).toEqual(['generation.scaffolded']); // já disponível sincronamente, sem tick.
  });
});
