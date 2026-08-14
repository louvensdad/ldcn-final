import { TestBed } from '@angular/core/testing';
import { ErrorStateComponent } from './error-state';
import { AppError } from '../../../core/errors/error-mapper';

describe('ErrorStateComponent', () => {
  function setup(error: unknown) {
    const fixture = TestBed.createComponent(ErrorStateComponent);
    fixture.componentRef.setInput('error', error);
    fixture.detectChanges();
    return fixture;
  }

  it('shows the specific translated message for a mapped AppError', () => {
    const error: AppError = { category: 'RATE_LIMIT', status: 429, code: 'RATE_LIMITED', translationKey: 'errors.429' };
    const fixture = setup(error);

    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('Too many requests');
  });

  it('falls back to the generic message when the value is not an AppError', () => {
    const fixture = setup(null);

    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('Something went wrong');
  });

  it('emits retry when the button is pressed', () => {
    const error: AppError = { category: 'SERVER', status: 500, code: 'INTERNAL', translationKey: 'errors.5xx' };
    const fixture = setup(error);
    const retrySpy = vi.fn();
    fixture.componentInstance.retry.subscribe(retrySpy);

    (fixture.nativeElement as HTMLElement).querySelector('button')?.click();

    expect(retrySpy).toHaveBeenCalledTimes(1);
  });
});
