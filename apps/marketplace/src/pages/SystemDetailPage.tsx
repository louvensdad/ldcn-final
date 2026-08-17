import { useNavigate, useParams, Link } from "react-router-dom";
import { CheckCircle2, XCircle, Sparkles, ShoppingCart, ChevronLeft, ShieldCheck } from "lucide-react";
import { T, alpha } from "../design/tokens";
import { useI18n } from "../i18n/I18nContext";
import { useApiResource } from "../hooks/useApiResource";
import { marketplaceSolutionClient } from "../api/marketplace-solution.client";
import { Skeleton } from "../shared/ui/Skeleton";
import { ErrorState } from "../shared/ui/ErrorState";

function formatCents(cents: number, currency = "BRL"): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100);
}

const TARGET_LABEL: Record<string, string> = { backend: "Backend", frontend: "Frontend", mobile: "Mobile" };

/**
 * MISSÃO "Marketplace de Sistemas Completos" seção 7/45 — a página de produto real que substitui
 * o painel lateral para "Sistemas completos". Tudo aqui vem do backend real (manifest/stack/gate
 * de verificação) — nunca card com número fabricado (seção 40).
 */
export function SystemDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { data, loading, error, reload } = useApiResource(
    () => marketplaceSolutionClient.getBySlug(slug ?? ""),
    [slug]
  );

  if (loading) {
    return (
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "32px 24px" }}>
        <Skeleton height={32} width={320} />
        <div style={{ marginTop: 16 }}><Skeleton height={16} width="80%" /></div>
        <div style={{ marginTop: 24 }}><Skeleton height={200} /></div>
      </div>
    );
  }
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data || !data.currentVersion) {
    return (
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "48px 24px", textAlign: "center", color: T.textMuted }}>
        <p>{t("marketplace.system.notPublished")}</p>
        <Link to="/marketplace" className="btn-ghost" style={{ marginTop: 12, display: "inline-flex" }}>
          {t("marketplace.system.backToCatalog")}
        </Link>
      </div>
    );
  }

  const { solution, currentVersion } = data;
  const { manifest, stackSnapshot, validationSnapshot, pricingSnapshot } = currentVersion;

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: "24px 24px 64px" }}>
      <Link to="/marketplace" style={{ display: "inline-flex", alignItems: "center", gap: 4, color: T.textMuted, fontSize: 12.5, textDecoration: "none", marginBottom: 18 }}>
        <ChevronLeft size={14} /> {t("marketplace.system.backToCatalog")}
      </Link>

      {/* Hero */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: T.emerald, background: alpha(T.emerald, 10), border: `1px solid ${alpha(T.emerald, 22)}`, padding: "3px 8px", borderRadius: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            {solution.status === "VERIFIED" ? t("marketplace.system.verified") : solution.status}
          </span>
          <span style={{ fontSize: 12, color: T.textMuted }}>v{currentVersion.version} · {solution.publisherId}</span>
        </div>
        <h1 style={{ margin: "0 0 8px", fontSize: 28, fontWeight: 800, color: T.text }}>{solution.name}</h1>
        <p style={{ margin: 0, fontSize: 14.5, color: T.textSub, lineHeight: 1.6, maxWidth: 640 }}>{solution.description}</p>
      </div>

      {/* O que está incluído */}
      <Section title={t("marketplace.system.included")}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
          {manifest.capabilities.map((cap) => (
            <div key={cap} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: T.textSub }}>
              <CheckCircle2 size={14} color={T.emerald} /> {cap}
            </div>
          ))}
        </div>
        {manifest.removableCapabilities.length > 0 && (
          <p style={{ margin: "12px 0 0", fontSize: 12, color: T.textMuted }}>
            {t("marketplace.system.removable")}: {manifest.removableCapabilities.join(", ")}
          </p>
        )}
      </Section>

      {/* Stack */}
      <Section title={t("marketplace.system.stack")}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {(["backend", "frontend", "mobile"] as const)
            .filter((k) => manifest.targets[k].enabled)
            .map((k) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
                <span style={{ color: T.textMuted }}>{TARGET_LABEL[k]}</span>
                <span style={{ color: T.text, fontWeight: 600 }}>{manifest.targets[k].pluginId ?? "—"}</span>
              </div>
            ))}
          {stackSnapshot.length === 0 && <p style={{ margin: 0, fontSize: 12.5, color: T.textMuted }}>{t("marketplace.system.noStack")}</p>}
        </div>
      </Section>

      {/* Qualidade — nunca fabricado: mostra exatamente o que o Verification Gate checou */}
      <Section title={t("marketplace.system.quality")}>
        {validationSnapshot ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {validationSnapshot.checks.map((check) => (
              <div key={check.code} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5 }}>
                {check.passed ? <CheckCircle2 size={14} color={T.emerald} style={{ flexShrink: 0, marginTop: 1 }} /> : <XCircle size={14} color={T.red} style={{ flexShrink: 0, marginTop: 1 }} />}
                <span style={{ color: T.textSub }}>{check.detail}</span>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: 12.5, color: T.textMuted }}>{t("marketplace.system.notVerifiedYet")}</p>
        )}
      </Section>

      {/* Customização */}
      <Section title={t("marketplace.system.customizationTitle")}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
          {(Object.entries(manifest.customizationPolicy) as [string, boolean][]).map(([key, allowed]) => (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: allowed ? T.textSub : T.textMuted }}>
              {allowed ? <CheckCircle2 size={13} color={T.indigo} /> : <XCircle size={13} color={T.textMuted} />}
              {t(`marketplace.system.policy.${key}`)}
            </div>
          ))}
        </div>
      </Section>

      {/* Preço */}
      <Section title={t("marketplace.system.pricing")}>
        <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: T.text }}>{formatCents(pricingSnapshot.basePrice)}</p>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: T.textMuted }}>{t("marketplace.system.pricingHint")}</p>
      </Section>

      {/* CTA */}
      <div style={{ display: "flex", gap: 10, marginTop: 28, paddingTop: 20, borderTop: `1px solid ${T.border}` }}>
        <button className="btn-primary" style={{ padding: "12px 20px", fontSize: 14.5 }} onClick={() => navigate(`/marketplace/systems/${solution.slug}/customize`)}>
          <Sparkles size={16} /> {t("marketplace.customize.button")}
        </button>
        <button className="btn-ghost" style={{ padding: "12px 20px", fontSize: 14.5 }} onClick={() => navigate(`/marketplace/systems/${solution.slug}/customize?asIs=1`)}>
          <ShoppingCart size={16} /> {t("marketplace.system.buyAsIs")}
        </button>
      </div>
      <p style={{ display: "flex", alignItems: "center", gap: 6, margin: "10px 0 0", fontSize: 11.5, color: T.textMuted }}>
        <ShieldCheck size={13} /> {t("marketplace.system.neverModifiesOriginal")}
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24, paddingBottom: 20, borderBottom: `1px solid ${T.border}` }}>
      <p style={{ margin: "0 0 12px", fontSize: 11, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>{title}</p>
      {children}
    </div>
  );
}
