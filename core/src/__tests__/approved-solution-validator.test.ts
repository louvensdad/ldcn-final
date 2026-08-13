import { StackRegistry } from '../registry/stack-registry';
import { RequirementsIntelligence } from '../services/requirements-intelligence';
import { IntentAnalyzer } from '../services/intent-analyzer';
import { TopologyResolver } from '../services/topology-resolver';
import { TechnologySelector } from '../services/technology-selector';
import { ApprovedSolutionValidator } from '../services/approved-solution-validator';

describe('ApprovedSolutionValidator', () => {
  const analyzer = new IntentAnalyzer();
  const requirements = new RequirementsIntelligence();
  const resolver = new TopologyResolver();
  const selector = new TechnologySelector();
  const validator = new ApprovedSolutionValidator();
  const registry = new StackRegistry();
  const kindsRequiringStack = Array.from(
    new Set(registry.list().flatMap((s) => s.deliveryTargetKinds))
  );

  function buildSelection(idea: string, mode: any = 'AUTO', fixed?: Record<string, string>) {
    const intent = analyzer.analyze({ missionId: 'mission-1', rawUserIdea: idea });
    const contract = requirements.approve(requirements.buildContract(intent));
    const topology = resolver.approve(resolver.resolve({ contract, forbiddenTargets: [] }));
    return {
      contract,
      topology,
      selection: selector.select({ contract, topology, registry, mode, fixedSelections: fixed }),
    };
  }

  it('should approve solution in AUTO mode', () => {
    const { contract, topology, selection } = buildSelection('Quero uma API REST.');

    const approved = validator.validateAndApprove({
      missionId: 'mission-1',
      topology,
      selectionProposal: {
        mode: 'AUTO',
        selections: selection.selections
          .filter((s) => s.selectedStackKey)
          .map((s) => ({
            deliveryTargetKind: s.deliveryTargetKind,
            stackKey: s.selectedStackKey!,
            rationale: s.rationale,
          })),
      },
      requirementsContractId: contract.id,
      approvedByPolicy: true,
      kindsRequiringStack,
    });

    expect(approved.status).toBe('ACTIVE');
    expect(approved.version).toBe(1);
    expect(approved.selectedStacks.length).toBeGreaterThan(0);
  });

  it('should reject GUIDED mode without explicit approval', () => {
    const { contract, topology, selection } = buildSelection('Quero uma API REST.', 'GUIDED');

    expect(() =>
      validator.validateAndApprove({
        missionId: 'mission-2',
        topology,
        selectionProposal: {
          mode: 'GUIDED',
          selections: selection.selections
            .filter((s) => s.selectedStackKey)
            .map((s) => ({
              deliveryTargetKind: s.deliveryTargetKind,
              stackKey: s.selectedStackKey!,
              rationale: s.rationale,
            })),
        },
        requirementsContractId: contract.id,
        approvedByPolicy: false,
        kindsRequiringStack,
      })
    ).toThrow('explicit approval');
  });

  it('should make duplicate approval idempotent', () => {
    const { contract, topology, selection } = buildSelection('Quero uma API REST.');
    const proposal = {
      mode: 'AUTO' as const,
      selections: selection.selections
        .filter((s) => s.selectedStackKey)
        .map((s) => ({
          deliveryTargetKind: s.deliveryTargetKind,
          stackKey: s.selectedStackKey!,
          rationale: s.rationale,
        })),
    };

    const first = validator.validateAndApprove({
      missionId: 'mission-3',
      topology,
      selectionProposal: proposal,
      requirementsContractId: contract.id,
      approvedByPolicy: true,
      kindsRequiringStack,
    });

    const second = validator.validateAndApprove({
      missionId: 'mission-3',
      topology,
      selectionProposal: proposal,
      requirementsContractId: contract.id,
      approvedByPolicy: true,
      kindsRequiringStack,
    });

    expect(first.version).toBe(1);
    expect(second.version).toBe(1);
    expect(second.status).toBe('ACTIVE');
    expect(second.id).toBe(first.id);
  });

  it('recognizes equivalent topology instances by context hash', () => {
    const firstInput = buildSelection('Quero uma API REST.');
    const proposal = {
      mode: 'AUTO' as const,
      selections: firstInput.selection.selections.filter((s) => s.selectedStackKey).map((s) => ({ deliveryTargetKind: s.deliveryTargetKind, stackKey: s.selectedStackKey!, rationale: s.rationale })),
    };
    const first = validator.validateAndApprove({ missionId: 'mission-equivalent', topology: firstInput.topology, selectionProposal: proposal, requirementsContractId: firstInput.contract.id, approvedByPolicy: true, kindsRequiringStack });
    const equivalentTopology = { ...firstInput.topology, id: 'equivalent-topology-id' };
    const second = validator.validateAndApprove({ missionId: 'mission-equivalent', topology: equivalentTopology, selectionProposal: proposal, requirementsContractId: firstInput.contract.id, approvedByPolicy: true, kindsRequiringStack });
    expect(second).toBe(first);
  });
});
