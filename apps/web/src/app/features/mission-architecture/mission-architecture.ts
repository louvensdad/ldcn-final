import { Component, inject, input, resource, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ArchitectureClient } from '../../core/api/architecture.client';
import { AssistantClient } from '../../core/api/assistant.client';
import { AppError } from '../../core/errors/error-mapper';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { MissionNavComponent } from '../../shared/ui/mission-nav/mission-nav';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state';
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton';
import { EXPLAIN_AI_IDLE, ExplainAiState, ExplainWithAiComponent } from '../../shared/ui/explain-with-ai/explain-with-ai';

/**
 * doc 44 F4 (Architecture viewer / Decision cards). GET /missions/:id/intelligent-generator/architecture-decisions already existed since Slice 1 — nothing new on the backend.
 *
 * "Explicar com IA" (doc 43 §5) is the first real LLM call in the system — it only narrates a
 * decision core already made deterministically (the facts sent to the LLM are exactly the
 * problem/selectedOption/rationale/tradeoffs already rendered on this card), it never decides
 * anything. Per-decision state lives in a plain Record keyed by decisionId since a mission can
 * have many decision cards, each explained independently.
 */
@Component({
  selector: 'app-mission-architecture',
  imports: [TranslatePipe, MissionNavComponent, EmptyStateComponent, ErrorStateComponent, SkeletonComponent, ExplainWithAiComponent],
  templateUrl: './mission-architecture.html',
  styleUrl: './mission-architecture.scss',
})
export class MissionArchitectureComponent {
  readonly missionId = input.required<string>();

  private readonly architectureClient = inject(ArchitectureClient);
  private readonly assistantClient = inject(AssistantClient);

  protected readonly architectureResource = resource({
    params: () => this.missionId(),
    loader: ({ params: missionId }) => firstValueFrom(this.architectureClient.get(missionId)),
  });

  private readonly explainStates = signal<Record<string, ExplainAiState>>({});

  protected explainStateFor(decisionId: string): ExplainAiState {
    return this.explainStates()[decisionId] ?? EXPLAIN_AI_IDLE;
  }

  explain(decisionId: string): void {
    if (this.explainStateFor(decisionId).status === 'loading') return;
    this.setExplainState(decisionId, { status: 'loading' });
    this.assistantClient.explainArchitectureDecision(this.missionId(), decisionId).subscribe({
      next: (response) => this.setExplainState(decisionId, { status: 'done', explanation: response.explanation, usage: response.usage }),
      error: (error: AppError) => this.setExplainState(decisionId, { status: 'error', error }),
    });
  }

  private setExplainState(decisionId: string, state: ExplainAiState): void {
    this.explainStates.update((current) => ({ ...current, [decisionId]: state }));
  }
}
