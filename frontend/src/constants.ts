// ============================================================
// CONSTANTES DO SISTEMA
// ============================================================
import type { FormaPagamento, StatusOS } from "./api";

// Tons de cor usados pelos selos (Badge)
export type Tom = "ok" | "warn" | "danger" | "accent" | "muted";

// Formas de pagamento e o documento que cada uma exige
export const FORMAS: Record<FormaPagamento, { label: string; exigeDoc: boolean; rotuloDoc: string }> = {
  dinheiro: { label: "dinheiro", exigeDoc: false, rotuloDoc: "" },
  cartao: { label: "cartão", exigeDoc: true, rotuloDoc: "número da nota / NSU" },
  pix: { label: "PIX", exigeDoc: true, rotuloDoc: "ID da transação" },
};

export const CATEGORIAS_DESPESA: Record<string, string> = {
  aluguel: "aluguel",
  energia: "energia",
  agua: "água",
  salarios: "salários",
  fornecedores: "fornecedores",
  internet: "internet/telefone",
  manutencao: "manutenção",
  outros: "outros",
};

// Nome de cada status da O.S. como aparece na tela
export const STATUS_LABEL: Record<StatusOS, string> = {
  orcamento: "orçamento",
  aberta: "aberta",
  em_andamento: "em andamento",
  aguardando_peca: "aguard. peça",
  concluida: "concluída",
  entregue: "entregue",
  cancelada: "cancelada",
};

// Cor do selo de cada status da O.S.
export const STATUS_TONE: Record<StatusOS, Tom> = {
  orcamento: "muted",
  aberta: "accent",
  em_andamento: "accent",
  aguardando_peca: "warn",
  concluida: "ok",
  entregue: "ok",
  cancelada: "danger",
};
