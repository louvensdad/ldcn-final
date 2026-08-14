import { TestBed } from '@angular/core/testing';
import { StageRailComponent } from './stage-rail';

describe('StageRailComponent', () => {
  function statusesFor(generatorState: string | undefined): Record<string, string> {
    const fixture = TestBed.createComponent(StageRailComponent);
    fixture.componentRef.setInput('generatorState', generatorState);
    fixture.detectChanges();
    const result: Record<string, string> = {};
    for (const stage of fixture.componentInstance['stages']) {
      result[stage.key] = fixture.componentInstance.status(stage);
    }
    return result;
  }

  it('marks every stage pending when there is no generatorState yet', () => {
    expect(statusesFor(undefined)).toEqual({
      intent: 'pending',
      requirements: 'pending',
      topology: 'pending',
      solution: 'pending',
      architecture: 'pending',
      team: 'pending',
      pipeline: 'pending',
      ready: 'pending',
    });
  });

  it('marks earlier stages done and the matching stage current for a mid-sequence state', () => {
    const statuses = statusesFor('SOLUTION_PROPOSED');
    expect(statuses['intent']).toBe('done');
    expect(statuses['requirements']).toBe('done');
    expect(statuses['topology']).toBe('done');
    expect(statuses['solution']).toBe('current');
    expect(statuses['architecture']).toBe('pending');
  });

  it('marks every known stage done or current for READY_FOR_EXECUTION', () => {
    const statuses = statusesFor('READY_FOR_EXECUTION');
    expect(statuses['intent']).toBe('done');
    expect(statuses['pipeline']).toBe('done');
    expect(statuses['ready']).toBe('current');
  });

  it('falls back to pending for an unrecognized state like BLOCKED (never guesses which stage failed)', () => {
    const statuses = statusesFor('BLOCKED');
    expect(Object.values(statuses).every((status) => status === 'pending')).toBe(true);
  });
});
