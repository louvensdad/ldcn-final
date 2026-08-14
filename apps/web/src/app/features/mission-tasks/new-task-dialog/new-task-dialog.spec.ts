import { TestBed } from '@angular/core/testing';
import { NewTaskDialogComponent } from './new-task-dialog';
import { TaskClient } from '../../../core/api/task.client';

describe('NewTaskDialogComponent', () => {
  function setup() {
    TestBed.configureTestingModule({
      imports: [NewTaskDialogComponent],
      providers: [{ provide: TaskClient, useValue: { classify: vi.fn() } }],
    });
    const fixture = TestBed.createComponent(NewTaskDialogComponent);
    fixture.componentRef.setInput('missionId', 'm-1');
    fixture.detectChanges();
    document.body.appendChild(fixture.nativeElement);
    return fixture;
  }

  function focusable(fixture: ReturnType<typeof setup>): HTMLElement[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [href], select:not([disabled]), [tabindex]:not([tabindex="-1"])'));
  }

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('has a labelled dialog role', () => {
    const fixture = setup();
    const dialog = (fixture.nativeElement as HTMLElement).querySelector('[role="dialog"]');
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.getAttribute('aria-labelledby')).toBe('new-task-dialog-title');
  });

  it('wraps Tab from the last focusable element back to the first', () => {
    const fixture = setup();
    const elements = focusable(fixture);
    const first = elements[0];
    const last = elements[elements.length - 1];
    last.focus();

    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    fixture.componentInstance.onKeydown(event);

    expect(document.activeElement).toBe(first);
  });

  it('wraps Shift+Tab from the first focusable element back to the last', () => {
    const fixture = setup();
    const elements = focusable(fixture);
    const first = elements[0];
    const last = elements[elements.length - 1];
    first.focus();

    const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    fixture.componentInstance.onKeydown(event);

    expect(document.activeElement).toBe(last);
  });

  it('emits closed with undefined on cancel', () => {
    const fixture = setup();
    const closedSpy = vi.fn();
    fixture.componentInstance.closed.subscribe(closedSpy);

    fixture.componentInstance.cancel();

    expect(closedSpy).toHaveBeenCalledWith(undefined);
  });
});
