import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ChevronDown, ChevronRight } from "lucide-react";
import { T } from "../design/tokens";
import { useI18n } from "../i18n/I18nContext";
import { discoveryClient } from "../api/discovery.client";
import { projectClient, type ProjectDto } from "../api/project.client";
import { ApiClientError, type AppError } from "../api/client";
import { ErrorState } from "../shared/ui/ErrorState";

const DELIVERY_TARGETS = ["BACKEND", "FRONTEND", "MOBILE", "DATA", "AI", "EXTERNAL_INTEGRATION"] as const;

function splitList(value: string): string[] | undefined {
  const items = value.split(",").map((item) => item.trim()).filter(Boolean);
  return items.length ? items : undefined;
}

function toAppError(err: unknown): AppError {
  return err instanceof ApiClientError ? err.appError : { category: "UNKNOWN", status: 0, code: "UNKNOWN", translationKey: "errors.unknown" };
}

/**
 * Fase Discovery: a ideia crua nunca mais vai direto pro engine atômico (core/src/generator.ts).
 * O Wizard só coleta a ideia (+ preferências avançadas opcionais) e abre uma conversa real de
 * Discovery — quem conduz o resto é o Copilot dentro da própria missão (Fase 11: "Copilot é o
 * fluxo"), não uma tela de recap parada aqui.
 */
export function Wizard() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const prefilledIdea = (location.state as { idea?: string } | null)?.idea ?? "";

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [forbiddenTargets, setForbiddenTargets] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<"idea" | "import">("idea");
  const [specText, setSpecText] = useState("");

  const [rawUserIdea, setRawUserIdea] = useState(prefilledIdea);
  const [technologyPreferences, setTechnologyPreferences] = useState("");
  const [constraints, setConstraints] = useState("");
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [projectId, setProjectId] = useState("");

  useEffect(() => {
    projectClient.list().then(setProjects).catch(() => setProjects([]));
  }, []);

  function toggleTarget(target: string) {
    setForbiddenTargets((prev) => {
      const next = new Set(prev);
      next.has(target) ? next.delete(target) : next.add(target);
      return next;
    });
  }

  async function submit() {
    if (mode === "import") return submitImport();
    if (!rawUserIdea.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    const missionId = crypto.randomUUID();
    const advanced = {
      technologyPreferences: splitList(technologyPreferences),
      constraints: splitList(constraints),
      forbiddenDeliveryTargets: forbiddenTargets.size ? [...forbiddenTargets] : undefined,
    };
    const hasAdvancedInput = advanced.technologyPreferences || advanced.constraints || advanced.forbiddenDeliveryTargets;

    try {
      await discoveryClient.start(missionId, rawUserIdea, hasAdvancedInput ? advanced : undefined);
      if (projectId) {
        await projectClient.assignMission(projectId, missionId).catch(() => undefined);
      }
      navigate(`/missions/${missionId}`);
    } catch (err) {
      setError(toAppError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitImport() {
    if (!specText.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    const missionId = crypto.randomUUID();
    try {
      await discoveryClient.startFromImport(missionId, specText);
      if (projectId) {
        await projectClient.assignMission(projectId, missionId).catch(() => undefined);
      }
      navigate(`/missions/${missionId}`);
    } catch (err) {
      setError(toAppError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 640, margin: "0 auto" }}>
      <h1 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800, color: T.text }}>{t("wizard.title")}</h1>
      <p style={{ margin: "0 0 16px", fontSize: 13.5, color: T.textMuted }}>{t("wizard.subtitle")}</p>

      <button
        type="button"
        onClick={() => setMode((m) => (m === "idea" ? "import" : "idea"))}
        style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: T.indigo, fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: 16, fontFamily: "inherit" }}
      >
        {mode === "idea" ? t("wizard.haveSpecLink") : t("wizard.backToIdeaLink")}
      </button>

      {mode === "idea" ? (
        <>
          <label className="field-label" htmlFor="rawUserIdea">
            {t("wizard.ideaLabel")}
          </label>
          <textarea
            id="rawUserIdea"
            className="field-input field-textarea"
            value={rawUserIdea}
            onChange={(e) => setRawUserIdea(e.target.value)}
            rows={4}
          />
        </>
      ) : (
        <>
          <label className="field-label" htmlFor="specText">
            {t("wizard.specLabel")}
          </label>
          <textarea
            id="specText"
            className="field-input field-textarea"
            style={{ minHeight: 220 }}
            placeholder={t("wizard.specPlaceholder")}
            value={specText}
            onChange={(e) => setSpecText(e.target.value)}
          />
          <p className="field-hint">{t("wizard.specHint")}</p>
        </>
      )}

      {projects.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <label className="field-label" htmlFor="wizard-project">
            {t("wizard.projectLabel")}
          </label>
          <select id="wizard-project" className="field-input" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">{t("wizard.projectNone")}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

      {mode === "idea" && (
        <button
          type="button"
          onClick={() => setAdvancedOpen((open) => !open)}
          style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: T.textSub, fontSize: 12.5, cursor: "pointer", padding: "12px 0", fontFamily: "inherit" }}
        >
          {advancedOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          {advancedOpen ? t("wizard.hideAdvanced") : t("wizard.showAdvanced")}
        </button>
      )}

      {mode === "idea" && advancedOpen && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 8 }}>
          <div>
            <label className="field-label" htmlFor="techPrefs">
              {t("wizard.techPreferencesLabel")}
            </label>
            <input id="techPrefs" className="field-input" value={technologyPreferences} onChange={(e) => setTechnologyPreferences(e.target.value)} />
            <p className="field-hint">{t("wizard.commaHint")}</p>
          </div>

          <div>
            <span className="field-label">{t("wizard.forbiddenTargetsLabel")}</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {DELIVERY_TARGETS.map((target) => (
                <button
                  key={target}
                  type="button"
                  className={`plan-chip${forbiddenTargets.has(target) ? " active" : ""}`}
                  onClick={() => toggleTarget(target)}
                >
                  {target}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="field-label" htmlFor="constraints">
              {t("wizard.constraintsLabel")}
            </label>
            <input id="constraints" className="field-input" value={constraints} onChange={(e) => setConstraints(e.target.value)} />
            <p className="field-hint">{t("wizard.commaHint")}</p>
          </div>
        </div>
      )}

      {error && (
        <div style={{ margin: "8px 0" }}>
          <ErrorState error={error} onRetry={submit} />
        </div>
      )}

      <button
        className="btn-primary"
        style={{ width: "100%", padding: "11px 16px", marginTop: 8 }}
        onClick={submit}
        disabled={submitting || (mode === "idea" ? !rawUserIdea.trim() : !specText.trim())}
      >
        {submitting ? t("common.loading") : mode === "idea" ? t("wizard.submit") : t("wizard.analyzeSpec")}
      </button>
    </div>
  );
}
