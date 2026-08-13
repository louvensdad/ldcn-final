import { DeliveryTargetKind } from './solution-topology';

export type JobType =
  | 'REQUIREMENTS_ANALYSIS' | 'ARCHITECTURE_DESIGN' | 'BACKEND_IMPLEMENTATION'
  | 'FRONTEND_IMPLEMENTATION' | 'MOBILE_IMPLEMENTATION' | 'DATA_MODELING'
  | 'DATA_ENGINEERING' | 'SECURITY_IMPLEMENTATION' | 'PERFORMANCE_OPTIMIZATION'
  | 'TEST_CREATION' | 'BUG_FIX' | 'REFACTORING' | 'MIGRATION'
  | 'ENGINEERING_REPAIR' | 'RUNTIME_CONFIGURATION' | 'DEPLOYMENT_CONFIGURATION'
  | 'CROSS_STACK_INTEGRATION' | 'EXTERNAL_INTEGRATION' | 'UX_IMPLEMENTATION'
  | 'SEO_IMPLEMENTATION' | 'AI_ML_WORK' | 'DOCUMENTATION';

export type JobComplexity = 'LOW' | 'MEDIUM' | 'HIGH';
export type JobRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface JobClassification extends Record<string, unknown> {
  id: string;
  missionId: string;
  taskId: string;
  jobType: JobType;
  deliveryTarget?: DeliveryTargetKind;
  primaryStackKey?: string;
  affectedStacks: string[];
  affectedDomains: string[];
  complexity: JobComplexity;
  riskLevel: JobRiskLevel;
  requiredCapabilities: string[];
  requiresArchitectureReview: boolean;
  requiresSecurityReview: boolean;
  requiresDataSpecialist: boolean;
  requiresRuntimeSpecialist: boolean;
  requiresIntegration: boolean;
  scopeExpansionRequired: boolean;
  contextHash: string;
}
