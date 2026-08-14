import { TestBed } from '@angular/core/testing';
import { ExplainAiState, ExplainWithAiComponent } from './explain-with-ai';
import { AppError } from '../../../core/errors/error-mapper';

describe('ExplainWithAiComponent', () => {
  function setup(state: ExplainAiState) {
    const fixture = TestBed.createComponent(ExplainWithAiComponent);
    fixture.componentRef.setInput('state', state);
    fixture.detectChanges();
    return fixture;
  }

  it('shows a trigger button when idle and emits triggerExplain on click', () => {
    const fixture = setup({ status: 'idle' });
    const triggerSpy = vi.fn();
    fixture.componentInstance.triggerExplain.subscribe(triggerSpy);

    (fixture.nativeElement as HTMLElement).querySelector('button')?.dispatchEvent(new Event('click'));

    expect(triggerSpy).toHaveBeenCalledTimes(1);
  });

  it('shows a loading indicator while loading', () => {
    const fixture = setup({ status: 'loading' });
    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('AI analyzing');
  });

  it('shows the explanation and usage metadata when done', () => {
    const fixture = setup({
      status: 'done',
      explanation: 'Explicação de teste.',
      usage: { provider: 'deepseek', model: 'deepseek-chat', promptTokens: 10, completionTokens: 5, totalTokens: 15, latencyMs: 500 },
    });
    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('Explicação de teste.');
    expect(html).toContain('deepseek-chat');
    expect(html).toContain('15 tokens');
  });

  it('shows an error state and emits retryExplain', () => {
    const appError: AppError = { category: 'SERVER', status: 503, code: 'AI_EXPLANATION_UNAVAILABLE', translationKey: 'errors.5xx' };
    const fixture = setup({ status: 'error', error: appError });
    const retrySpy = vi.fn();
    fixture.componentInstance.retryExplain.subscribe(retrySpy);

    (fixture.nativeElement as HTMLElement).querySelector('button')?.dispatchEvent(new Event('click'));

    expect(retrySpy).toHaveBeenCalledTimes(1);
  });
});
