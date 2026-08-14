import { Component, input } from '@angular/core';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

interface Stage {
  key: string;
  labelKey: string;
  states: string[];
}

export type StageStatus = 'done' | 'current' | 'pending';

/**
 * doc 44 F3 (Stage Rail). Grouped into the 8 sections the doc itself uses (Intent through
 * Ready), each covering a few of core's fine-grained GeneratorState values
 * (core/src/domain/generator-state.ts) so the rail doesn't have 16+ noisy stops.
 *
 * BLOCKED/CANCELLED aren't in this sequence on purpose: the state machine can reach BLOCKED
 * from several different stages, and guessing which one would be dishonest. When the mission
 * is in one of those states every stop just reads "pending" — the real signal is the blockers
 * banner the caller renders separately.
 */
const STAGES: Stage[] = [
  { key: 'intent', labelKey: 'stageRail.intent', states: ['INTENT_PENDING', 'INTENT_READY'] },
  { key: 'requirements', labelKey: 'stageRail.requirements', states: ['REQUIREMENTS_DRAFT', 'REQUIREMENTS_APPROVED'] },
  { key: 'topology', labelKey: 'stageRail.topology', states: ['TOPOLOGY_PROPOSED', 'TOPOLOGY_APPROVED'] },
  { key: 'solution', labelKey: 'stageRail.solution', states: ['SOLUTION_PLANNING', 'SOLUTION_PROPOSED', 'SOLUTION_APPROVED'] },
  { key: 'architecture', labelKey: 'stageRail.architecture', states: ['ARCHITECTURE_COMPOSING', 'ARCHITECTURE_REVIEW', 'ARCHITECTURE_APPROVED'] },
  { key: 'team', labelKey: 'stageRail.team', states: ['TEAM_COMPOSING', 'TEAM_READY'] },
  { key: 'pipeline', labelKey: 'stageRail.pipeline', states: ['PIPELINE_PLANNING'] },
  { key: 'ready', labelKey: 'stageRail.ready', states: ['READY_FOR_EXECUTION', 'ACTIVE', 'COMPLETED'] },
];

const KNOWN_SEQUENCE = STAGES.flatMap((stage) => stage.states);

@Component({
  selector: 'app-stage-rail',
  imports: [TranslatePipe],
  templateUrl: './stage-rail.html',
  styleUrl: './stage-rail.scss',
})
export class StageRailComponent {
  readonly generatorState = input<string | undefined>();
  protected readonly stages = STAGES;

  status(stage: Stage): StageStatus {
    const state = this.generatorState();
    if (!state || !KNOWN_SEQUENCE.includes(state)) return 'pending';

    const currentIndex = KNOWN_SEQUENCE.indexOf(state);
    const stageStartIndex = KNOWN_SEQUENCE.indexOf(stage.states[0]);
    const stageEndIndex = KNOWN_SEQUENCE.indexOf(stage.states[stage.states.length - 1]);

    if (currentIndex > stageEndIndex) return 'done';
    if (currentIndex >= stageStartIndex) return 'current';
    return 'pending';
  }
}
