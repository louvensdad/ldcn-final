import { Component, computed, inject, input, resource } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PipelineClient, PipelineNodeDto } from '../../core/api/pipeline.client';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { MissionNavComponent } from '../../shared/ui/mission-nav/mission-nav';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state';
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton';

const INTEGRATION_GROUP_KEY = 'integration';

/** Node type sequence within a stack — GENERATION always runs before BUILD, etc. (core/src/services/pipeline-composer.ts builds nodes in this exact order). */
const TYPE_ORDER: Record<string, number> = { GENERATION: 0, BUILD: 1, TEST: 2, REVIEW: 3, GATE: 4, INTEGRATION_VALIDATION: 5, PROMOTION: 6 };

interface StackPipelineGroup {
  stackKey: string;
  nodes: PipelineNodeDto[];
}

/**
 * doc 44 F5 ("Pipeline graph/timeline"). GET /missions/:id/intelligent-generator/pipeline
 * already existed since Slice 1 — nothing new on the backend.
 *
 * Deliberately a *timeline* (nodes grouped by stack, ordered by dependency), not an
 * interactive dependency graph with drawn edges — a full graph layout is a lot of surface for
 * what the doc actually needs (dependencies visible), and a deterministic order already shows
 * that.
 */
@Component({
  selector: 'app-mission-pipeline',
  imports: [TranslatePipe, MissionNavComponent, EmptyStateComponent, ErrorStateComponent, SkeletonComponent],
  templateUrl: './mission-pipeline.html',
  styleUrl: './mission-pipeline.scss',
})
export class MissionPipelineComponent {
  readonly missionId = input.required<string>();

  private readonly pipelineClient = inject(PipelineClient);

  protected readonly pipelineResource = resource({
    params: () => this.missionId(),
    loader: ({ params: missionId }) => firstValueFrom(this.pipelineClient.get(missionId)),
  });

  protected readonly groups = computed<StackPipelineGroup[]>(() => {
    const plan = this.pipelineResource.value();
    if (!plan) return [];
    const byStack = new Map<string, PipelineNodeDto[]>();
    for (const node of plan.nodes) {
      const key = node.stackKey ?? INTEGRATION_GROUP_KEY;
      byStack.set(key, [...(byStack.get(key) ?? []), node]);
    }
    return [...byStack.entries()].map(([stackKey, nodes]) => ({
      stackKey,
      nodes: [...nodes].sort((a, b) => (TYPE_ORDER[a.type] ?? 99) - (TYPE_ORDER[b.type] ?? 99)),
    }));
  });

  isIntegrationGroup(stackKey: string): boolean {
    return stackKey === INTEGRATION_GROUP_KEY;
  }
}
