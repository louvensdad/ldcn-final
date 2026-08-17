import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { T, alpha } from "../design/tokens";
import { useI18n } from "../i18n/I18nContext";
import { runtimeClient, type DecisionEventDto } from "../api/runtime.client";
import { generationClient, isGenerationTerminal, type GeneratedArtifactDto, type GenerationJobDto, type MissionGenerationRunDto } from "../api/generation.client";
import { githubClient, type GithubCredentialDto, type GithubPushDto } from "../api/github.client";
import { gitlabClient, type GitlabCredentialDto, type GitlabPushDto } from "../api/gitlab.client";
import { API_BASE_URL } from "../api/config";
import { getStoredApiKey } from "../auth/AuthContext";
import { Activity } from "lucide-react";
import { useApiResource } from "../hooks/useApiResource";
import { Skeleton } from "../shared/ui/Skeleton";
import { ErrorState } from "../shared/ui/ErrorState";
import { EmptyState } from "../shared/ui/EmptyState";
import { MissionNav } from "../shared/ui/MissionNav";
import { EventTimeline } from "../shared/ui/EventTimeline";

const EXECUTION_EVENT_TYPES = new Set(["EXECUTION_DISPATCHED", "EXECUTION_COMPLETED", "EXECUTION_FAILED", "GATE_EVALUATED", "REVIEW_COMPLETED"]);
const POLL_MS = 2500;
const FAILED_STATUSES = new Set(["BUILD_FAILED", "TEST_FAILED", "RUNTIME_FAILED"]);

const statStyle = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 14px", flex: "1 1 120px", minWidth: 110 };
const statValueStyle = { margin: 0, fontSize: 20, fontWeight: 800, color: T.text };
const statLabelStyle = { margin: "2px 0 0", fontSize: 11, color: T.textMuted };
const sectionCardStyle = { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 18, marginBottom: 22 };
const logStyle = { margin: "8px 0 0", padding: 10, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 11, fontFamily: "monospace", color: T.textMuted, maxHeight: 180, overflow: "auto", whiteSpace: "pre-wrap" as const };

/** Real, server-driven generation status — polls while the run is still in progress, stops once
 * a terminal status (READY / *_FAILED / TARGET_NOT_SUPPORTED) is reached. Never fabricates a
 * status client-side: a missing run (404) is its own honest "not started" state. */
function useGenerationStatus(missionId: string) {
  const [run, setRun] = useState<MissionGenerationRunDto | null | undefined>(undefined); // undefined = loading, null = not started
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const fetchOnce = useCallback(async () => {
    try {
      const data = await generationClient.getStatus(missionId);
      setRun(data);
      setError(null);
      return data;
    } catch (err: unknown) {
      const code = err instanceof Error ? err.message : "";
      if (code.includes("MISSION_GENERATION_NOT_STARTED")) {
        setRun(null);
        setError(null);
      } else {
        setError(code || "UNKNOWN");
      }
      return null;
    }
  }, [missionId]);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      const data = await fetchOnce();
      if (cancelled) return;
      if (data && !isGenerationTerminal(data.status)) {
        timerRef.current = setTimeout(tick, POLL_MS);
      }
    }
    tick();
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [fetchOnce]);

  return { run, error, refetch: fetchOnce };
}

export function MissionExecution() {
  const { missionId = "" } = useParams<{ missionId: string }>();
  const { t } = useI18n();

  const missionLoader = useCallback(() => runtimeClient.getMission(missionId), [missionId]);
  const eventsLoader = useCallback(() => runtimeClient.getEvents(missionId), [missionId]);
  const { data: mission, loading: opsLoading, error: opsError, reload: reloadOps } = useApiResource(missionLoader, [missionId]);
  const { data: events } = useApiResource(eventsLoader, [missionId]);

  const sortedEvents = useMemo<DecisionEventDto[]>(
    () => (events?.runtime ?? []).filter((e) => EXECUTION_EVENT_TYPES.has(e.eventType)).sort((a, b) => b.createdAt - a.createdAt),
    [events],
  );

  const hasOpsContent = mission ? mission.runtimeTasks.length > 0 || mission.actions.length > 0 : false;

  return (
    <div style={{ padding: 24, maxWidth: 860, margin: "0 auto" }}>
      <MissionNav missionId={missionId} />
      <h1 style={{ margin: "0 0 18px", fontSize: 20, fontWeight: 800, color: T.text }}>{t("execution.title")}</h1>

      <LiveActivityFeed missionId={missionId} />

      <GenerationSection missionId={missionId} />

      {opsLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Skeleton height={20} width="30%" />
        </div>
      )}

      {!opsLoading && opsError && <ErrorState error={opsError} onRetry={reloadOps} />}

      {!opsLoading && !opsError && (hasOpsContent ? (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 22 }}>
            {[
              ["execution.summary.runtimeTaskCount", mission!.overview.runtimeTaskCount],
              ["execution.summary.runningTaskCount", mission!.overview.runningTaskCount],
              ["execution.summary.failedTaskCount", mission!.overview.failedTaskCount],
              ["execution.summary.reviewPendingCount", mission!.overview.reviewPendingCount],
              ["execution.summary.repairPendingCount", mission!.overview.repairPendingCount],
              ["execution.summary.retryPendingCount", mission!.overview.retryPendingCount],
            ].map(([key, value]) => (
              <div key={key as string} style={statStyle}>
                <p style={statValueStyle}>{value}</p>
                <p style={statLabelStyle}>{t(key as string)}</p>
              </div>
            ))}
          </div>

          {mission!.actions.length > 0 && (
            <div style={{ marginBottom: 22 }}>
              <h2 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: T.text }}>{t("execution.actions")}</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {mission!.actions.map((action) => (
                  <div
                    key={`${action.taskId}-${action.action}`}
                    style={{ display: "flex", alignItems: "center", gap: 10, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px" }}
                  >
                    <span style={{ fontSize: 11.5, color: T.textMuted, fontFamily: "monospace" }}>{action.taskId}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: T.indigo }}>{action.action}</span>
                    <span style={{ fontSize: 11, color: T.textMuted, marginLeft: "auto" }}>{action.source}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {mission!.runtimeTasks.length > 0 && (
            <div style={{ marginBottom: 22 }}>
              <h2 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: T.text }}>{t("execution.tasks")}</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {mission!.runtimeTasks.map((task) => (
                  <div
                    key={task.taskId}
                    style={{ display: "flex", alignItems: "center", gap: 10, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px" }}
                  >
                    <span style={{ fontSize: 11.5, color: T.textMuted, fontFamily: "monospace" }}>{task.taskId}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{task.executionStatus}</span>
                    <span style={{ fontSize: 11, color: T.textMuted }}>{task.attemptCount}×</span>
                    {task.lastGateStatus && <span style={{ fontSize: 11, color: T.textMuted }}>{task.lastGateStatus}</span>}
                    <span style={{ fontSize: 11, color: T.indigo, marginLeft: "auto" }}>{task.nextAction}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {sortedEvents.length > 0 && (
            <div>
              <h2 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: T.text }}>{t("execution.timeline")}</h2>
              <EventTimeline events={sortedEvents} />
            </div>
          )}
        </>
      ) : (
        <EmptyState title={t("execution.empty")} />
      ))}
    </div>
  );
}

function GenerationSection({ missionId }: { missionId: string }) {
  const { t } = useI18n();
  const { run, error, refetch } = useGenerationStatus(missionId);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [artifacts, setArtifacts] = useState<GeneratedArtifactDto[] | null>(null);
  const [jobs, setJobs] = useState<GenerationJobDto[] | null>(null);

  useEffect(() => {
    if (run?.status === "READY") {
      generationClient.getArtifacts(missionId).then(setArtifacts).catch(() => setArtifacts(null));
    }
  }, [missionId, run?.status]);

  useEffect(() => {
    // Jobs existem a partir da fase JOBS_RUNNING — mostra mesmo se o build falhar depois, nunca
    // esconde o que o agente cognitivo já fez de verdade.
    if (run && run.status !== "SCAFFOLDING" && run.status !== "TARGET_NOT_SUPPORTED") {
      generationClient.getJobs(missionId).then(setJobs).catch(() => setJobs(null));
    }
  }, [missionId, run?.status]);

  const start = useCallback(async () => {
    setStarting(true);
    setStartError(null);
    try {
      await generationClient.start(missionId);
      await refetch();
    } catch (err) {
      setStartError(err instanceof Error ? err.message : "UNKNOWN");
    } finally {
      setStarting(false);
    }
  }, [missionId, refetch]);

  if (run === undefined) {
    return (
      <div style={sectionCardStyle}>
        <Skeleton height={20} width="30%" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={sectionCardStyle}>
        <h2 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: T.text }}>{t("execution.generation.title")}</h2>
        <p style={{ fontSize: 12.5, color: T.red }}>{error}</p>
        <button className="btn-ghost" onClick={() => refetch()}>{t("common.retry")}</button>
      </div>
    );
  }

  if (run === null) {
    return (
      <div style={sectionCardStyle}>
        <h2 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: T.text }}>{t("execution.generation.title")}</h2>
        <p style={{ fontSize: 13, color: T.textMuted, marginBottom: 12 }}>{t("execution.generation.notStarted")}</p>
        {startError && (
          <p style={{ fontSize: 12.5, color: T.red, marginBottom: 12 }}>
            {startError === "ARCHITECTURE_REVIEW_NOT_APPROVED" ? t("execution.generation.needsArchitectureApproval") : startError}
          </p>
        )}
        <button className="btn-primary" onClick={start} disabled={starting}>
          {starting ? t("execution.generation.starting") : t("execution.generation.start")}
        </button>
      </div>
    );
  }

  if (run.status === "TARGET_NOT_SUPPORTED") {
    return (
      <div style={sectionCardStyle}>
        <h2 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: T.text }}>{t("execution.generation.notSupportedTitle")}</h2>
        <p style={{ fontSize: 13, color: T.textMuted }}>{t("execution.generation.notSupported")}</p>
      </div>
    );
  }

  const failed = FAILED_STATUSES.has(run.status);

  return (
    <>
      <div style={sectionCardStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.text }}>{t("execution.generation.title")}</h2>
          <span
            style={{
              fontSize: 11.5, fontWeight: 700, padding: "4px 10px", borderRadius: 999,
              background: failed ? alpha(T.red, 12) : run.status === "READY" ? alpha(T.emerald, 12) : alpha(T.indigo, 12),
              color: failed ? T.red : run.status === "READY" ? T.emerald : T.indigo,
            }}
          >
            {t(`execution.generation.status.${run.status}`)}
          </span>
        </div>

        {run.scaffold && (
          <p style={{ fontSize: 12.5, color: T.textSub, margin: "4px 0" }}>
            {t("execution.generation.scaffold", { count: run.scaffold.fileCount, skipped: run.scaffold.skippedRequirementIds.length })}
          </p>
        )}
        {run.build && (
          <p style={{ fontSize: 12.5, color: T.textSub, margin: "4px 0" }}>
            {t("execution.generation.build", { exitCode: run.build.exitCode ?? "—", durationMs: run.build.durationMs })}
          </p>
        )}
        {run.test && (
          <p style={{ fontSize: 12.5, color: T.textSub, margin: "4px 0" }}>
            {t("execution.generation.test", { passed: run.test.passed, total: run.test.total, durationMs: run.test.durationMs })}
          </p>
        )}
        {run.runtime && (
          <p style={{ fontSize: 12.5, color: T.textSub, margin: "4px 0" }}>
            {t("execution.generation.runtime", {
              status: run.runtime.healthCheckOk ? t("execution.generation.runtimeOk") : t("execution.generation.runtimeFail"),
              port: run.runtime.port,
            })}
          </p>
        )}

        {failed && (
          <>
            <pre style={logStyle}>{run.build?.exitCode !== 0 ? run.build?.logsExcerpt : run.test && run.test.failed > 0 ? run.test.logsExcerpt : run.runtime?.logsExcerpt}</pre>
            <button className="btn-primary" style={{ marginTop: 10 }} onClick={start} disabled={starting}>
              {starting ? t("execution.generation.starting") : t("execution.generation.retry")}
            </button>
          </>
        )}

        {jobs && jobs.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <h3 style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {t("execution.generation.jobs")} ({jobs.length})
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {jobs.map((j) => (
                <div key={j.id} style={{ background: T.surfaceHover, borderRadius: 8, padding: "8px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: T.text }}>{j.agentKey}</span>
                    <span
                      style={{
                        fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 999,
                        background: alpha(j.status === "IMPLEMENTED" ? T.emerald : j.status === "FAILED" ? T.red : T.indigo, 12),
                        color: j.status === "IMPLEMENTED" ? T.emerald : j.status === "FAILED" ? T.red : T.indigo,
                      }}
                    >
                      {j.status}
                    </span>
                    {j.attemptCount > 1 && (
                      <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: alpha(T.amber, 12), color: T.amber }}>
                        {t("execution.generation.jobsRepaired", { count: j.attemptCount })}
                      </span>
                    )}
                    {j.reviewerApproved !== null && (
                      <span
                        style={{
                          fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 999,
                          background: alpha(j.reviewerApproved ? T.emerald : T.red, 12), color: j.reviewerApproved ? T.emerald : T.red,
                        }}
                      >
                        {j.reviewerApproved ? t("execution.generation.reviewerApproved") : t("execution.generation.reviewerRejected")}
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: T.textMuted, marginLeft: "auto" }}>{j.targetFile}</span>
                  </div>
                  <p style={{ margin: "6px 0 0", fontSize: 12, color: T.textSub }}>"{j.requirementText}"</p>
                  {j.implementationSummary && <p style={{ margin: "4px 0 0", fontSize: 11.5, color: T.emerald }}>{j.implementationSummary}</p>}
                  {j.attemptCount > 1 && j.firstAttemptErrorCode && (
                    <p style={{ margin: "4px 0 0", fontSize: 11.5, color: T.amber }}>{t("execution.generation.jobsFirstAttemptFailed", { errorCode: j.firstAttemptErrorCode })}</p>
                  )}
                  {j.reviewerFinding && <p style={{ margin: "4px 0 0", fontSize: 11.5, color: T.red }}>{t("execution.generation.reviewerFindingLabel")}: {j.reviewerFinding}</p>}
                  {j.errorCode && <p style={{ margin: "4px 0 0", fontSize: 11.5, color: T.red }}>{j.errorCode}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {artifacts && artifacts.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <h3 style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {t("execution.generation.artifacts")} ({artifacts.length})
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, maxHeight: 220, overflow: "auto" }}>
              {artifacts.map((a) => (
                <div key={a.id} style={{ display: "flex", gap: 8, fontSize: 11, fontFamily: "monospace", color: T.textMuted }}>
                  <span style={{ color: T.text }}>{a.path}</span>
                  <span style={{ marginLeft: "auto" }}>{a.ownerAgent}</span>
                  <span>{a.sizeBytes}b</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {run.status === "READY" && <DeliverySection missionId={missionId} run={run} />}
    </>
  );
}

function DeliverySection({ missionId, run }: { missionId: string; run: MissionGenerationRunDto }) {
  const { t } = useI18n();
  const [downloading, setDownloading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);

  const download = useCallback(async () => {
    setDownloading(true);
    try {
      const blob = await generationClient.downloadZip(missionId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${missionId}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }, [missionId]);

  const togglePreview = useCallback(async () => {
    setPreviewBusy(true);
    try {
      if (previewUrl) {
        await generationClient.stopPreview(missionId);
        setPreviewUrl(null);
      } else {
        const { url } = await generationClient.startPreview(missionId);
        setPreviewUrl(url);
      }
    } finally {
      setPreviewBusy(false);
    }
  }, [missionId, previewUrl]);

  return (
    <div style={sectionCardStyle}>
      <h2 style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700, color: T.text }}>{t("execution.delivery.title")}</h2>
      <p style={{ margin: "0 0 14px", fontSize: 12.5, color: T.textMuted }}>{t("execution.delivery.subtitle")}</p>

      {run.requirementCoverage && run.requirementCoverage.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <h3 style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {t("execution.delivery.coverage")}
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {run.requirementCoverage.map((c) => (
              <div key={c.requirementId} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5 }}>
                <span
                  style={{
                    fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 999,
                    background: alpha(c.status === "EVIDENCED" ? T.emerald : c.status === "FAILED" ? T.red : T.textMuted, 12),
                    color: c.status === "EVIDENCED" ? T.emerald : c.status === "FAILED" ? T.red : T.textMuted,
                  }}
                >
                  {t(`execution.delivery.coverageStatus.${c.status}`)}
                </span>
                <span style={{ color: T.textSub }}>{c.content}</span>
              </div>
            ))}
          </div>
          {!run.deliveryEligible && (
            <p style={{ margin: "8px 0 0", fontSize: 12, color: T.red }}>{t("execution.delivery.notEligible")}</p>
          )}
        </div>
      )}

      {run.security && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <h3 style={{ margin: 0, fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {t("execution.delivery.security")}
            </h3>
            <span
              style={{
                fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 999,
                background: alpha(run.securityPassed ? T.emerald : T.red, 12), color: run.securityPassed ? T.emerald : T.red,
              }}
            >
              {run.securityPassed ? t("execution.delivery.securityPassed") : t("execution.delivery.securityFailed")}
            </span>
          </div>
          <p style={{ margin: "0 0 4px", fontSize: 11.5, color: T.textSub }}>
            {t("execution.delivery.npmAudit", {
              critical: run.security.npmAudit.critical, high: run.security.npmAudit.high,
              moderate: run.security.npmAudit.moderate, low: run.security.npmAudit.low,
            })}
          </p>
          {run.security.secretsFound > 0 && (
            <p style={{ margin: "0 0 4px", fontSize: 11.5, color: T.red }}>{t("execution.delivery.secretsFound", { count: run.security.secretsFound })}</p>
          )}
          {run.security.reviewerFindings.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 4 }}>
              {run.security.reviewerFindings.map((f, i) => (
                <p key={i} style={{ margin: 0, fontSize: 11.5, color: f.severity === "BLOCKER" ? T.red : T.textMuted }}>
                  {f.file} · {f.code} · {f.finding}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <button className="btn-primary" onClick={download} disabled={downloading || !run.downloadReady}>
          {downloading ? t("execution.delivery.downloading") : t("execution.delivery.download")}
        </button>

        <button className="btn-ghost" onClick={togglePreview} disabled={previewBusy}>
          {previewBusy ? t("execution.generation.preview.opening") : previewUrl ? t("execution.generation.preview.stop") : t("execution.generation.preview.start")}
        </button>

        {previewUrl && (
          <a href={previewUrl} target="_blank" rel="noreferrer" style={{ alignSelf: "center", fontSize: 12.5, color: T.indigo }}>
            {previewUrl}
          </a>
        )}
      </div>

      <GithubPushBlock missionId={missionId} deliveryReady={run.downloadReady} />
      <GitlabPushBlock missionId={missionId} deliveryReady={run.downloadReady} />
    </div>
  );
}

function GithubPushBlock({ missionId, deliveryReady }: { missionId: string; deliveryReady: boolean }) {
  const { t } = useI18n();
  const [credential, setCredential] = useState<GithubCredentialDto | null>(null);
  const [repoName, setRepoName] = useState(missionId.slice(0, 24));
  const [isPrivate, setIsPrivate] = useState(true);
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<GithubPushDto | null>(null);

  useEffect(() => {
    githubClient.getCredential().then(setCredential).catch(() => setCredential(null));
    githubClient.getPushStatus(missionId).then(setPushResult).catch(() => setPushResult(null));
  }, [missionId]);

  const push = useCallback(async () => {
    setPushing(true);
    try {
      const result = await githubClient.push(missionId, repoName.trim(), isPrivate);
      setPushResult(result);
    } finally {
      setPushing(false);
    }
  }, [missionId, repoName, isPrivate]);

  if (!credential) return null;

  if (!credential.configured) {
    return (
      <div style={{ marginBottom: 14 }}>
        <button className="btn-ghost" disabled title={t("execution.delivery.githubNotConnected")}>
          {t("execution.delivery.github")}
        </button>
        <p style={{ margin: "6px 0 0", fontSize: 11.5, color: T.textMuted }}>{t("execution.delivery.githubNotConnected")}</p>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 14 }}>
      <h3 style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {t("execution.delivery.github")} · @{credential.githubLogin}
      </h3>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input className="field-input" style={{ flex: 1, minWidth: 160 }} value={repoName} onChange={(e) => setRepoName(e.target.value)} placeholder="nome-do-repositorio" />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: T.textSub }}>
          <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
          {t("execution.delivery.githubPrivate")}
        </label>
        <button className="btn-primary" onClick={push} disabled={pushing || !deliveryReady || !repoName.trim()}>
          {pushing ? t("execution.delivery.githubPushing") : t("execution.delivery.githubPush")}
        </button>
      </div>
      {pushResult?.status === "PUSHED" && pushResult.repoUrl && (
        <p style={{ margin: "8px 0 0", fontSize: 12.5, color: T.emerald }}>
          {t("execution.delivery.githubPushed")}{" "}
          <a href={pushResult.repoUrl} target="_blank" rel="noreferrer" style={{ color: T.indigo }}>{pushResult.repoUrl}</a>
        </p>
      )}
      {pushResult?.status === "FAILED" && (
        <p style={{ margin: "8px 0 0", fontSize: 12.5, color: T.red }}>{pushResult.errorCode}</p>
      )}
    </div>
  );
}

function GitlabPushBlock({ missionId, deliveryReady }: { missionId: string; deliveryReady: boolean }) {
  const { t } = useI18n();
  const [credential, setCredential] = useState<GitlabCredentialDto | null>(null);
  const [repoName, setRepoName] = useState(missionId.slice(0, 24));
  const [isPrivate, setIsPrivate] = useState(true);
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<GitlabPushDto | null>(null);

  useEffect(() => {
    gitlabClient.getCredential().then(setCredential).catch(() => setCredential(null));
    gitlabClient.getPushStatus(missionId).then(setPushResult).catch(() => setPushResult(null));
  }, [missionId]);

  const push = useCallback(async () => {
    setPushing(true);
    try {
      const result = await gitlabClient.push(missionId, repoName.trim(), isPrivate);
      setPushResult(result);
    } finally {
      setPushing(false);
    }
  }, [missionId, repoName, isPrivate]);

  if (!credential) return null;

  if (!credential.configured) {
    return (
      <div style={{ marginBottom: 14 }}>
        <button className="btn-ghost" disabled title={t("execution.delivery.gitlabNotConnected")}>
          {t("execution.delivery.gitlab")}
        </button>
        <p style={{ margin: "6px 0 0", fontSize: 11.5, color: T.textMuted }}>{t("execution.delivery.gitlabNotConnected")}</p>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 14 }}>
      <h3 style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {t("execution.delivery.gitlab")} · @{credential.gitlabUsername}
      </h3>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input className="field-input" style={{ flex: 1, minWidth: 160 }} value={repoName} onChange={(e) => setRepoName(e.target.value)} placeholder="nome-do-repositorio" />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: T.textSub }}>
          <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
          {t("execution.delivery.githubPrivate")}
        </label>
        <button className="btn-primary" onClick={push} disabled={pushing || !deliveryReady || !repoName.trim()}>
          {pushing ? t("execution.delivery.githubPushing") : t("execution.delivery.gitlabPush")}
        </button>
      </div>
      {pushResult?.status === "PUSHED" && pushResult.repoUrl && (
        <p style={{ margin: "8px 0 0", fontSize: 12.5, color: T.emerald }}>
          {t("execution.delivery.githubPushed")}{" "}
          <a href={pushResult.repoUrl} target="_blank" rel="noreferrer" style={{ color: T.indigo }}>{pushResult.repoUrl}</a>
        </p>
      )}
      {pushResult?.status === "FAILED" && (
        <p style={{ margin: "8px 0 0", fontSize: 12.5, color: T.red }}>{pushResult.errorCode}</p>
      )}
    </div>
  );
}

interface LiveEvent {
  id: string;
  type: string;
  occurredAt: string;
  payload: Record<string, unknown>;
}

const EVENT_LABEL_KEY: Record<string, string> = {
  "architecture_review.started": "live.architectureReviewStarted",
  "architecture_review.completed": "live.architectureReviewCompleted",
  "generation.scaffolded": "live.scaffolded",
  "generation.job.started": "live.jobStarted",
  "generation.job.completed": "live.jobCompleted",
  "generation.build.started": "live.buildStarted",
  "generation.build.completed": "live.buildCompleted",
  "generation.test.started": "live.testStarted",
  "generation.test.completed": "live.testCompleted",
  "generation.security.started": "live.securityStarted",
  "generation.security.completed": "live.securityCompleted",
  "generation.runtime.started": "live.runtimeStarted",
  "generation.runtime.completed": "live.runtimeCompleted",
  "generation.ready": "live.ready",
  "generation.failed": "live.failed",
};

const FAILED_EVENT_TYPES = new Set(["generation.failed", "generation.job.completed"]);

/** MISSÃO "Tempo real (SSE) + UI de agentes ativos" — conecta no mesmo `/stream` real que já
 * transmite eventos de operação (nenhum canal paralelo inventado), filtrando client-side pelo
 * missionId atual. Cada linha aqui é um evento real, emitido no instante exato em que o pipeline
 * mudou de fase de verdade — nunca uma barra de progresso fabricada. */
function LiveActivityFeed({ missionId }: { missionId: string }) {
  const { t } = useI18n();
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const key = getStoredApiKey();
    if (!key || typeof EventSource === "undefined") return;
    const source = new EventSource(`${API_BASE_URL}/stream?apiKey=${encodeURIComponent(key)}`);
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.onmessage = (message) => {
      try {
        const payload = JSON.parse(message.data) as { id: string; type: string; missionId?: string; occurredAt: string; payload: Record<string, unknown> };
        if (payload.missionId !== missionId) return;
        setEvents((current) => [{ id: payload.id, type: payload.type, occurredAt: payload.occurredAt, payload: payload.payload }, ...current].slice(0, 30));
      } catch {
        // Evento malformado nunca derruba o feed — só é ignorado.
      }
    };
    return () => source.close();
  }, [missionId]);

  if (events.length === 0) return null;

  return (
    <div style={{ ...sectionCardStyle, borderColor: alpha(T.indigo, 25) }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Activity size={14} color={connected ? T.indigo : T.textMuted} />
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.text }}>{t("live.title")}</h2>
        <span style={{ marginLeft: "auto", fontSize: 10.5, color: connected ? T.emerald : T.textMuted }}>
          {connected ? t("live.connected") : t("live.disconnected")}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 260, overflow: "auto" }}>
        {events.map((event) => {
          const failed = FAILED_EVENT_TYPES.has(event.type) && (event.payload.status === "FAILED" || event.type === "generation.failed");
          const label = EVENT_LABEL_KEY[event.type] ? t(EVENT_LABEL_KEY[event.type], flattenPayload(event.payload)) : event.type;
          return (
            <div key={event.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: failed ? T.red : T.indigo, flexShrink: 0 }} />
              <span style={{ color: T.textSub }}>{label}</span>
              <span style={{ marginLeft: "auto", fontSize: 10.5, color: T.textMuted }}>{new Date(event.occurredAt).toLocaleTimeString()}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function flattenPayload(payload: Record<string, unknown>): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (typeof v === "string" || typeof v === "number") out[k] = v;
    else if (typeof v === "boolean") out[k] = v ? "sim" : "não";
  }
  return out;
}
