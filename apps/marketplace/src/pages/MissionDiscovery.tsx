import { useState, type CSSProperties } from "react";
import { Bot, User, Send, Check, X, Sparkles, FileText, AlertTriangle, AlertOctagon, Info, CheckCircle2, XCircle } from "lucide-react";
import { T, alpha } from "../design/tokens";
import { useI18n } from "../i18n/I18nContext";
import { discoveryClient, type DiscoveryConversationDto, type RequirementDto, type CopilotProposalDto, type ReviewFindingDto, type ReviewFindingSeverity, type ReviewerExecutionDto, type ValidationGateDto, type ValidationGateConditionCode, type PromptMasterDto } from "../api/discovery.client";
import { ApiClientError, type AppError } from "../api/client";
import { JourneyStepper } from "../shared/ui/JourneyStepper";

function toAppError(err: unknown): AppError {
  return err instanceof ApiClientError ? err.appError : { category: "UNKNOWN", status: 0, code: "UNKNOWN", translationKey: "errors.unknown" };
}

function ChatBubble({ role, children }: { role: "user" | "assistant"; children: string }) {
  const isUser = role === "user";
  return (
    <div style={{ display: "flex", gap: 8, flexDirection: isUser ? "row-reverse" : "row", marginBottom: 12 }}>
      <span
        style={{
          width: 26, height: 26, borderRadius: 7, display: "grid", placeItems: "center", flexShrink: 0,
          background: isUser ? T.surfaceEl : `linear-gradient(135deg, ${T.indigo}, ${T.violet})`,
          border: isUser ? `1px solid ${T.border}` : "none",
        }}
      >
        {isUser ? <User size={13} color={T.textSub} /> : <Bot size={13} color="#fff" />}
      </span>
      <div
        style={{
          maxWidth: "78%", padding: "10px 13px", borderRadius: 12, fontSize: 13.5, lineHeight: 1.55,
          background: isUser ? alpha(T.indigo, 10) : T.surfaceHover,
          border: `1px solid ${isUser ? alpha(T.indigo, 22) : T.border}`,
          color: T.textSub,
        }}
      >
        {children}
      </div>
    </div>
  );
}

const ERROR_CODE_KEYS: Record<string, string> = {
  DISCOVERY_AI_UNAVAILABLE: "discovery.aiUnavailable",
  DISCOVERY_PROMPTMASTER_HAS_BLOCKERS: "discovery.hasBlockers",
  DISCOVERY_PROMPTMASTER_NEEDS_DECISION: "discovery.needsDecision",
  DISCOVERY_PROMPTMASTER_SECTIONS_INCOMPLETE: "discovery.gate.sectionsError",
  DISCOVERY_PROMPTMASTER_REVIEW_INCOMPLETE: "discovery.gate.reviewError",
};

function ErrorNote({ error }: { error: AppError }) {
  const { t } = useI18n();
  const key = ERROR_CODE_KEYS[error.code] ?? error.translationKey;
  return (
    <p style={{ margin: "10px 0", fontSize: 12.5, color: T.red, display: "flex", alignItems: "center", gap: 6 }}>{t(key)}</p>
  );
}

/**
 * The whole Discovery→Escopo→PromptMaster arc lives here as one continuous experience (Fase 11:
 * "Copilot é o fluxo"). Which panel renders is driven entirely by discovery.status — real server
 * state, so a refresh resumes exactly where the conversation left off (Fase 17).
 */
export function MissionDiscovery({ discovery, generatorState, onAdvance }: { discovery: DiscoveryConversationDto; generatorState?: string; onAdvance: () => void }) {
  const { t } = useI18n();

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 220px", gap: 32, alignItems: "start" }}>
      <div>
        <div style={{ marginBottom: 18 }}>
          {discovery.messages.map((m) => (
            <ChatBubble key={m.id} role={m.role}>{m.content}</ChatBubble>
          ))}
        </div>

        {discovery.status === "WAITING_FOR_USER" && <AnswerPanel discovery={discovery} onAdvance={onAdvance} />}
        {discovery.status === "FEATURE_REVIEW" && <FeatureReviewPanel discovery={discovery} onAdvance={onAdvance} />}
        {discovery.status === "PROMPTMASTER_READY" && <PromptMasterPanel discovery={discovery} onAdvance={onAdvance} />}
        {discovery.status === "PROMPTMASTER_LOCKED" && <LockedRecoveryPanel discovery={discovery} onAdvance={onAdvance} />}
      </div>

      <div style={{ position: "sticky", top: 24 }}>
        <p style={{ margin: "0 0 14px", fontSize: 11, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700 }}>
          {t("journey.title")}
        </p>
        <JourneyStepper discoveryStatus={discovery.status} generatorState={generatorState} />
      </div>
    </div>
  );
}

function AnswerPanel({ discovery, onAdvance }: { discovery: DiscoveryConversationDto; onAdvance: () => void }) {
  const { t } = useI18n();
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const question = discovery.currentQuestion;

  async function submit(value: string) {
    if (!value.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await discoveryClient.respond(discovery.missionId, value.trim());
      setAnswer("");
      onAdvance();
    } catch (err) {
      setError(toAppError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, padding: 16, background: T.surface }}>
      {question && question.options.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          {question.options.map((option) => (
            <button key={option} type="button" className="plan-chip" disabled={submitting} onClick={() => submit(option)}>
              {option}
            </button>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <textarea
          className="field-input"
          style={{ flex: 1, minHeight: 44, maxHeight: 120, resize: "vertical" }}
          placeholder={t("discovery.answerPlaceholder")}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit(answer);
            }
          }}
          disabled={submitting}
          autoFocus
        />
        <button className="btn-primary" style={{ alignSelf: "flex-end", padding: "10px 14px" }} disabled={submitting || !answer.trim()} onClick={() => submit(answer)}>
          <Send size={15} />
        </button>
      </div>
      {error && <ErrorNote error={error} />}
    </div>
  );
}

/** PromptMaster já travado (LOCKED) mas o handoff pra arquitetura falhou ou ainda não completou —
 * recuperável: repetir "Aprovar" não relanca o lock (já é LOCKED), só retenta o handoff. */
function LockedRecoveryPanel({ discovery, onAdvance }: { discovery: DiscoveryConversationDto; onAdvance: () => void }) {
  const { t } = useI18n();
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  async function retry() {
    setRetrying(true);
    setError(null);
    try {
      await discoveryClient.approvePromptMaster(discovery.missionId);
      onAdvance();
    } catch (err) {
      setError(toAppError(err));
      setRetrying(false);
    }
  }

  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, padding: 16, background: T.surface }}>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: T.textSub }}>{t("discovery.lockedRecovery")}</p>
      <button className="btn-primary" disabled={retrying} onClick={retry}>
        {retrying ? t("common.loading") : t("discovery.retryHandoff")}
      </button>
      {error && <ErrorNote error={error} />}
    </div>
  );
}

function FeatureReviewPanel({ discovery, onAdvance }: { discovery: DiscoveryConversationDto; onAdvance: () => void }) {
  const { t } = useI18n();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  const features = discovery.requirements.filter((r) => r.section === "features");

  async function decide(requirement: RequirementDto, decision: "CONFIRMED" | "REJECTED") {
    setBusyId(requirement.id);
    setError(null);
    try {
      await discoveryClient.decideRequirement(discovery.missionId, requirement.id, decision);
      onAdvance();
    } catch (err) {
      setError(toAppError(err));
    } finally {
      setBusyId(null);
    }
  }

  async function proceed() {
    setGenerating(true);
    setError(null);
    try {
      await discoveryClient.generatePromptMaster(discovery.missionId);
      onAdvance();
    } catch (err) {
      setError(toAppError(err));
    } finally {
      setGenerating(false);
    }
  }

  const pendingCount = features.filter((f) => f.status === "SUGGESTED").length;

  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, padding: 16, background: T.surface }}>
      <p style={{ margin: "0 0 12px", fontSize: 12.5, fontWeight: 700, color: T.text, display: "flex", alignItems: "center", gap: 6 }}>
        <Sparkles size={14} color={T.violet} /> {t("discovery.suggestionsTitle")}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
        {features.map((feature) => (
          <div
            key={feature.id}
            style={{
              display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", borderRadius: 10,
              border: `1px solid ${feature.status === "CONFIRMED" ? alpha(T.emerald, 30) : T.border}`,
              background: feature.status === "CONFIRMED" ? alpha(T.emerald, 5) : feature.status === "REJECTED" ? T.surfaceHover : T.surface,
              opacity: feature.status === "REJECTED" ? 0.55 : 1,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                <strong style={{ fontSize: 13, color: T.text }}>{feature.content}</strong>
                <span style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  {t((feature.confidence ?? 0) >= 0.8 ? "discovery.origin.inferred" : "discovery.origin.aiSuggested")}
                </span>
              </div>
              {feature.reasoningSummary && <p style={{ margin: "3px 0 0", fontSize: 11.5, color: T.textMuted, fontStyle: "italic" }}>{feature.reasoningSummary}</p>}
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button
                type="button"
                aria-label={t("discovery.accept")}
                disabled={busyId === feature.id}
                onClick={() => decide(feature, "CONFIRMED")}
                style={{
                  width: 26, height: 26, borderRadius: 7, display: "grid", placeItems: "center", cursor: "pointer",
                  border: `1px solid ${feature.status === "CONFIRMED" ? T.emerald : T.border}`,
                  background: feature.status === "CONFIRMED" ? T.emerald : "transparent",
                  color: feature.status === "CONFIRMED" ? "#fff" : T.textMuted,
                }}
              >
                <Check size={13} />
              </button>
              <button
                type="button"
                aria-label={t("discovery.reject")}
                disabled={busyId === feature.id}
                onClick={() => decide(feature, "REJECTED")}
                style={{
                  width: 26, height: 26, borderRadius: 7, display: "grid", placeItems: "center", cursor: "pointer",
                  border: `1px solid ${feature.status === "REJECTED" ? T.red : T.border}`,
                  background: feature.status === "REJECTED" ? T.red : "transparent",
                  color: feature.status === "REJECTED" ? "#fff" : T.textMuted,
                }}
              >
                <X size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {pendingCount > 0 && <p style={{ margin: "0 0 10px", fontSize: 12, color: T.textMuted }}>{t("discovery.pendingCount", { count: pendingCount })}</p>}

      <button className="btn-primary" disabled={generating} onClick={proceed}>
        {generating ? t("common.loading") : t("discovery.generatePromptMaster")}
      </button>
      {error && <ErrorNote error={error} />}
    </div>
  );
}

/**
 * Fase 5 — o Copilot nunca aplica direto: pedido em linguagem natural vira uma proposta (diff)
 * que o usuário revisa item a item antes de qualquer coisa entrar no documento.
 */
function CopilotEditor({ discovery, onAdvance }: { discovery: DiscoveryConversationDto; onAdvance: () => void }) {
  const { t } = useI18n();
  const [message, setMessage] = useState("");
  const [proposing, setProposing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [proposal, setProposal] = useState<CopilotProposalDto | null>(null);
  const [decisions, setDecisions] = useState<boolean[]>([]);

  async function propose() {
    if (!message.trim() || proposing) return;
    setProposing(true);
    setError(null);
    try {
      const result = await discoveryClient.proposeCopilotChange(discovery.missionId, message.trim());
      setProposal(result);
      setDecisions(result.changes.map(() => true));
    } catch (err) {
      setError(toAppError(err));
    } finally {
      setProposing(false);
    }
  }

  async function apply(acceptAll: boolean) {
    if (!proposal) return;
    setApplying(true);
    setError(null);
    try {
      const changes = proposal.changes.map((c, i) => ({ ...c, accepted: acceptAll || decisions[i] }));
      await discoveryClient.applyCopilotChanges(discovery.missionId, changes);
      setProposal(null);
      setMessage("");
      onAdvance();
    } catch (err) {
      setError(toAppError(err));
    } finally {
      setApplying(false);
    }
  }

  return (
    <div style={{ borderTop: `1px solid ${T.border}`, marginTop: 20, paddingTop: 18 }}>
      <p style={{ margin: "0 0 10px", fontSize: 12.5, fontWeight: 700, color: T.text, display: "flex", alignItems: "center", gap: 6 }}>
        <Bot size={14} color={T.indigo} /> {t("discovery.copilotEditorTitle")}
      </p>

      {!proposal && (
        <div style={{ display: "flex", gap: 8 }}>
          <input
            className="field-input"
            style={{ flex: 1 }}
            placeholder={t("discovery.copilotPlaceholder")}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") propose(); }}
            disabled={proposing}
          />
          <button className="btn-primary" disabled={proposing || !message.trim()} onClick={propose}>
            {proposing ? t("common.loading") : t("discovery.copilotSend")}
          </button>
        </div>
      )}

      {proposal && (
        <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: 14, background: T.surfaceHover }}>
          <p style={{ margin: "0 0 10px", fontSize: 12.5, color: T.textSub }}>{proposal.summary}</p>

          {proposal.changes.length === 0 ? (
            <p style={{ margin: "0 0 12px", fontSize: 12.5, color: T.textMuted }}>{t("discovery.copilotNoChanges")}</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
              {proposal.changes.map((c, i) => (
                <label key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12.5, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={decisions[i] ?? true}
                    onChange={(e) => setDecisions((prev) => prev.map((v, idx) => (idx === i ? e.target.checked : v)))}
                    style={{ marginTop: 3, flexShrink: 0 }}
                  />
                  <span style={{ lineHeight: 1.6 }}>
                    {c.action === "ADD" && <span style={{ color: T.emerald, fontWeight: 800 }}>+ </span>}
                    {c.action === "REMOVE" && <span style={{ color: T.red, fontWeight: 800 }}>− </span>}
                    {c.action === "EDIT" && <span style={{ color: T.amber, fontWeight: 800 }}>~ </span>}
                    {c.action === "EDIT" ? (
                      <>
                        <span style={{ textDecoration: "line-through", color: T.textMuted }}>{c.beforeContent}</span>
                        {" → "}
                        <span style={{ color: T.text }}>{c.afterContent}</span>
                      </>
                    ) : c.action === "REMOVE" ? (
                      <span style={{ color: T.textMuted }}>{c.beforeContent}</span>
                    ) : (
                      <span style={{ color: T.text }}>{c.afterContent}</span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button className="btn-primary" disabled={applying || proposal.changes.length === 0} onClick={() => apply(true)}>
              {applying ? t("common.loading") : t("discovery.copilotAcceptAll")}
            </button>
            {proposal.changes.length > 0 && (
              <button className="btn-ghost" disabled={applying} onClick={() => apply(false)}>
                {t("discovery.copilotApplySelected")}
              </button>
            )}
            <button className="btn-ghost" style={{ color: T.red }} disabled={applying} onClick={() => setProposal(null)}>
              {t("discovery.copilotDiscard")}
            </button>
          </div>
        </div>
      )}
      {error && <ErrorNote error={error} />}
    </div>
  );
}

function PromptMasterPanel({ discovery, onAdvance }: { discovery: DiscoveryConversationDto; onAdvance: () => void }) {
  const { t } = useI18n();
  const [approving, setApproving] = useState(false);
  const [showDocument, setShowDocument] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  // MISSÃO "Auto-Governança por IA" seção 14: Expresso é o padrão — só quem quer auditar cada
  // detalhe abre o modo avançado. Abre sozinho quando o gate falha por um motivo que não é uma
  // decisão pendente (ex: revisão incompleta), pra nunca deixar "Aprovar" cinza sem explicação.
  const pm = discovery.promptMaster;
  const [detailsOpen, setDetailsOpen] = useState(() => Boolean(pm && !pm.gate.passed && pm.gate.conditions.some((c) => !c.passed && c.code !== "NO_PENDING_USER_DECISIONS" && c.code !== "NO_UNRESOLVED_BLOCKERS")));
  if (!pm) return null;

  async function approve() {
    setApproving(true);
    setError(null);
    try {
      await discoveryClient.approvePromptMaster(discovery.missionId);
      onAdvance();
    } catch (err) {
      setError(toAppError(err));
      setApproving(false);
    }
  }

  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, padding: 20, background: T.surface }}>
      <p style={{ margin: "0 0 4px", fontSize: 11, color: T.violet, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
        {t("discovery.promptMasterEyebrow")}
      </p>
      <h2 style={{ margin: "0 0 18px", fontSize: 18, fontWeight: 800, color: T.text }}>{t("discovery.promptMasterTitle")}</h2>

      <PromptMasterSummary
        discovery={discovery}
        pm={pm}
        approving={approving}
        gatePassed={pm.gate.passed}
        onApprove={approve}
        detailsOpen={detailsOpen}
        onToggleDetails={() => setDetailsOpen((v) => !v)}
      />
      {error && <ErrorNote error={error} />}

      <ValidationGateChecklist missionId={discovery.missionId} gate={pm.gate} onAdvance={onAdvance} />
      <DecisionCenter missionId={discovery.missionId} findings={discovery.reviewFindings} onAdvance={onAdvance} />

      {detailsOpen && (
        <>
          <ReviewCouncilStatus reviewStatus={discovery.reviewStatus} executions={discovery.reviewerExecutions} />
          <FindingsDisclosure missionId={discovery.missionId} findings={discovery.reviewFindings} onAdvance={onAdvance} />

          <Section label={t("discovery.pm.vision")}>{pm.vision}</Section>
          <Section label={t("discovery.pm.objective")}>{pm.objective}</Section>
          <Section label={t("discovery.pm.audience")}>{pm.targetAudience}</Section>

          <ItemList label={t("discovery.pm.users")} items={pm.users} />
          <ItemList label={t("discovery.pm.features")} items={pm.features} checkable />
          <ItemList label={t("discovery.pm.businessRules")} items={pm.businessRules} />
          <FlowList label={t("discovery.pm.flow")} items={pm.flows} />
          <ItemList label={t("discovery.pm.data")} items={pm.data} />
          <ItemList label={t("discovery.pm.integrations")} items={pm.integrations} />
          <ItemList label={t("discovery.pm.security")} items={pm.security} />
          <ItemList label={t("discovery.pm.privacy")} items={pm.privacy} />
          <ItemList label={t("discovery.pm.nonFunctional")} items={pm.nonFunctional} />
          <ItemList label={t("discovery.pm.acceptanceCriteria")} items={pm.acceptanceCriteria} />
          <ItemList label={t("discovery.pm.outOfScope")} items={pm.outOfScope} muted />

          <CopilotEditor discovery={discovery} onAdvance={onAdvance} />
        </>
      )}

      <div style={{ marginTop: 6 }}>
        <button className="btn-ghost" type="button" onClick={() => setShowDocument(true)}>
          <FileText size={14} /> {t("discovery.viewFullDocument")}
        </button>
      </div>

      {showDocument && (
        <div onClick={() => setShowDocument(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={t("discovery.viewFullDocument")}
            style={{ width: "min(760px, 100%)", maxHeight: "85vh", overflowY: "auto", background: T.surfaceEl, border: `1px solid ${T.borderMid}`, borderRadius: 12, padding: 24 }}
          >
            <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 13, lineHeight: 1.6, color: T.textSub }}>{pm.fullMarkdown}</pre>
            <button className="btn-ghost" style={{ marginTop: 16 }} onClick={() => setShowDocument(false)}>
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <p style={{ margin: "0 0 4px", fontSize: 11.5, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
      <p style={{ margin: 0, fontSize: 13.5, color: T.textSub, lineHeight: 1.6 }}>{children}</p>
    </div>
  );
}

const SECTION_LABEL_STYLE: CSSProperties = { margin: "0 0 6px", fontSize: 11.5, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" };

/** Itens ainda SUGGESTED (não revisados individualmente) aparecem com um marcador diferente dos
 * já CONFIRMED — nunca com a mesma marca de "confirmado" sem uma decisão real por trás (Fase 8). */
const SEVERITY_STYLE: Record<ReviewFindingSeverity, { color: string; Icon: typeof AlertTriangle }> = {
  BLOCKER: { color: T.red, Icon: AlertOctagon },
  WARNING: { color: T.amber, Icon: AlertTriangle },
  ADVISORY: { color: T.indigo, Icon: Info },
  INFO: { color: T.textMuted, Icon: Info },
};

const REVIEWER_LABEL_KEY: Record<string, string> = {
  requirements: "discovery.reviewer.requirements",
  consistency: "discovery.reviewer.consistency",
  architectureFeasibility: "discovery.reviewer.architectureFeasibility",
  qa: "discovery.reviewer.qa",
  security: "discovery.reviewer.security",
  privacy: "discovery.reviewer.privacy",
  safety: "discovery.reviewer.safety",
  abuseMisuse: "discovery.reviewer.abuseMisuse",
  dataGovernance: "discovery.reviewer.dataGovernance",
};

/** listExecutions() (and therefore this DTO field) is a full audit trail — a retried reviewer's
 * old FAILED row stays alongside the new one (Fase 28: never lose telemetry). The UI, like the
 * Fase 9 gate, only cares about each reviewer's most recent attempt. */
function latestExecutionPerReviewer(executions: ReviewerExecutionDto[]): ReviewerExecutionDto[] {
  const byKey = new Map<string, ReviewerExecutionDto>();
  for (const e of executions) byKey.set(e.reviewerKey, e);
  return [...byKey.values()];
}

/** Fase 12 — o Review Council deixa de ser invisível: um resumo real sempre visível (nunca
 * escondido atrás de "tudo ok"), com telemetria auditável por agente (Fase 28) disponível a um
 * clique — provider/modelo já aparece implícito no fato de cada linha vir de uma chamada real. */
const REVIEWER_EXECUTION_STYLE: Record<ReviewerExecutionDto["status"], { color: string; Icon: typeof CheckCircle2 }> = {
  PASSED: { color: T.emerald, Icon: CheckCircle2 },
  PASSED_WITH_FALLBACK: { color: T.amber, Icon: AlertTriangle },
  DEGRADED: { color: T.textMuted, Icon: AlertTriangle },
  FAILED_BLOCKING: { color: T.red, Icon: XCircle },
};

function ReviewCouncilStatus({ reviewStatus, executions }: { reviewStatus: DiscoveryConversationDto["reviewStatus"]; executions: ReviewerExecutionDto[] }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const latest = latestExecutionPerReviewer(executions);
  if (latest.length === 0) return null;
  // MISSÃO "Auto-Governança por IA" seção 10: PASSED_WITH_FALLBACK conta como concluído (a
  // revisão aconteceu, só sem LLM) — só DEGRADED/FAILED_BLOCKING realmente faltam.
  const done = latest.filter((e) => e.status === "PASSED" || e.status === "PASSED_WITH_FALLBACK").length;

  const meta =
    reviewStatus === "REVIEW_COMPLETE"
      ? { color: T.emerald, Icon: CheckCircle2, labelKey: "discovery.council.complete" }
      : reviewStatus === "REVIEW_COMPLETE_DEGRADED"
        ? { color: T.amber, Icon: AlertTriangle, labelKey: "discovery.council.completeDegraded" }
        : reviewStatus === "REVIEW_PARTIALLY_COMPLETED"
          ? { color: T.red, Icon: AlertTriangle, labelKey: "discovery.council.partial" }
          : { color: T.textMuted, Icon: Info, labelKey: "discovery.council.pending" };

  return (
    <div style={{ marginBottom: 16 }}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", padding: 0, cursor: "pointer" }}
      >
        <meta.Icon size={14} color={meta.color} />
        <span style={{ fontSize: 12.5, color: T.textSub }}>{t(meta.labelKey, { done, total: latest.length })}</span>
        <span style={{ fontSize: 11, color: T.textMuted, textDecoration: "underline" }}>
          {expanded ? t("discovery.council.hideDetails") : t("discovery.council.showDetails")}
        </span>
      </button>
      {expanded && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 5, paddingLeft: 20 }}>
          {latest.map((e) => {
            const style = REVIEWER_EXECUTION_STYLE[e.status];
            return (
              <div key={e.reviewerKey} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <style.Icon size={13} color={style.color} />
                <span style={{ flex: 1, color: T.textSub }}>{t(REVIEWER_LABEL_KEY[e.reviewerKey] ?? e.reviewerKey)}</span>
                {e.attemptCount > 1 && <span style={{ color: T.textMuted, fontSize: 11 }}>{t("discovery.council.attempts", { count: e.attemptCount })}</span>}
                {e.latencyMs != null && <span style={{ color: T.textMuted }}>{(e.latencyMs / 1000).toFixed(1)}s</span>}
                {e.status !== "PASSED" && e.errorCode && <span style={{ color: style.color, fontSize: 11 }}>{e.errorCode}</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const GATE_CONDITION_LABEL_KEY: Record<ValidationGateConditionCode, string> = {
  NO_UNRESOLVED_BLOCKERS: "discovery.gate.blockers",
  NO_PENDING_USER_DECISIONS: "discovery.gate.decisions",
  REQUIRED_SECTIONS_VALID: "discovery.gate.sections",
  REVIEW_COUNCIL_COMPLETED: "discovery.gate.review",
};

/** Fase 9 — PROMPTMASTER_VALIDATION_GATE: a mesma checklist que o backend usa para decidir se pode
 * travar o PromptMaster, exposta ANTES do clique em "Aprovar" (nunca um erro técnico cru depois).
 * Some quando tudo passa — igual ao FindingsList, não polui a tela quando não há nada a resolver. */
function ValidationGateChecklist({ missionId, gate, onAdvance }: { missionId: string; gate: ValidationGateDto; onAdvance: () => void }) {
  const { t } = useI18n();
  const [retrying, setRetrying] = useState<string | null>(null);
  if (gate.passed) return null;

  async function retry(reviewerKey: string) {
    setRetrying(reviewerKey);
    try {
      await discoveryClient.retryReviewer(missionId, reviewerKey);
      onAdvance();
    } finally {
      setRetrying(null);
    }
  }

  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 14px", marginBottom: 16, background: T.surfaceHover }}>
      <p style={{ margin: "0 0 8px", fontSize: 11.5, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {t("discovery.gate.title")}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {gate.conditions.map((c) => (
          <div key={c.code} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12.5, color: c.passed ? T.textSub : T.text }}>
            {c.passed
              ? <CheckCircle2 size={15} color={T.emerald} style={{ flexShrink: 0, marginTop: 1 }} />
              : <XCircle size={15} color={T.red} style={{ flexShrink: 0, marginTop: 1 }} />}
            <span>
              {t(GATE_CONDITION_LABEL_KEY[c.code])}
              {!c.passed && c.failedReviewers?.map((key) => (
                <button
                  key={key}
                  type="button"
                  className="btn-ghost"
                  style={{ marginLeft: 6, padding: "2px 8px", fontSize: 11 }}
                  disabled={retrying === key}
                  onClick={() => retry(key)}
                >
                  {retrying === key ? t("common.loading") : t("discovery.gate.retryReviewer", { reviewer: key })}
                </button>
              ))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** MISSÃO "Auto-Governança por IA" seção 3: só duas classificações realmente exigem o usuário —
 * o resto (AUTO/AUTO_WITH_DISCLOSURE/USER_CONFIRMATION) a IA já resolveu ou aplica sozinha. */
function isBlockingOutcome(outcome: ReviewFindingDto["decisionOutcome"]): boolean {
  return outcome === "USER_DECISION_REQUIRED" || outcome === "BLOCKED";
}

/** Decision Center (Fase 8) — a ÚNICA lista de coisas que realmente precisam do usuário. Nunca um
 * erro técnico cru ("Encontramos alguns pontos antes de continuar"); escolher uma opção aplica a
 * mudança de verdade pelo mesmo mecanismo do Copilot. */
function DecisionCenter({ missionId, findings, onAdvance }: { missionId: string; findings: ReviewFindingDto[]; onAdvance: () => void }) {
  const { t } = useI18n();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [customText, setCustomText] = useState<Record<string, string>>({});
  const open = findings.filter((f) => f.status === "OPEN" && isBlockingOutcome(f.decisionOutcome));
  if (open.length === 0) return null;

  async function decide(findingId: string, chosenOption: string) {
    if (!chosenOption.trim()) return;
    setBusyId(findingId);
    try {
      await discoveryClient.decideFinding(missionId, findingId, chosenOption.trim());
      onAdvance();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
      <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 700, color: T.text }}>{t("discovery.decisionCenterTitle")}</p>
      {open.map((finding) => {
        const { color, Icon } = SEVERITY_STYLE[finding.severity];
        return (
          <div key={finding.id} style={{ display: "flex", gap: 10, padding: "10px 12px", borderRadius: 10, background: alpha(color, 7), border: `1px solid ${alpha(color, 22)}` }}>
            <Icon size={15} color={color} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1 }}>
              <p style={{ margin: "0 0 3px", fontSize: 12, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {t(`discovery.severity.${finding.severity.toLowerCase()}`)}
              </p>
              <p style={{ margin: 0, fontSize: 13, color: T.text }}>{finding.finding}</p>

              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                {finding.recommendedResolutions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className="btn-ghost"
                    style={{ justifyContent: "flex-start", fontSize: 12.5, padding: "6px 10px" }}
                    disabled={busyId === finding.id}
                    onClick={() => decide(finding.id, option)}
                  >
                    {option}
                  </button>
                ))}
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    className="field-input"
                    style={{ flex: 1, padding: "6px 10px", fontSize: 12.5 }}
                    placeholder={t("discovery.decisionOtherPlaceholder")}
                    value={customText[finding.id] ?? ""}
                    onChange={(e) => setCustomText((prev) => ({ ...prev, [finding.id]: e.target.value }))}
                    disabled={busyId === finding.id}
                  />
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ fontSize: 12.5, padding: "6px 10px" }}
                    disabled={busyId === finding.id || !customText[finding.id]?.trim()}
                    onClick={() => decide(finding.id, customText[finding.id] ?? "")}
                  >
                    {busyId === finding.id ? t("common.loading") : t("discovery.decisionOtherSubmit")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Tudo que a IA já resolveu sozinha (ou tentou e não achou um alvo mecânico) — nunca escondido
 * (Fase 20: warnings sempre visíveis), mas também nunca pedindo ação do usuário. Fica dentro do
 * modo avançado (Fase 14/35): quem quer auditar cada detalhe pode, quem não quer não precisa. */
function FindingsDisclosure({ missionId, findings, onAdvance }: { missionId: string; findings: ReviewFindingDto[]; onAdvance: () => void }) {
  const { t } = useI18n();
  const [busyId, setBusyId] = useState<string | null>(null);
  const relevant = findings.filter((f) => !isBlockingOutcome(f.decisionOutcome));
  if (relevant.length === 0) return null;

  async function resolve(findingId: string) {
    setBusyId(findingId);
    try {
      await discoveryClient.resolveFinding(missionId, findingId);
      onAdvance();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
      {relevant.map((finding) => {
        const { color, Icon } = SEVERITY_STYLE[finding.severity];
        const resolved = finding.status !== "OPEN";
        return (
          <div key={finding.id} style={{ display: "flex", gap: 10, padding: "10px 12px", borderRadius: 10, background: alpha(color, 5), border: `1px solid ${alpha(color, 16)}`, opacity: resolved ? 0.75 : 1 }}>
            <Icon size={15} color={color} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1 }}>
              <p style={{ margin: "0 0 3px", fontSize: 11.5, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {t(`discovery.severity.${finding.severity.toLowerCase()}`)}
                {resolved && <span style={{ marginLeft: 8, color: T.emerald, fontWeight: 700 }}>· {t("discovery.autoResolvedTag")}</span>}
              </p>
              <p style={{ margin: 0, fontSize: 13, color: T.text }}>{finding.finding}</p>
              {!resolved && finding.recommendedResolutions.length > 0 && (
                <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12, color: T.textSub }}>
                  {finding.recommendedResolutions.map((r) => <li key={r}>{r}</li>)}
                </ul>
              )}
              {!resolved && (
                <button type="button" className="btn-ghost" style={{ marginTop: 8, padding: "4px 10px", fontSize: 11.5 }} disabled={busyId === finding.id} onClick={() => resolve(finding.id)}>
                  {busyId === finding.id ? t("common.loading") : t("discovery.markResolved")}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** MISSÃO "Auto-Governança por IA" seção 24 — o resumo consolidado que substitui "revisar cada
 * requisito" por "uma aprovação". A IA fez o trabalho pesado; o usuário só vê o placar final. */
function PromptMasterSummary({
  discovery, pm, approving, gatePassed, onApprove, onToggleDetails, detailsOpen,
}: {
  discovery: DiscoveryConversationDto; pm: PromptMasterDto; approving: boolean; gatePassed: boolean;
  onApprove: () => void; onToggleDetails: () => void; detailsOpen: boolean;
}) {
  const { t } = useI18n();
  const forVersion = discovery.requirements.filter((r) => r.promptMasterId === pm.id && (r.status === "CONFIRMED" || r.status === "SUGGESTED"));
  const aiCompleted = forVersion.filter((r) => r.origin === "AI_REFINED").length;
  const userProvided = forVersion.length - aiCompleted;
  const autoFixed = discovery.reviewFindings.filter((f) => f.resolvedBy === "ai-auto-repair").length;
  const userDecisions = discovery.reviewFindings.filter((f) => f.resolvedBy === "user").length;
  const pendingDecisions = discovery.reviewFindings.filter((f) => f.status === "OPEN" && isBlockingOutcome(f.decisionOutcome)).length;

  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, padding: "16px 18px", marginBottom: 18, background: T.surfaceHover }}>
      <p style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700, color: T.text }}>
        {pendingDecisions > 0 ? t("discovery.summary.titlePending") : t("discovery.summary.titleReady")}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 20px", marginBottom: 14 }}>
        <SummaryStat value={userProvided} label={t("discovery.summary.userProvided")} />
        <SummaryStat value={aiCompleted} label={t("discovery.summary.aiCompleted")} />
        <SummaryStat value={autoFixed} label={t("discovery.summary.autoFixed")} />
        <SummaryStat value={userDecisions} label={t("discovery.summary.userDecisions")} />
        <SummaryStat value={pendingDecisions} label={t("discovery.summary.pending")} color={pendingDecisions > 0 ? T.red : undefined} />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button className="btn-primary" disabled={approving || !gatePassed} onClick={onApprove}>
          {approving ? t("common.loading") : t("discovery.approve")}
        </button>
        <button type="button" className="btn-ghost" onClick={onToggleDetails}>
          {detailsOpen ? t("discovery.summary.hideDetails") : t("discovery.summary.showDetails")}
        </button>
      </div>
    </div>
  );
}

function SummaryStat({ value, label, color }: { value: number; label: string; color?: string }) {
  return (
    <div>
      <span style={{ fontSize: 20, fontWeight: 800, color: color ?? T.text }}>{value}</span>
      <span style={{ fontSize: 11.5, color: T.textMuted, marginLeft: 6 }}>{label}</span>
    </div>
  );
}

function ItemList({ label, items, checkable, muted }: { label: string; items: RequirementDto[]; checkable?: boolean; muted?: boolean }) {
  if (items.length === 0) return null;
  return (
    <div style={{ marginBottom: 14 }}>
      <p style={SECTION_LABEL_STYLE}>{label}</p>
      <ul style={{ margin: 0, paddingLeft: checkable ? 0 : 18, listStyle: checkable ? "none" : "disc" }}>
        {items.map((item) => (
          <li
            key={item.id}
            style={{
              display: checkable ? "flex" : "list-item", alignItems: "center", gap: 8,
              fontSize: checkable ? 13 : 12.5, color: muted ? T.textMuted : T.textSub, marginBottom: 6, lineHeight: 1.5,
            }}
          >
            {checkable && (item.status === "CONFIRMED" ? <Check size={13} color={T.emerald} style={{ flexShrink: 0 }} /> : <span style={{ width: 13, height: 13, borderRadius: "50%", border: `1.5px solid ${T.borderStrong}`, flexShrink: 0 }} />)}
            {item.content}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FlowList({ label, items }: { label: string; items: RequirementDto[] }) {
  if (items.length === 0) return null;
  return (
    <div style={{ marginBottom: 14 }}>
      <p style={SECTION_LABEL_STYLE}>{label}</p>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
        {items.map((step, i) => (
          <span key={step.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: T.textSub, background: T.surfaceHover, border: `1px solid ${T.border}`, borderRadius: 20, padding: "4px 10px" }}>{step.content}</span>
            {i < items.length - 1 && <span style={{ color: T.textMuted }}>→</span>}
          </span>
        ))}
      </div>
    </div>
  );
}
