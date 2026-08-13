import { JobClassification, LearningOutcome } from '../domain';

export interface ExtractedFeatures {
  schemaVersion: string;
  values: Record<string, string | number | boolean | null>;
}

export class FeatureExtractor {
  fromJobClassification(classification: JobClassification): ExtractedFeatures {
    return {
      schemaVersion: 'features-v1',
      values: {
        jobType: classification.jobType,
        deliveryTarget: classification.deliveryTarget ?? null,
        complexity: classification.complexity,
        riskLevel: classification.riskLevel,
        affectedStackCount: classification.affectedStacks.length,
        affectedDomainCount: classification.affectedDomains.length,
        requiredCapabilityCount: classification.requiredCapabilities.length,
        requiresArchitectureReview: classification.requiresArchitectureReview,
        requiresSecurityReview: classification.requiresSecurityReview,
        requiresIntegration: classification.requiresIntegration,
        scopeExpansionRequired: classification.scopeExpansionRequired,
      },
    };
  }

  fromOutcome(outcome: LearningOutcome): ExtractedFeatures {
    return { schemaVersion: outcome.featureSchemaVersion, values: { ...outcome.features } };
  }
}
