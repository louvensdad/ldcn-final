import { Component, inject, input, resource, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TaskClient } from '../../core/api/task.client';
import { AssistantClient } from '../../core/api/assistant.client';
import { GateClient, ReviewGateEvaluationDto, ReviewGateEvidenceDto } from '../../core/api/gate.client';
import { AppError } from '../../core/errors/error-mapper';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { MissionNavComponent } from '../../shared/ui/mission-nav/mission-nav';
import { ButtonComponent } from '../../shared/ui/button/button';
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton';
import { EXPLAIN_AI_IDLE, ExplainAiState, ExplainWithAiComponent } from '../../shared/ui/explain-with-ai/explain-with-ai';

interface GateFormRow {
  passed: boolean;
  evidenceRef: string;
}

const IDLE_GATE_ROW: GateFormRow = { passed: false, evidenceRef: '' };

/**
 * doc 44 F5 ("Task detail" + "routing explanation"). GET .../intelligent-routing already existed since Slice 2 — `rationale` on the routing decision IS the routing explanation, computed by IntelligentWorkRouter (core/src/services/intelligent-work-router.ts).
 *
 * Gate evaluation card only renders when `routing.status === 'ROUTED'` — ReviewGateEvaluator
 * requires that (core/src/services/review-gate-evaluator.ts throws REVIEW_ROUTING_NOT_READY
 * otherwise), which itself requires a reviewer distinct from the executor to exist on the team.
 * Most tasks today won't reach ROUTED (same honest limitation already documented for repair's
 * EXECUTION_FAILED precondition). reviewerAgentInstanceId/executorAgentInstanceId are
 * deliberately omitted from the submitted evidence — no agent picker exists yet, and the core
 * self-review guard only fires when both are actually provided.
 */
@Component({
  selector: 'app-task-detail',
  imports: [TranslatePipe, MissionNavComponent, ButtonComponent, ErrorStateComponent, SkeletonComponent, ExplainWithAiComponent],
  templateUrl: './task-detail.html',
  styleUrl: './task-detail.scss',
})
export class TaskDetailComponent {
  readonly missionId = input.required<string>();
  readonly taskId = input.required<string>();

  private readonly taskClient = inject(TaskClient);
  private readonly assistantClient = inject(AssistantClient);
  private readonly gateClient = inject(GateClient);

  protected readonly overviewResource = resource({
    params: () => `${this.missionId()}:${this.taskId()}`,
    loader: ({ params }) => {
      const [missionId, taskId] = params.split(':');
      return firstValueFrom(this.taskClient.getOverview(missionId, taskId));
    },
  });

  // Named to avoid colliding with the `routing` local the template binds via `@if (data.routing; as routing)`.
  protected readonly routingInFlight = signal(false);
  protected readonly routingError = signal<AppError | null>(null);

  route(): void {
    if (this.routingInFlight()) return;
    this.routingInFlight.set(true);
    this.routingError.set(null);
    this.taskClient.route(this.missionId(), this.taskId()).subscribe({
      next: () => {
        this.routingInFlight.set(false);
        this.overviewResource.reload();
      },
      error: (error: AppError) => {
        this.routingInFlight.set(false);
        this.routingError.set(error);
      },
    });
  }

  protected readonly explainState = signal<ExplainAiState>(EXPLAIN_AI_IDLE);

  explainRouting(): void {
    if (this.explainState().status === 'loading') return;
    this.explainState.set({ status: 'loading' });
    this.assistantClient.explainRoutingDecision(this.missionId(), this.taskId()).subscribe({
      next: (response) => this.explainState.set({ status: 'done', explanation: response.explanation, usage: response.usage }),
      error: (error: AppError) => this.explainState.set({ status: 'error', error }),
    });
  }

  private readonly gateForm = signal<Record<string, GateFormRow>>({});
  protected readonly gatesInFlight = signal(false);
  protected readonly gatesError = signal<AppError | null>(null);
  protected readonly gateEvaluation = signal<ReviewGateEvaluationDto | null>(null);

  protected gateFormFor(gateKey: string): GateFormRow {
    return this.gateForm()[gateKey] ?? IDLE_GATE_ROW;
  }

  setGatePassed(gateKey: string, passed: boolean): void {
    this.gateForm.update((current) => ({ ...current, [gateKey]: { ...this.gateFormFor(gateKey), passed } }));
  }

  setGateEvidenceRef(gateKey: string, evidenceRef: string): void {
    this.gateForm.update((current) => ({ ...current, [gateKey]: { ...this.gateFormFor(gateKey), evidenceRef } }));
  }

  evaluateGates(requiredGateKeys: string[]): void {
    if (this.gatesInFlight()) return;
    this.gatesInFlight.set(true);
    this.gatesError.set(null);
    const evidence: ReviewGateEvidenceDto[] = requiredGateKeys.map((gateKey) => {
      const row = this.gateFormFor(gateKey);
      return { gateKey, passed: row.passed, evidenceRefs: row.evidenceRef ? [row.evidenceRef] : [] };
    });
    this.gateClient.evaluate(this.missionId(), this.taskId(), evidence).subscribe({
      next: (evaluation) => {
        this.gatesInFlight.set(false);
        this.gateEvaluation.set(evaluation);
      },
      error: (error: AppError) => {
        this.gatesInFlight.set(false);
        this.gatesError.set(error);
      },
    });
  }
}
