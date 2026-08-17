import { Generator } from '../generator';

/**
 * MISSÃO "Targeted Generation no Marketplace" — `generateTargeted` nunca reimplementa a lógica de
 * `generate()`: intent/contract/topology são sempre recomputados (é a personalização em si); só
 * stack/arquitetura/equipe podem ser reaproveitados de uma `reference`, sempre passando pelos
 * mesmos validators reais — nunca copiados sem checagem.
 */
describe('Generator.generateTargeted', () => {
  it('reaproveita stack/arquitetura/equipe já aprovados quando o scope pede reuso — nunca redecide do zero', () => {
    const generator = new Generator({ mode: 'AUTO' });
    const reference = generator.generate({
      missionId: 'reference-mission',
      rawUserIdea: 'Quero um sistema de gestão de clínica com login, agendamento e dashboard administrativo.',
    });

    const targeted = generator.generateTargeted(
      {
        missionId: 'derived-mission',
        rawUserIdea: 'Quero um sistema de gestão de clínica com login, agendamento e dashboard administrativo, mas focado em controle de estoque de remédios.',
      },
      reference,
      { reuseStackSelection: true, reuseArchitecture: true, reuseTeam: true }
    );

    expect(targeted.escalations).toEqual([]);
    expect(targeted.actualReuse).toEqual({ reuseStackSelection: true, reuseArchitecture: true, reuseTeam: true });

    // Reaproveitado de verdade: mesmo conteúdo de stack/arquitetura/equipe da referência.
    expect(targeted.approvedSolution.selectedStacks).toEqual(reference.approvedSolution.selectedStacks);
    expect(targeted.architectureComposition.proposals.map((p) => [p.stackKey, p.architectureStyle])).toEqual(
      reference.architectureComposition.proposals.map((p) => [p.stackKey, p.architectureStyle])
    );
    expect(targeted.agentTeam.instances.map((i) => [i.agentKey, i.role])).toEqual(
      reference.agentTeam.instances.map((i) => [i.agentKey, i.role])
    );

    // Mas nunca a MESMA linha da referência — identidade sempre própria da mission derivada.
    expect(targeted.approvedSolution.id).not.toBe(reference.approvedSolution.id);
    expect(targeted.approvedSolution.missionId).toBe('derived-mission');
    expect(targeted.architectureComposition.missionId).toBe('derived-mission');
    expect(targeted.agentTeam.missionId).toBe('derived-mission');
    expect(targeted.selection.missionId).toBe('derived-mission');

    // Intent/contract/topology são SEMPRE recomputados — nunca reaproveitados (são a própria personalização).
    expect(targeted.intent.missionId).toBe('derived-mission');
    expect(targeted.contract.missionId).toBe('derived-mission');
    expect(targeted.pipeline.status).not.toBe('BLOCKED_UNSUPPORTED_RUNTIME');
    expect(targeted.governance.allowed).toBe(true);
  });

  it('cai para recomputação real (escalation) quando reaproveitar a stack antiga não cobre um novo delivery target exigido', () => {
    const generator = new Generator({ mode: 'AUTO' });
    const reference = generator.generate({
      missionId: 'reference-mission-2',
      rawUserIdea: 'Quero um sistema de gestão de clínica com login e dashboard administrativo.',
    });
    expect(reference.topology.deliveryTargets.some((t) => t.kind === 'MOBILE' && t.status === 'APPROVED')).toBe(false);

    const targeted = generator.generateTargeted(
      {
        missionId: 'derived-mission-2',
        rawUserIdea: 'Quero um sistema de gestão de clínica com login, dashboard administrativo e um aplicativo mobile para os pacientes.',
      },
      reference,
      { reuseStackSelection: true, reuseArchitecture: true, reuseTeam: true }
    );

    // A stack antiga não cobre MOBILE — reuso falha a revalidação real e cai pra recomputação real.
    expect(targeted.escalations.some((e) => e.stage === 'STACK_SELECTION')).toBe(true);
    expect(targeted.actualReuse.reuseStackSelection).toBe(false);
    expect(targeted.approvedSolution.selectedStacks.some((s) => s.deliveryTargetKind === 'MOBILE')).toBe(true);

    // Achado real (bug corrigido): arquitetura/equipe reaproveitadas foram compostas para a stack
    // ANTIGA — reaproveitá-las contra uma stack diferente sem essa checagem crasha depois dentro
    // do PipelineComposer ("Architecture contains a stack outside ApprovedSolution"). O scope
    // pedia reuso das três, mas a escalation da stack precisa cascatear: nunca reaproveitar
    // arquitetura/equipe quando a stack que as originou não foi ela mesma reaproveitada.
    expect(targeted.actualReuse.reuseArchitecture).toBe(false);
    expect(targeted.actualReuse.reuseTeam).toBe(false);
    expect(targeted.escalations.some((e) => e.stage === 'ARCHITECTURE')).toBe(true);
    expect(targeted.escalations.some((e) => e.stage === 'TEAM')).toBe(true);
    const approvedStackKeys = new Set(targeted.approvedSolution.selectedStacks.map((s) => s.stackKey));
    expect(targeted.architectureComposition.proposals.every((p) => approvedStackKeys.has(p.stackKey))).toBe(true);

    // Nunca finge sucesso: o resultado final ainda é uma solução real e válida.
    expect(targeted.approvedSolution.status).toBe('ACTIVE');
    expect(targeted.governance.allowed).toBe(true);
  });

  it('scope todo false se comporta exatamente como generate() do zero (nenhum reuso, nenhuma escalation)', () => {
    const generator = new Generator({ mode: 'AUTO' });
    const reference = generator.generate({
      missionId: 'reference-mission-3',
      rawUserIdea: 'Quero uma landing page simples.',
    });

    const targeted = generator.generateTargeted(
      { missionId: 'derived-mission-3', rawUserIdea: 'Quero uma landing page simples com cores diferentes.' },
      reference,
      { reuseStackSelection: false, reuseArchitecture: false, reuseTeam: false }
    );

    expect(targeted.actualReuse).toEqual({ reuseStackSelection: false, reuseArchitecture: false, reuseTeam: false });
    expect(targeted.escalations).toEqual([]);
    expect(targeted.approvedSolution.status).toBe('ACTIVE');
  });
});
