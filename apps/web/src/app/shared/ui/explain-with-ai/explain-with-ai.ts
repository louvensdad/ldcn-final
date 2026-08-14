import { Component, input, output } from '@angular/core';
import { ExplainDecisionUsageDto } from '../../../core/api/assistant.client';
import { AppError } from '../../../core/errors/error-mapper';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ButtonComponent } from '../button/button';
import { ErrorStateComponent } from '../error-state/error-state';

export interface ExplainAiState {
  status: 'idle' | 'loading' | 'done' | 'error';
  explanation?: string;
  usage?: ExplainDecisionUsageDto;
  error?: AppError;
}

export const EXPLAIN_AI_IDLE: ExplainAiState = { status: 'idle' };

/**
 * Presentational only — the parent owns the actual HTTP call and state (same convention as every
 * `resource()` in this app: state management is never centralized in a shared service). This
 * only exists to stop repeating the idle/loading/done/error markup across the 3 screens that can
 * now explain a decision with AI (Architecture, Team, Task routing) — 2 occurrences didn't
 * justify extraction (see new-task-dialog's tab trap), 3 does.
 */
@Component({
  selector: 'app-explain-with-ai',
  imports: [TranslatePipe, ButtonComponent, ErrorStateComponent],
  templateUrl: './explain-with-ai.html',
  styleUrl: './explain-with-ai.scss',
})
export class ExplainWithAiComponent {
  readonly state = input.required<ExplainAiState>();
  readonly triggerExplain = output<void>();
  readonly retryExplain = output<void>();
}
