import { useState } from "react";
import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
import { CheckCircle2, XCircle, AlertTriangle, AlertOctagon, Info, ChevronLeft, Sparkles, Bot } from "lucide-react";
import { T, alpha } from "../design/tokens";
import { useI18n } from "../i18n/I18nContext";
import { ApiClientError, type AppError } from "../api/client";
import {
  marketplaceSolutionClient,
  type CustomizationPlanDto,
  type PricingQuoteDto,
  type MarketplacePurchaseDto,
  type MarketplacePurchaseGenerationDto,
  type MarketplaceReviewFindingDto,
  type MarketplaceReviewSessionDto,
  type ReviewFindingSeverity,
} from "../api/marketplace-solution.client";

function toAppError(err: unknown): AppError {
  return err instanceof ApiClientError ? err.appError : { category: "UNKNOWN", status: 0, code: "UNKNOWN", translationKey: "errors.unknown" };
}

function toErrorCode(err: unknown): string | null {
  return err instanceof ApiClientError ? err.appError.code : null;
}

function formatCents(cents: number, currency = "BRL"): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100);
}

type Step = "describe" | "clarify" | "plan" | "review" | "quote" | "done";

/** Só estas duas classificações da DecisionPolicy realmente exigem alguém decidindo — o resto
 * (AUTO/AUTO_WITH_DISCLOSURE/USER_CONFIRMATION) a IA já resolveu ou aplicou sozinha. */
function isBlockingOutcome(outcome: MarketplaceReviewFindingDto["decisionOutcome"]): boolean {
  return outcome === "USER_DECISION_REQUIRED" || outcome === "BLOCKED";
}

/**
 * MISSÃO "Marketplace de Sistemas Completos" seção 10/12/17 — Discovery de customização +
 * revisão do Customization Plan + compra. Simplificação deliberada (ver relatório): descrição em
 * uma única mensagem, não um Discovery multi-turn completo.
 *
 * MISSÃO "Completar o fluxo de compra/personalização" — o Review Council já bloqueava
 * corretamente; o que faltava era esta tela: quando sobra algo que só o comprador pode decidir, a
 * experiência continua NA MESMA PÁGINA (nunca um erro técnico cru, nunca Engineering Mode).
 */
export function SystemCustomizePage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const asIs = searchParams.get("asIs") === "1";
  const navigate = useNavigate();
  const { t } = useI18n();

  const [step, setStep] = useState<Step>("describe");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [driftError, setDriftError] = useState(false);
  const [plan, setPlan] = useState<CustomizationPlanDto | null>(null);
  const [quote, setQuote] = useState<PricingQuoteDto | null>(null);
  const [purchase, setPurchase] = useState<MarketplacePurchaseDto | null>(null);

  async function submitDescription() {
    if (!slug) return;
    setBusy(true);
    setError(null);
    setDriftError(false);
    try {
      const created = await marketplaceSolutionClient.createCustomizationPlan(slug, {
        rawBusinessDescription: asIs ? undefined : description.trim(),
        asIs,
      });
      setPlan(created);
      setStep(created.needsClarification ? "clarify" : "plan");
    } catch (err) {
      setError(toAppError(err));
    } finally {
      setBusy(false);
    }
  }

  async function approvePlan() {
    if (!plan) return;
    setBusy(true);
    setError(null);
    setDriftError(false);
    try {
      const approved = await marketplaceSolutionClient.approvePlan(plan.id);
      if (approved.status === "APPROVED") {
        setPlan(approved);
        const newQuote = await marketplaceSolutionClient.quotePlan(approved.id);
        setQuote(newQuote);
        setStep("quote");
      } else {
        setPlan(approved);
        setStep("review");
      }
    } catch (err) {
      if (toErrorCode(err) === "MARKETPLACE_PUBLISHED_SOLUTION_REVIEW_DRIFT") {
        setDriftError(true);
      } else {
        setError(toAppError(err));
      }
    } finally {
      setBusy(false);
    }
  }

  /** Fase 18 (Auto Continue): uma sessão de revisão que chegou a READY já foi aprovada por baixo
   * (MarketplaceReviewService.runCycle trava o PromptMaster e aprova o plano sozinho) — a mesma
   * experiência segue direto para o preço, sem o comprador precisar clicar em "Aprovar" de novo. */
  async function onReviewAdvance(session: MarketplaceReviewSessionDto) {
    if (session.status === "READY" && plan) {
      const finalPlan = await marketplaceSolutionClient.getPlan(plan.id);
      setPlan(finalPlan);
      const newQuote = await marketplaceSolutionClient.quotePlan(finalPlan.id);
      setQuote(newQuote);
      setStep("quote");
    } else if (plan) {
      setPlan({ ...plan, review: session });
    }
  }

  async function confirmPurchase() {
    if (!plan || !quote) return;
    setBusy(true);
    setError(null);
    try {
      const result = await marketplaceSolutionClient.purchase(plan.id, quote.id);
      setPurchase(result);
      setStep("done");
    } catch (err) {
      setError(toAppError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 24px 64px" }}>
      <Link to={`/marketplace/systems/${slug}`} style={{ display: "inline-flex", alignItems: "center", gap: 4, color: T.textMuted, fontSize: 12.5, textDecoration: "none", marginBottom: 18 }}>
        <ChevronLeft size={14} /> {t("marketplace.system.backToCatalog")}
      </Link>

      {step === "describe" && (
        <div>
          <h1 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800, color: T.text }}>
            {asIs ? t("marketplace.system.buyAsIs") : t("marketplace.customize.button")}
          </h1>
          {!asIs && (
            <>
              <p style={{ margin: "0 0 16px", fontSize: 13.5, color: T.textSub, lineHeight: 1.6 }}>{t("marketplace.customize.hint")}</p>
              <label className="field-label" htmlFor="business-description">{t("marketplace.customize.label")}</label>
              <textarea
                id="business-description"
                className="field-input field-textarea"
                autoFocus
                placeholder={t("marketplace.customize.placeholder")}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
              />
            </>
          )}
          {asIs && <p style={{ margin: "0 0 16px", fontSize: 13.5, color: T.textSub }}>{t("marketplace.system.buyAsIsHint")}</p>}
          {error && <ErrorNote error={error} />}
          <button className="btn-primary" style={{ marginTop: 12 }} disabled={busy || (!asIs && !description.trim())} onClick={submitDescription}>
            {busy ? t("common.loading") : t("marketplace.customize.submit")}
          </button>
        </div>
      )}

      {step === "clarify" && plan && (
        <div>
          <h1 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800, color: T.text }}>{t("marketplace.clarification.title")}</h1>
          <p style={{ margin: "0 0 16px", fontSize: 13.5, color: T.textSub, lineHeight: 1.6 }}>{plan.clarificationQuestion}</p>
          <textarea
            className="field-input field-textarea"
            autoFocus
            placeholder={t("marketplace.customize.placeholder")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
          />
          {error && <ErrorNote error={error} />}
          <button className="btn-primary" style={{ marginTop: 12 }} disabled={busy || !description.trim()} onClick={submitDescription}>
            {busy ? t("common.loading") : t("marketplace.clarification.backToDescribe")}
          </button>
        </div>
      )}

      {step === "plan" && plan && (
        <div>
          <h1 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800, color: T.text }}>{t("marketplace.customize.planTitle")}</h1>
          <p style={{ margin: "0 0 20px", fontSize: 13.5, color: T.textSub, lineHeight: 1.6 }}>{plan.businessContext}</p>

          {plan.architecturalChangesDetected.length > 0 && (
            <div style={{ padding: "12px 14px", borderRadius: 10, background: alpha(T.red, 8), border: `1px solid ${alpha(T.red, 22)}`, marginBottom: 18 }}>
              <p style={{ display: "flex", alignItems: "center", gap: 6, margin: "0 0 6px", fontSize: 12.5, fontWeight: 700, color: T.red }}>
                <AlertTriangle size={14} /> {t("marketplace.plan.architecturalChangeTitle")}
              </p>
              <ul style={{ margin: "0 0 8px", paddingLeft: 18, fontSize: 12.5, color: T.textSub }}>
                {plan.architecturalChangesDetected.map((c) => <li key={c}>{c}</li>)}
              </ul>
              <p style={{ margin: 0, fontSize: 12, color: T.textMuted }}>{t("marketplace.plan.architecturalChangeHint")}</p>
            </div>
          )}

          <PlanSection label={t("marketplace.plan.keep")} icon={<CheckCircle2 size={14} color={T.emerald} />} items={plan.keep} />
          <PlanSection label={t("marketplace.plan.remove")} icon={<XCircle size={14} color={T.red} />} items={plan.remove.map((r) => r.targetContent)} />
          <PlanSection label={t("marketplace.plan.modify")} icon={<Sparkles size={14} color={T.indigo} />} items={plan.modify.map((m) => `${m.targetContent} → ${m.newContent}`)} />
          <PlanSection label={t("marketplace.plan.add")} icon={<Sparkles size={14} color={T.indigo} />} items={plan.add.map((a) => a.content)} />

          {plan.missingInformation.length > 0 && (
            <PlanSection label={t("marketplace.plan.missingInformation")} icon={<AlertTriangle size={14} color={T.amber} />} items={plan.missingInformation} muted />
          )}
          {plan.assumptions.length > 0 && (
            <PlanSection label={t("marketplace.plan.assumptions")} icon={<AlertTriangle size={14} color={T.textMuted} />} items={plan.assumptions} muted />
          )}
          {plan.droppedForPolicy.length > 0 && (
            <PlanSection label={t("marketplace.plan.droppedForPolicy")} icon={<XCircle size={14} color={T.textMuted} />} items={plan.droppedForPolicy.map((d) => d.item)} muted />
          )}

          {driftError && <p style={{ margin: "10px 0", fontSize: 12.5, color: T.amber, lineHeight: 1.6 }}>{t("marketplace.review.publishedDrift")}</p>}
          {error && <ErrorNote error={error} />}
          <button className="btn-primary" style={{ marginTop: 16 }} disabled={busy} onClick={approvePlan}>
            {busy ? t("common.loading") : t("marketplace.plan.approve")}
          </button>
        </div>
      )}

      {step === "review" && plan?.review && (
        <ReviewStep planId={plan.id} session={plan.review} onAdvance={onReviewAdvance} />
      )}

      {step === "quote" && quote && plan && (
        <div>
          <h1 style={{ margin: "0 0 16px", fontSize: 22, fontWeight: 800, color: T.text }}>{t("marketplace.quote.title")}</h1>
          {plan.review && <ApprovalSummary plan={plan} review={plan.review} />}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16, fontSize: 13.5 }}>
            <QuoteLine label={t("marketplace.quote.base")} value={formatCents(quote.basePrice, quote.currency)} />
            {quote.customizationPrice > 0 && <QuoteLine label={t("marketplace.quote.customization")} value={formatCents(quote.customizationPrice, quote.currency)} />}
            {quote.integrationPrice > 0 && <QuoteLine label={t("marketplace.quote.integrations")} value={formatCents(quote.integrationPrice, quote.currency)} />}
            <div style={{ borderTop: `1px solid ${T.border}`, marginTop: 6, paddingTop: 8 }}>
              <QuoteLine label={t("marketplace.quote.total")} value={formatCents(quote.total, quote.currency)} bold />
            </div>
          </div>
          {error && <ErrorNote error={error} />}
          <button className="btn-primary" disabled={busy} onClick={confirmPurchase}>
            {busy ? t("common.loading") : t("marketplace.quote.confirm")}
          </button>
        </div>
      )}

      {step === "done" && purchase && (
        <div style={{ textAlign: "center", padding: "32px 0" }}>
          <CheckCircle2 size={40} color={T.emerald} style={{ marginBottom: 12 }} />
          <h1 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 800, color: T.text }}>{t("marketplace.purchase.done")}</h1>
          <p style={{ margin: "0 0 20px", fontSize: 13.5, color: T.textSub }}>{t("marketplace.purchase.doneHint")}</p>
          {purchase.generation.generationMode && <GenerationProvenance generation={purchase.generation} />}
          <button className="btn-primary" onClick={() => navigate(`/missions/${purchase.derivedMissionId}`)}>
            {t("marketplace.purchase.viewMission")}
          </button>
        </div>
      )}
    </div>
  );
}

const SEVERITY_STYLE: Record<ReviewFindingSeverity, { color: string; Icon: typeof AlertTriangle }> = {
  BLOCKER: { color: T.red, Icon: AlertOctagon },
  WARNING: { color: T.amber, Icon: AlertTriangle },
  ADVISORY: { color: T.indigo, Icon: Info },
  INFO: { color: T.textMuted, Icon: Info },
};

/**
 * Fase 6/17 do audit "Completar o fluxo de compra/personalização" — o Review Council deixa de ser
 * um beco sem saída: mostra o que a IA já resolveu sozinha e, quando sobra algo, uma decisão real
 * de negócio (nunca um código de erro cru) com as opções recomendadas pelo revisor.
 */
function ReviewStep({ planId, session, onAdvance }: { planId: string; session: MarketplaceReviewSessionDto; onAdvance: (session: MarketplaceReviewSessionDto) => void | Promise<void> }) {
  const { t } = useI18n();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [customText, setCustomText] = useState<Record<string, string>>({});
  const [resuming, setResuming] = useState(false);

  const openBlocking = session.findings.filter((f) => f.status === "OPEN" && isBlockingOutcome(f.decisionOutcome));
  // Fase 20 do audit — "WARNING ainda é disclosed no resumo final": tudo que não é uma decisão
  // real de negócio aparece aqui independente de já ter sido resolvido automaticamente ou não
  // (o Auto-Repair Loop tem um teto por rodada — o que sobrar continua OPEN, nunca escondido).
  const disclosed = session.findings.filter((f) => !isBlockingOutcome(f.decisionOutcome));

  async function decide(findingId: string, chosenOption: string) {
    if (!chosenOption.trim()) return;
    setBusyId(findingId);
    try {
      const next = await marketplaceSolutionClient.decideFinding(planId, findingId, chosenOption.trim());
      await onAdvance(next);
    } finally {
      setBusyId(null);
    }
  }

  async function delegate(findingId: string) {
    setBusyId(findingId);
    try {
      const next = await marketplaceSolutionClient.delegateToAi(planId, findingId, customText[findingId]?.trim());
      await onAdvance(next);
    } finally {
      setBusyId(null);
    }
  }

  async function resolve(findingId: string) {
    setBusyId(findingId);
    try {
      const next = await marketplaceSolutionClient.resolveFinding(planId, findingId);
      await onAdvance(next);
    } finally {
      setBusyId(null);
    }
  }

  async function resume() {
    setResuming(true);
    try {
      const next = await marketplaceSolutionClient.resumeReview(planId);
      await onAdvance(next);
    } finally {
      setResuming(false);
    }
  }

  return (
    <div>
      <h1 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800, color: T.text }}>{t("marketplace.review.title")}</h1>
      <p style={{ margin: "0 0 18px", fontSize: 13.5, color: T.textSub, lineHeight: 1.6 }}>
        {session.autoResolvedCount > 0 && `${t("marketplace.review.summaryAutoResolved", { count: session.autoResolvedCount })} `}
        {openBlocking.length > 0 ? t("marketplace.review.summaryPendingDecisions", { count: openBlocking.length }) : t("marketplace.review.summaryAllClear")}
      </p>

      {session.status === "REVIEW_LOOP_EXHAUSTED" && (
        <div style={{ padding: "12px 14px", borderRadius: 10, background: alpha(T.amber, 8), border: `1px solid ${alpha(T.amber, 22)}`, marginBottom: 16 }}>
          <p style={{ margin: "0 0 8px", fontSize: 12.5, color: T.text }}>{t("marketplace.review.loopExhausted")}</p>
          <button className="btn-ghost" disabled={resuming} onClick={resume}>
            {resuming ? t("common.loading") : t("marketplace.review.resume")}
          </button>
        </div>
      )}

      {openBlocking.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.text }}>{t("marketplace.review.decisionTitle")}</p>
          {openBlocking.map((finding) => {
            const { color, Icon } = SEVERITY_STYLE[finding.severity];
            const isBusy = busyId === finding.id;
            return (
              <div key={finding.id} style={{ display: "flex", gap: 10, padding: "12px 14px", borderRadius: 10, background: alpha(color, 7), border: `1px solid ${alpha(color, 22)}` }}>
                <Icon size={15} color={color} style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ flex: 1 }}>
                  <p style={{ margin: "0 0 3px", fontSize: 11.5, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    {t(`marketplace.review.severity.${finding.severity.toLowerCase()}`)}
                  </p>
                  <p style={{ margin: 0, fontSize: 13.5, color: T.text }}>{finding.finding}</p>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
                    {finding.recommendedResolutions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        className="btn-ghost"
                        style={{ justifyContent: "flex-start", fontSize: 12.5, padding: "6px 10px" }}
                        disabled={isBusy}
                        onClick={() => decide(finding.id, option)}
                      >
                        {option}
                      </button>
                    ))}
                    <div style={{ display: "flex", gap: 6 }}>
                      <input
                        className="field-input"
                        style={{ flex: 1, padding: "6px 10px", fontSize: 12.5 }}
                        placeholder={t("marketplace.review.decisionOtherPlaceholder")}
                        value={customText[finding.id] ?? ""}
                        onChange={(e) => setCustomText((prev) => ({ ...prev, [finding.id]: e.target.value }))}
                        disabled={isBusy}
                      />
                      <button
                        type="button"
                        className="btn-ghost"
                        style={{ fontSize: 12.5, padding: "6px 10px" }}
                        disabled={isBusy || !customText[finding.id]?.trim()}
                        onClick={() => decide(finding.id, customText[finding.id] ?? "")}
                      >
                        {isBusy ? t("common.loading") : t("marketplace.review.decisionOtherSubmit")}
                      </button>
                    </div>
                    <button
                      type="button"
                      className="btn-ghost"
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: T.textMuted, padding: "6px 10px" }}
                      disabled={isBusy}
                      onClick={() => delegate(finding.id)}
                    >
                      <Bot size={13} /> {t("marketplace.review.delegateToAi")}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {disclosed.length > 0 && (
        <details style={{ marginBottom: 8 }}>
          <summary style={{ cursor: "pointer", fontSize: 12.5, color: T.textMuted, marginBottom: 8 }}>
            {t("marketplace.review.resolvedDisclosureTitle")} ({disclosed.length})
          </summary>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
            {disclosed.map((finding) => {
              const { color, Icon } = SEVERITY_STYLE[finding.severity];
              const isOpen = finding.status === "OPEN";
              const isBusy = busyId === finding.id;
              return (
                <div key={finding.id} style={{ display: "flex", gap: 8, padding: "8px 10px", borderRadius: 8, background: alpha(color, 4), opacity: isOpen ? 1 : 0.75 }}>
                  <Icon size={13} color={color} style={{ flexShrink: 0, marginTop: 1 }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 12.5, color: T.textSub }}>
                      {finding.finding}
                      {!isOpen && <span style={{ marginLeft: 8, color: T.emerald, fontWeight: 700 }}>· {t("discovery.autoResolvedTag")}</span>}
                    </p>
                    {isOpen && (
                      <button type="button" className="btn-ghost" style={{ marginTop: 6, padding: "3px 8px", fontSize: 11 }} disabled={isBusy} onClick={() => resolve(finding.id)}>
                        {isBusy ? t("common.loading") : t("discovery.markResolved")}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}

/** Fase 17 — a "Sua versão está pronta": um resumo real, calculado a partir do próprio plano e da
 * sessão de revisão (nunca um contador paralelo), no exato momento em que o gate acabou de passar. */
function ApprovalSummary({ plan, review }: { plan: CustomizationPlanDto; review: MarketplaceReviewSessionDto }) {
  const { t } = useI18n();
  const reviewerCount = new Set(review.reviewerExecutions.map((e) => e.reviewerKey)).size;
  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, padding: "16px 18px", marginBottom: 18, background: T.surfaceHover }}>
      <p style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: T.text, display: "flex", alignItems: "center", gap: 6 }}>
        <CheckCircle2 size={16} color={T.emerald} /> {t("marketplace.review.summaryReadyTitle")}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 20px" }}>
        <SummaryStat value={plan.keep.length} label={t("marketplace.review.summaryKept")} />
        <SummaryStat value={plan.modify.length} label={t("marketplace.review.summaryChanged")} />
        <SummaryStat value={plan.add.length} label={t("marketplace.review.summaryAdded")} />
        <SummaryStat value={plan.remove.length} label={t("marketplace.review.summaryRemoved")} />
        <SummaryStat value={reviewerCount} label={t("marketplace.review.summaryReviewers")} />
        <SummaryStat value={review.autoResolvedCount} label={t("marketplace.review.summaryAutoFixed")} />
        <SummaryStat value={review.userDecisionsMadeCount} label={t("marketplace.review.summaryYourDecisions")} />
        <SummaryStat value={0} label={t("marketplace.review.summaryBlockers")} />
      </div>
    </div>
  );
}

function SummaryStat({ value, label }: { value: number; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
      <span style={{ fontSize: 16, fontWeight: 800, color: T.text }}>{value}</span>
      <span style={{ fontSize: 11.5, color: T.textMuted }}>{label}</span>
    </div>
  );
}

/**
 * MISSÃO "Targeted Generation no Marketplace" — Fase 30 (Provenance UI): nunca "gerou tudo de
 * novo" opaco. Mostra de onde a mission derivada veio e o que foi realmente reaproveitado —
 * sempre o mesmo dado real persistido em MarketplaceGenerationScopeService (nunca um número
 * inventado só para a tela).
 */
function GenerationProvenance({ generation }: { generation: MarketplacePurchaseGenerationDto }) {
  const { t } = useI18n();
  if (!generation.generationMode) return null;
  const reusedPct = generation.impactScore != null ? Math.round(generation.impactScore * 100) : null;
  return (
    <div style={{ textAlign: "left", border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 16px", margin: "0 0 20px", background: T.surfaceHover }}>
      <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 6 }}>
        <Sparkles size={13} color={T.indigo} />
        {generation.generationMode === "TARGETED" ? t("marketplace.provenance.targetedTitle") : t("marketplace.provenance.fullTitle")}
      </p>
      {reusedPct != null && (
        <p style={{ margin: "0 0 4px", fontSize: 13.5, color: T.text }}>
          {t("marketplace.provenance.reusedPct", { pct: reusedPct })}
        </p>
      )}
      {generation.totalRequirements != null && generation.reusedRequirements != null && (
        <p style={{ margin: 0, fontSize: 12, color: T.textMuted }}>
          {t("marketplace.provenance.requirementCounts", { reused: generation.reusedRequirements, total: generation.totalRequirements })}
        </p>
      )}
    </div>
  );
}

function PlanSection({ label, icon, items, muted }: { label: string; icon: React.ReactNode; items: string[]; muted?: boolean }) {
  if (items.length === 0) return null;
  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ margin: "0 0 8px", fontSize: 11, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>{label}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7, fontSize: 13, color: muted ? T.textMuted : T.textSub }}>
            {icon} <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuoteLine({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: bold ? 800 : 400, fontSize: bold ? 16 : 13.5, color: T.text }}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function ErrorNote({ error }: { error: AppError }) {
  const { t } = useI18n();
  return <p style={{ margin: "10px 0", fontSize: 12.5, color: T.red }}>{t(error.translationKey)}</p>;
}
