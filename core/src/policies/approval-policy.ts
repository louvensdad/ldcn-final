import { SelectionMode } from '../domain/stack-selection';

export interface ApprovalContext {
  mode: SelectionMode;
  approvedExplicitly: boolean;
  autoApproveAllowed: boolean;
}

export class ApprovalPolicy {
  static canApprove(context: ApprovalContext): { approvable: boolean; reason?: string } {
    if (context.mode === 'FIXED') {
      return context.approvedExplicitly
        ? { approvable: true }
        : { approvable: false, reason: 'FIXED mode requires explicit approval' };
    }

    if (context.mode === 'GUIDED') {
      return context.approvedExplicitly
        ? { approvable: true }
        : { approvable: false, reason: 'GUIDED mode requires explicit approval' };
    }

    if (context.mode === 'AUTO') {
      return context.autoApproveAllowed
        ? { approvable: true }
        : { approvable: false, reason: 'AUTO mode not allowed by policy' };
    }

    return { approvable: false, reason: 'Unknown selection mode' };
  }
}
