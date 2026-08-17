import { useCallback, useState } from "react";
import { T } from "../../design/tokens";
import { useI18n } from "../../i18n/I18nContext";
import { ErrorState } from "./ErrorState";
import { ApiClientError, type AppError } from "../../api/client";
import type { ExplainDecisionResponseDto } from "../../api/assistant.client";

export interface ExplainAiState {
  status: "idle" | "loading" | "done" | "error";
  explanation?: string;
  usage?: ExplainDecisionResponseDto["usage"];
  error?: AppError;
}

export const EXPLAIN_AI_IDLE: ExplainAiState = { status: "idle" };

function toAppError(err: unknown): AppError {
  return err instanceof ApiClientError ? err.appError : { category: "UNKNOWN", status: 0, code: "UNKNOWN", translationKey: "errors.unknown" };
}

/** Owns the explain-with-AI call + state for a single decision (Task routing — only one per page). */
export function useExplainAi(explainFn: () => Promise<ExplainDecisionResponseDto>) {
  const [state, setState] = useState<ExplainAiState>(EXPLAIN_AI_IDLE);

  const trigger = useCallback(() => {
    if (state.status === "loading") return;
    setState({ status: "loading" });
    explainFn()
      .then((response) => setState({ status: "done", explanation: response.explanation, usage: response.usage }))
      .catch((err) => setState({ status: "error", error: toAppError(err) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  return { state, trigger };
}

/** Same, but keyed — Architecture/Team have one decision card each, Repair has one per task, all on the same page. */
export function useExplainAiMap() {
  const [states, setStates] = useState<Record<string, ExplainAiState>>({});

  const stateFor = useCallback((key: string) => states[key] ?? EXPLAIN_AI_IDLE, [states]);

  const trigger = useCallback((key: string, explainFn: () => Promise<ExplainDecisionResponseDto>) => {
    setStates((prev) => {
      if (prev[key]?.status === "loading") return prev;
      return { ...prev, [key]: { status: "loading" } };
    });
    explainFn()
      .then((response) => setStates((prev) => ({ ...prev, [key]: { status: "done", explanation: response.explanation, usage: response.usage } })))
      .catch((err) => setStates((prev) => ({ ...prev, [key]: { status: "error", error: toAppError(err) } })));
  }, []);

  return { stateFor, trigger };
}

/** Presentational — same idle/loading/done/error markup shared by every "Explicar com IA" button. */
export function ExplainWithAi({ state, onExplain }: { state: ExplainAiState; onExplain: () => void }) {
  const { t } = useI18n();

  if (state.status === "idle") {
    return (
      <button className="btn-ghost" onClick={onExplain}>
        {t("architecture.explainWithAi")}
      </button>
    );
  }
  if (state.status === "loading") {
    return (
      <p aria-live="polite" role="status" style={{ margin: 0, fontSize: 12.5, color: T.textMuted }}>
        {t("architecture.aiAnalyzing")}
      </p>
    );
  }
  if (state.status === "done") {
    return (
      <div style={{ marginTop: 8, padding: "10px 12px", borderRadius: 8, background: T.surfaceHover, border: `1px solid ${T.border}` }}>
        <p style={{ margin: "0 0 6px", fontSize: 13, color: T.textSub, lineHeight: 1.6 }}>{state.explanation}</p>
        <p style={{ margin: 0, fontSize: 11, color: T.textMuted }}>
          {t("architecture.aiUsageLabel")} {state.usage?.model} · {state.usage?.totalTokens} tokens · {state.usage?.latencyMs}ms
        </p>
      </div>
    );
  }
  if (state.status === "error" && state.error) {
    return <ErrorState error={state.error} onRetry={onExplain} />;
  }
  return null;
}
