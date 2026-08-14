import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from './api-client';

/** Mirrors core/src/domain/architecture-decision.ts (ArchitectureDecision). */
export interface ArchitectureDecisionDto {
  id: string;
  scope: string;
  problem: string;
  optionsConsidered: string[];
  selectedOption: string;
  rationale: string;
  constraints: string[];
  tradeoffs: string[];
  decidedBy: string;
  reviewedBy: string[];
  status: 'PROPOSED' | 'APPROVED' | 'REJECTED';
}

/** Mirrors core/src/domain/stack-architecture-proposal.ts (StackArchitectureProposal). */
export interface StackArchitectureProposalDto {
  id: string;
  stackKey: string;
  deliveryTargetKind: string;
  architectureStyle: string;
  modules: { name: string; responsibility: string; exposes: string[]; dependsOn: string[] }[];
  boundaries: string[];
  dependencies: string[];
  persistence?: string;
  security: string[];
  communication: string[];
  observability: string[];
  buildStrategy: string;
  testStrategy: string;
  deploymentStrategy: string;
  decisions: ArchitectureDecisionDto[];
  alternatives: string[];
  tradeoffs: string[];
  risks: string[];
  status: 'PROPOSED' | 'APPROVED';
}

/** Mirrors core/src/domain/approved-architecture-composition.ts (ArchitectureConflict). */
export interface ArchitectureConflictDto {
  id: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  topic: string;
  description: string;
  involvedStacks: string[];
  resolution?: string;
}

/** Wire shape of GET /missions/:id/intelligent-generator/architecture-decisions (ApprovedArchitectureComposition). */
export interface ArchitectureCompositionDto {
  id: string;
  missionId: string;
  version: number;
  approvedSolutionId: string;
  proposals: StackArchitectureProposalDto[];
  conflicts: ArchitectureConflictDto[];
  status: 'APPROVED' | 'BLOCKED_BY_CONFLICT';
}

@Injectable({ providedIn: 'root' })
export class ArchitectureClient {
  private readonly api = inject(ApiClient);

  get(missionId: string): Observable<ArchitectureCompositionDto> {
    return this.api.get<ArchitectureCompositionDto>(`/missions/${missionId}/intelligent-generator/architecture-decisions`);
  }
}
