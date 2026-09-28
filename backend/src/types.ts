// ============================================================
// TIPOS COMPARTILHADOS DO BACKEND
// ============================================================

export type PerfilUsuario = "admin" | "atendente" | "mecanico";

export type StatusOS =
  | "orcamento"
  | "aberta"
  | "em_andamento"
  | "aguardando_peca"
  | "concluida"
  | "entregue"
  | "cancelada";

export type StatusAssinatura = "trial" | "ativa" | "atrasada" | "cancelada" | "pendente_configuracao";

export type FormaPagamento = "dinheiro" | "cartao" | "pix";

// Conteúdo do JWT. Existem dois tipos de login: a equipe da oficina
// (com perfil) e o cliente do portal (sem perfil).
export type AuthPayload =
  | { tipo: "equipe"; id: number; oficinaId: number; perfil: PerfilUsuario }
  | { tipo: "cliente"; id: number; oficinaId: number };

// Parâmetro de rota com :id
export type IdParams = { id: string };

// Resultado de "SELECT COUNT(*)" — o Postgres devolve bigint como texto
export type CountRow = { count: string };

// ------------------------------------------------------------
// Linhas das tabelas (só as colunas que o código lê diretamente)
// ------------------------------------------------------------
export interface OficinaRow {
  id: number;
  nome: string;
  cnpj: string | null;
  telefone: string;
  endereco: string | null;
  logo_url: string | null;
  ativo: boolean;
  criado_em: Date;
}

export interface UsuarioRow {
  id: number;
  oficina_id: number;
  nome: string;
  email: string;
  senha_hash: string;
  perfil: PerfilUsuario;
  ativo: boolean;
}

export interface ClienteRow {
  id: number;
  oficina_id: number;
  nome: string;
  telefone: string;
  cpf: string | null;
  endereco: string | null;
  email: string | null;
  senha_hash: string | null;
}

export interface OrdemServicoRow {
  id: number;
  oficina_id: number;
  numero: string;
  cliente_id: number;
  veiculo_id: number;
  mecanico_id: number | null;
  status: StatusOS;
  sinal: number;
  valor_total: number;
}

export interface AssinaturaRow {
  status: StatusAssinatura;
  valor: number;
  trial_termina_em: Date | string | null;
  asaas_customer_id: string | null;
  asaas_subscription_id: string | null;
}
