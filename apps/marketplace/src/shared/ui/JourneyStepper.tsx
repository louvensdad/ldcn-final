import { Check } from "lucide-react";
import { T, alpha } from "../../design/tokens";
import { useI18n } from "../../i18n/I18nContext";
import type { DiscoveryStatus } from "../../api/discovery.client";

type StepStatus = "done" | "current" | "pending";

interface Step {
  key: string;
  labelKey: string;
  status: StepStatus;
}

const GENERATOR_ORDER = [
  "INTENT_PENDING", "INTENT_READY", "REQUIREMENTS_DRAFT", "REQUIREMENTS_APPROVED",
  "TOPOLOGY_PROPOSED", "TOPOLOGY_APPROVED", "SOLUTION_PLANNING", "SOLUTION_PROPOSED", "SOLUTION_APPROVED",
  "ARCHITECTURE_COMPOSING", "ARCHITECTURE_REVIEW", "ARCHITECTURE_APPROVED",
  "TEAM_COMPOSING", "TEAM_READY", "PIPELINE_PLANNING", "READY_FOR_EXECUTION", "ACTIVE", "COMPLETED",
];

/**
 * Real, derived progress across the whole journey (Discovery → PromptMaster → engine stages) — no
 * fabricated "time remaining" or fake percentages for the construction/preview/delivery segment,
 * since there is no execution runtime behind it yet (see README "fora de escopo"). Those steps
 * stay honestly pending until generatorState says otherwise.
 *
 * MISSÃO "Arquitetura não pode seguir automaticamente para Entrega": Team/Pipeline/Delivery são
 * calculados de forma determinística e instantânea pelo core (nunca fabricado — o cálculo é real),
 * mas nunca aparecem como "done" para o usuário enquanto o Architecture Review real (LLM + política)
 * não retornar APPROVED — mesmo que o dado já exista internamente. "current" nesse caso significa
 * "computado, mas ainda não liberado", nunca "pronto".
 */
export function computeJourneySteps(
  discoveryStatus: DiscoveryStatus | undefined,
  generatorState: string | undefined,
  architectureReviewStatus?: string | null
): Step[] {
  const genIndex = generatorState ? GENERATOR_ORDER.indexOf(generatorState) : -1;
  const handedOff = !discoveryStatus || discoveryStatus === "HANDED_OFF";

  const discoveryDone = handedOff || discoveryStatus !== "WAITING_FOR_USER";
  const scopeDone = handedOff || discoveryStatus === "PROMPTMASTER_READY" || discoveryStatus === "PROMPTMASTER_LOCKED";
  const promptMasterDone = handedOff || discoveryStatus === "PROMPTMASTER_LOCKED";

  const at = (kind: "arch" | "team" | "pipeline" | "ready"): StepStatus => {
    if (!handedOff || genIndex < 0) return "pending";
    const ranges: Record<typeof kind, [number, number]> = {
      arch: [GENERATOR_ORDER.indexOf("TOPOLOGY_PROPOSED"), GENERATOR_ORDER.indexOf("ARCHITECTURE_APPROVED")],
      team: [GENERATOR_ORDER.indexOf("TEAM_COMPOSING"), GENERATOR_ORDER.indexOf("TEAM_READY")],
      pipeline: [GENERATOR_ORDER.indexOf("PIPELINE_PLANNING"), GENERATOR_ORDER.indexOf("PIPELINE_PLANNING")],
      ready: [GENERATOR_ORDER.indexOf("READY_FOR_EXECUTION"), GENERATOR_ORDER.indexOf("COMPLETED")],
    };
    const [start, end] = ranges[kind];
    if (genIndex > end) return "done";
    if (genIndex >= start) return "current";
    return "pending";
  };

  const archProposed = at("arch") === "done";
  const archApproved = architectureReviewStatus === "APPROVED";
  // "computado, mas preso atrás do gate" nunca vira "done" na tela — cai para "current".
  const gated = (kind: "team" | "pipeline" | "ready"): StepStatus => {
    const raw = at(kind);
    return raw === "done" && !archApproved ? "current" : raw;
  };
  const architectureValidationStatus: StepStatus = !archProposed ? "pending" : archApproved ? "done" : "current";

  return [
    { key: "idea", labelKey: "journey.idea", status: "done" },
    { key: "discovery", labelKey: "journey.discovery", status: discoveryDone ? "done" : "current" },
    { key: "scope", labelKey: "journey.scope", status: scopeDone ? "done" : discoveryDone ? "current" : "pending" },
    { key: "promptmaster", labelKey: "journey.promptmaster", status: promptMasterDone ? "done" : scopeDone ? "current" : "pending" },
    { key: "architecture", labelKey: "journey.architecture", status: at("arch") },
    { key: "architectureValidation", labelKey: "journey.architectureValidation", status: architectureValidationStatus },
    { key: "team", labelKey: "journey.team", status: gated("team") },
    { key: "pipeline", labelKey: "journey.pipeline", status: gated("pipeline") },
    { key: "delivery", labelKey: "journey.delivery", status: gated("ready") },
  ];
}

export function JourneyStepper({
  discoveryStatus,
  generatorState,
  architectureReviewStatus,
}: {
  discoveryStatus?: DiscoveryStatus;
  generatorState?: string;
  architectureReviewStatus?: string | null;
}) {
  const { t } = useI18n();
  const steps = computeJourneySteps(discoveryStatus, generatorState, architectureReviewStatus);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {steps.map((step, i) => (
        <div key={step.key} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
            <span
              style={{
                width: 18, height: 18, borderRadius: "50%", display: "grid", placeItems: "center", flexShrink: 0,
                background: step.status === "done" ? T.emerald : step.status === "current" ? alpha(T.indigo, 16) : "transparent",
                border: step.status === "current" ? `2px solid ${T.indigo}` : `1.5px solid ${step.status === "pending" ? T.borderStrong : T.emerald}`,
              }}
            >
              {step.status === "done" && <Check size={11} color="#fff" strokeWidth={3} />}
              {step.status === "current" && <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.indigo }} />}
            </span>
            {i < steps.length - 1 && <span style={{ width: 1.5, flex: 1, minHeight: 14, background: step.status === "done" ? T.emerald : T.border }} />}
          </div>
          <span
            style={{
              fontSize: 12.5, fontWeight: step.status === "current" ? 700 : 500, paddingBottom: 14,
              color: step.status === "pending" ? T.textMuted : T.text,
            }}
          >
            {t(step.labelKey)}
          </span>
        </div>
      ))}
    </div>
  );
}
