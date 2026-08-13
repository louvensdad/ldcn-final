import { EventBusService } from '../events/event-bus.service';
import { FrontendEvent } from '../events/frontend-event';

describe('EventBusService', () => {
  it('broadcasts emitted events to active subscribers with a generated id and timestamp', () => {
    const bus = new EventBusService();
    const received: FrontendEvent[] = [];
    const subscription = bus.stream().subscribe((event) => received.push(event));

    const emitted = bus.emit('operation.started', { type: 'GENERATE_MISSION' }, { missionId: 'm-1', operationId: 'op-1' });

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(emitted);
    expect(received[0].type).toBe('operation.started');
    expect(received[0].missionId).toBe('m-1');
    expect(received[0].operationId).toBe('op-1');
    expect(typeof received[0].id).toBe('string');
    expect(new Date(received[0].occurredAt).toString()).not.toBe('Invalid Date');

    subscription.unsubscribe();
  });

  it('does not deliver events to a subscriber that unsubscribed before the emit', () => {
    const bus = new EventBusService();
    const received: FrontendEvent[] = [];
    const subscription = bus.stream().subscribe((event) => received.push(event));
    subscription.unsubscribe();

    bus.emit('operation.failed', { errorCode: 'X' }, { missionId: 'm-1' });

    expect(received).toHaveLength(0);
  });
});
