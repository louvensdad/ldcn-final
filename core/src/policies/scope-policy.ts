import { DeliveryTarget, DeliveryTargetKind } from '../domain/solution-topology';

export class ScopePolicy {
  static validate(
    proposedTargets: DeliveryTarget[],
    forbiddenTargets: DeliveryTargetKind[]
  ): { valid: boolean; violations: string[] } {
    const violations: string[] = [];

    for (const target of proposedTargets) {
      if (forbiddenTargets.includes(target.kind)) {
        if (target.status !== 'FORBIDDEN_BY_SCOPE') {
          violations.push(
            `Target ${target.kind} is forbidden by user scope but was marked as ${target.status}`
          );
        }
        if (target.required) {
          violations.push(
            `Target ${target.kind} is forbidden by user scope but was marked as required`
          );
        }
      }
    }

    return { valid: violations.length === 0, violations };
  }
}
