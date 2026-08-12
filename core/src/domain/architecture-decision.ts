export interface ArchitectureDecision {
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
