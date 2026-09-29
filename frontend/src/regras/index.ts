// ============================================================
// REGRAS DE NEGÓCIO
// ============================================================
// Funções puras (sem tela, sem API): recebem dados e devolvem uma
// resposta. Ficam fora dos componentes para poderem ser testadas
// sozinhas e reaproveitadas em várias telas.
import type { Pagamento, Produto } from "../api";
import type { Tom } from "../constants";

// ---------- pagamentos ----------

export type SituacaoPagamento = "pago" | "pendente" | "atrasado";

// Pago, a vencer ou atrasado, comparando o vencimento com hoje ("AAAA-MM-DD")
export function situacaoDoPagamento(pagamento: Pick<Pagamento, "pagoEm" | "vencimento">, hoje: string): SituacaoPagamento {
  if (pagamento.pagoEm) return "pago";
  return pagamento.vencimento < hoje ? "atrasado" : "pendente";
}

// Soma dos pagamentos recebidos no mês informado ("AAAA-MM")
export function faturamentoDoMes(pagamentos: Pick<Pagamento, "pagoEm" | "valor">[], mes: string): number {
  return pagamentos.filter((p) => p.pagoEm && p.pagoEm.slice(0, 7) === mes).reduce((soma, p) => soma + p.valor, 0);
}

// ---------- estoque ----------

// Estoque baixo: quantidade igual ou menor que o mínimo cadastrado
export function estoqueBaixo(produto: Pick<Produto, "quantidade" | "estoqueMinimo">): boolean {
  return produto.quantidade <= produto.estoqueMinimo;
}

// ---------- auditoria ----------

// Cor do selo conforme o tipo de ação registrada
export function tomDaAcao(acao: string): Tom {
  if (acao.includes("excluiu") || acao.includes("estornou")) return "danger";
  if (acao.includes("recebeu")) return "ok";
  if (acao.includes("alterou")) return "warn";
  return "accent";
}

// ---------- assinatura (cobranças do Asaas) ----------

const STATUS_COBRANCA: Record<string, { label: string; tone: Tom }> = {
  PENDING: { label: "a vencer", tone: "warn" },
  OVERDUE: { label: "atrasado", tone: "danger" },
  RECEIVED: { label: "pago", tone: "ok" },
  CONFIRMED: { label: "pago", tone: "ok" },
  RECEIVED_IN_CASH: { label: "pago (manual)", tone: "ok" },
  REFUNDED: { label: "estornado", tone: "danger" },
};

const STATUS_COBRANCA_PAGA = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"];

// Selo de uma cobrança. Status desconhecido aparece em minúsculas, neutro.
export function seloDaCobranca(status: string): { label: string; tone: Tom } {
  return STATUS_COBRANCA[status] || { label: status?.toLowerCase() || "-", tone: "muted" };
}

export function cobrancaPaga(status: string): boolean {
  return STATUS_COBRANCA_PAGA.includes(status);
}

// Regras do dashboard e do financeiro
export * from "./dashboard";

// Regras da ordem de serviço
export * from "./ordens";
