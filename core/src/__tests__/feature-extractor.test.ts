import { FeatureExtractor } from '../services/feature-extractor';
import { JobClassification } from '../domain';

describe('FeatureExtractor', () => {
  it('produces stable, non-sensitive versioned features', () => {
    const classification = { jobType: 'SECURITY_IMPLEMENTATION', deliveryTarget: 'BACKEND', complexity: 'MEDIUM', riskLevel: 'HIGH', affectedStacks: ['stack.java.spring-boot'], affectedDomains: ['identity'], requiredCapabilities: ['security', 'java'], requiresArchitectureReview: false, requiresSecurityReview: true, requiresDataSpecialist: false, requiresRuntimeSpecialist: false, requiresIntegration: false, scopeExpansionRequired: false } as JobClassification;
    const result = new FeatureExtractor().fromJobClassification(classification);
    expect(result.schemaVersion).toBe('features-v1');
    expect(result.values).toEqual(expect.objectContaining({ jobType: 'SECURITY_IMPLEMENTATION', requiresSecurityReview: true, affectedStackCount: 1 }));
    expect(Object.keys(result.values).some((key) => /secret|token|cot|reasoning/i.test(key))).toBe(false);
  });
});
