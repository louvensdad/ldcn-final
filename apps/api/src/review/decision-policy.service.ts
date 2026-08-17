import { Injectable } from '@nestjs/common';
import { ReviewFindingSeverity } from './review-finding.service';

/**
 * MISSÃO "Auto-Governança por IA": a autoridade central única para "isso pode ser resolvido
 * sozinho ou precisa do usuário?" — nenhum reviewer, endpoint ou tela decide isso por conta
 * própria. Antes desta classe, a regra era simples demais (qualquer achado com
 * requiresUserDecision=true bloqueava a aprovação, não importa o quão trivial) — isso é
 * exatamente o que tornava a experiência lenta e cansativa (o usuário validando detalhes
 * demais). Esta política é 100% determinística (nunca chama IA) — mesma entrada, mesma saída,
 * sempre auditável e testável sem mocks de LLM.
 */
export type DecisionPolicyOutcome =
  | 'AUTO'
  | 'AUTO_WITH_DISCLOSURE'
  | 'USER_CONFIRMATION'
  | 'USER_DECISION_REQUIRED'
  | 'BLOCKED';

export interface DecisionPolicyInput {
  severity: ReviewFindingSeverity;
  requiresUserDecision: boolean;
  finding: string;
  recommendedResolutions: string[];
  requirementIds: string[];
}

export interface DecisionPolicyResult {
  outcome: DecisionPolicyOutcome;
  /** Só AUTO/AUTO_WITH_DISCLOSURE/USER_CONFIRMATION com um alvo real e uma resolução recomendada
   * podem ser corrigidos automaticamente pelo Auto-Repair Loop — o resto só é classificado, nunca
   * reescrito sozinho (ex: um achado sobre o documento inteiro, sem `targetContent` resolvido). */
  autoFixable: boolean;
  reason: string;
}

/**
 * Vocabulário de impacto real de negócio/produto (brief seção 3): preço, meios de pagamento,
 * monetização, integrações externas, biometria, ações irreversíveis, compromisso legal — o que
 * distingue "a IA recomenda e o usuário pode só confirmar" de "isso muda o produto, precisa de
 * uma decisão real". Deliberadamente restrito a sinais fortes e específicos — validado ao vivo
 * (real DeepSeek) que termos genéricos demais aqui (ex: "consentimento", "dados sensíveis")
 * aparecem em quase todo achado de privacidade/segurança em qualquer sistema com dado pessoal,
 * transformando "adicionar um requisito de consentimento" (uma correção técnica óbvia, tipo
 * AUTO_WITH_DISCLOSURE) numa falsa decisão de negócio — exatamente o tipo de fricção que esta
 * missão existe para eliminar. Falso-negativo de uma decisão real de negócio classificada como
 * AUTO não é aceitável; falso-positivo de USER_DECISION_REQUIRED também não — o vocabulário fica
 * só com termos que praticamente sempre significam uma escolha real de produto.
 */
const BUSINESS_IMPACT_SIGNAL =
  /pre[çc]o|pagamento|cobran[çc]a|checkout|monetiz|assinatura|plano comercial|integra[çc][ãa]o externa|api externa de terceiros|biometria|localiza[çc][ãa]o precisa|irrevers[íi]vel|exclus[ãa]o definitiva de dados|termos de uso|compromisso legal|obriga[çc][ãa]o legal|escolha comercial/i;

@Injectable()
export class PromptMasterDecisionPolicy {
  classify(input: DecisionPolicyInput): DecisionPolicyResult {
    const hasRealTarget = input.requirementIds.length > 0 || input.recommendedResolutions.length > 0;

    // Regra 1: BLOCKER com decisão real e um caminho de resolução oferecido — o exemplo clássico
    // é "compra definida, pagamento fora do escopo": uma contradição real que só o usuário pode
    // resolver, mas NUNCA um beco sem saída (sempre tem >=1 resolução recomendada).
    if (input.severity === 'BLOCKER' && input.requiresUserDecision) {
      if (input.recommendedResolutions.length === 0) {
        return { outcome: 'BLOCKED', autoFixable: false, reason: 'BLOCKER sem nenhum caminho de resolução oferecido pelo revisor — não há como prosseguir com segurança.' };
      }
      return { outcome: 'USER_DECISION_REQUIRED', autoFixable: false, reason: 'Contradição real (BLOCKER) com decisão de usuário necessária.' };
    }

    // Regra 2 (rede de segurança): um BLOCKER sem requiresUserDecision não deveria acontecer
    // (os prompts dos revisores exigem isso), mas se acontecer, nunca aprovar silenciosamente.
    if (input.severity === 'BLOCKER') {
      return input.recommendedResolutions.length > 0
        ? { outcome: 'USER_DECISION_REQUIRED', autoFixable: false, reason: 'BLOCKER sem sinal explícito de decisão, mas severidade crítica exige confirmação humana.' }
        : { outcome: 'BLOCKED', autoFixable: false, reason: 'BLOCKER sem resolução oferecida.' };
    }

    // Regra 3: a IA sinalizou requiresUserDecision mas não é um BLOCKER — é uma recomendação forte
    // que MUDA o produto/negócio (preço, pagamento, dados sensíveis...) → decisão real, mesmo sem
    // ser um bloqueio técnico. Caso contrário, é só uma recomendação que a IA já aplica sozinha,
    // com o usuário podendo revisar/desfazer depois (USER_CONFIRMATION) — nunca trava a aprovação.
    if (input.requiresUserDecision) {
      if (BUSINESS_IMPACT_SIGNAL.test(input.finding) || input.recommendedResolutions.some((r) => BUSINESS_IMPACT_SIGNAL.test(r))) {
        return { outcome: 'USER_DECISION_REQUIRED', autoFixable: false, reason: 'Sinaliza impacto real de negócio/produto — decisão do usuário, não da IA.' };
      }
      return {
        outcome: 'USER_CONFIRMATION',
        autoFixable: hasRealTarget,
        reason: 'Recomendação forte da IA sem impacto de negócio detectado — aplicada automaticamente, usuário pode reverter.',
      };
    }

    // Regra 4: sem sinal de decisão do próprio revisor — a IA resolve sozinha. WARNING ainda é
    // disclosed no resumo final (é um problema real, só não precisa de decisão humana); ADVISORY/
    // INFO são silenciosamente aplicados/anotados.
    if (input.severity === 'WARNING') {
      return { outcome: 'AUTO_WITH_DISCLOSURE', autoFixable: hasRealTarget, reason: 'Problema real sem decisão de produto — corrigido automaticamente e disclosed no resumo.' };
    }
    return { outcome: 'AUTO', autoFixable: hasRealTarget, reason: 'Melhoria de baixo risco — aplicada automaticamente sem interromper o usuário.' };
  }
}
