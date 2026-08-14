import { Component, computed, inject, input, resource, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AgentInstanceDto, TeamClient, TeamCompositionDecisionDto } from '../../core/api/team.client';
import { AssistantClient } from '../../core/api/assistant.client';
import { AppError } from '../../core/errors/error-mapper';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { MissionNavComponent } from '../../shared/ui/mission-nav/mission-nav';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state';
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton';
import { EXPLAIN_AI_IDLE, ExplainAiState, ExplainWithAiComponent } from '../../shared/ui/explain-with-ai/explain-with-ai';

const INTEGRATION_UNIT_KEY = 'integration-unit';

interface StackGroup {
  stackKey: string;
  instances: AgentInstanceDto[];
}

/**
 * doc 44 F4 ("Team Room" / "Agent drawer"). GET /missions/:id/intelligent-generator/team already existed since Slice
 * 1 — nothing new on the backend. "Job Team highlight" is deliberately out of scope: it needs
 * task/routing UI that doesn't exist yet (F5 — Pipeline + Tasks).
 */
@Component({
  selector: 'app-mission-team',
  imports: [TranslatePipe, MissionNavComponent, EmptyStateComponent, ErrorStateComponent, SkeletonComponent, ExplainWithAiComponent],
  templateUrl: './mission-team.html',
  styleUrl: './mission-team.scss',
})
export class MissionTeamComponent {
  readonly missionId = input.required<string>();

  private readonly teamClient = inject(TeamClient);
  private readonly assistantClient = inject(AssistantClient);

  protected readonly teamResource = resource({
    params: () => this.missionId(),
    loader: ({ params: missionId }) => firstValueFrom(this.teamClient.get(missionId)),
  });

  protected readonly expandedInstanceId = signal<string | null>(null);

  protected readonly groups = computed<StackGroup[]>(() => {
    const team = this.teamResource.value();
    if (!team) return [];
    const byStack = new Map<string, AgentInstanceDto[]>();
    for (const instance of team.instances) {
      const key = instance.stackKey ?? INTEGRATION_UNIT_KEY;
      byStack.set(key, [...(byStack.get(key) ?? []), instance]);
    }
    return [...byStack.entries()].map(([stackKey, instances]) => ({ stackKey, instances }));
  });

  toggleInstance(instanceId: string): void {
    this.expandedInstanceId.update((current) => (current === instanceId ? null : instanceId));
  }

  isIntegrationUnit(stackKey: string): boolean {
    return stackKey === INTEGRATION_UNIT_KEY;
  }

  decisionsForScope(scope: string): TeamCompositionDecisionDto[] {
    return this.teamResource.value()?.decisions.filter((decision) => decision.scope === scope) ?? [];
  }

  private readonly explainStates = signal<Record<string, ExplainAiState>>({});

  protected explainStateFor(decisionId: string): ExplainAiState {
    return this.explainStates()[decisionId] ?? EXPLAIN_AI_IDLE;
  }

  explain(decisionId: string): void {
    if (this.explainStateFor(decisionId).status === 'loading') return;
    this.setExplainState(decisionId, { status: 'loading' });
    this.assistantClient.explainTeamDecision(this.missionId(), decisionId).subscribe({
      next: (response) => this.setExplainState(decisionId, { status: 'done', explanation: response.explanation, usage: response.usage }),
      error: (error: AppError) => this.setExplainState(decisionId, { status: 'error', error }),
    });
  }

  private setExplainState(decisionId: string, state: ExplainAiState): void {
    this.explainStates.update((current) => ({ ...current, [decisionId]: state }));
  }
}
