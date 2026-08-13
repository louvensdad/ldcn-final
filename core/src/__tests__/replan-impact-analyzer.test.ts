import { ReplanImpactAnalyzer } from '../services/replan-impact-analyzer';

describe('ReplanImpactAnalyzer', () => {
  it('limits user preference impact to downstream technical decisions', () => {
    const impact = new ReplanImpactAnalyzer().analyze('USER_PREFERENCE_CHANGED');
    expect(impact.requirements).toBe(false);
    expect(impact.solution).toBe(true);
    expect(impact.pipeline).toBe(true);
  });

  it('recomposes all layers after approved scope expansion', () => {
    const impact = new ReplanImpactAnalyzer().analyze('SCOPE_EXPANSION_APPROVED');
    expect(Object.values(impact).filter((value) => value === true)).toHaveLength(6);
  });
});
